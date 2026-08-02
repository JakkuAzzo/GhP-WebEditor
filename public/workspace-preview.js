(function exposeWorkspacePreview(global) {
    function normalizeWorkspacePath(currentPath, reference) {
        if (!reference || reference.startsWith('#') || /^(?:[a-z]+:|\/\/)/i.test(reference)) return null;
        const cleanReference = reference.split(/[?#]/, 1)[0];
        const baseParts = currentPath.split('/');
        baseParts.pop();
        const parts = `${baseParts.join('/')}/${cleanReference}`.split('/');
        const normalized = [];
        for (const part of parts) {
            if (!part || part === '.') continue;
            if (part === '..') normalized.pop();
            else normalized.push(part);
        }
        return normalized.join('/');
    }

    async function replaceAsync(source, expression, replacer) {
        const matches = [...source.matchAll(expression)];
        if (!matches.length) return source;
        const replacements = await Promise.all(matches.map(match => replacer(...match)));
        let offset = 0;
        let result = source;
        matches.forEach((match, index) => {
            const start = match.index + offset;
            result = `${result.slice(0, start)}${replacements[index]}${result.slice(start + match[0].length)}`;
            offset += replacements[index].length - match[0].length;
        });
        return result;
    }

    function workspaceFile(currentPath, reference, fileMap) {
        const workspacePath = normalizeWorkspacePath(currentPath, reference);
        return workspacePath ? fileMap.get(workspacePath) : null;
    }

    async function rewriteCssUrls(css, currentPath, fileMap, getAssetUrl) {
        if (!getAssetUrl) return css;
        return replaceAsync(css, /url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi, async (match, _quote, reference) => {
            const file = workspaceFile(currentPath, reference.trim(), fileMap);
            if (!file) return match;
            const assetUrl = await getAssetUrl(file);
            return assetUrl ? `url("${assetUrl}")` : match;
        });
    }

    async function composeStylesheet(file, fileMap, getContent, getAssetUrl, visited = new Set()) {
        if (visited.has(file.path)) return '';
        const nextVisited = new Set(visited).add(file.path);
        let css = await getContent(file);
        css = await replaceAsync(
            css,
            /@import\s+(?:url\(\s*)?(['"]?)([^'"\)\s]+)\1\s*\)?\s*([^;]*);/gi,
            async (match, _quote, reference, media) => {
                const imported = workspaceFile(file.path, reference, fileMap);
                if (!imported || !/\.css$/i.test(imported.path)) return match;
                const importedCss = await composeStylesheet(imported, fileMap, getContent, getAssetUrl, nextVisited);
                const condition = media.trim();
                return condition ? `@media ${condition} {\n${importedCss}\n}` : importedCss;
            }
        );
        return rewriteCssUrls(css, file.path, fileMap, getAssetUrl);
    }

    function textDataUrl(mimeType, content) {
        const bytes = new TextEncoder().encode(content);
        let binary = '';
        bytes.forEach(byte => { binary += String.fromCharCode(byte); });
        return `data:${mimeType};base64,${btoa(binary)}`;
    }

    async function rewriteModuleImports(content, currentPath, fileMap, getContent, getAssetUrl, visited = new Set()) {
        async function replaceReference(match, prefix, quote, reference, suffix = '') {
            const imported = workspaceFile(currentPath, reference, fileMap);
            if (!imported || visited.has(imported.path)) return match;
            const importedContent = await getContent(imported);
            const rewritten = await rewriteModuleImports(importedContent, imported.path, fileMap, getContent, getAssetUrl, new Set(visited).add(imported.path));
            return `${prefix}${quote}${textDataUrl('text/javascript', rewritten)}${quote}${suffix}`;
        }
        let rewritten = await replaceAsync(
            content,
            /(\b(?:import|export)\s+[^'";]*?\sfrom\s*)(['"])([^'"]+)\2/g,
            replaceReference
        );
        // Vite/Rollup production bundles use import.meta.url for assets imported
        // from JavaScript. Once the module is inlined as a data URL, that URL no
        // longer points at the workspace, so resolve the asset before inlining.
        rewritten = await replaceAsync(
            rewritten,
            /new\s+URL\(\s*(['"])([^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g,
            async (match, _quote, reference) => {
                const asset = workspaceFile(currentPath, reference, fileMap);
                const assetUrl = asset && getAssetUrl ? await getAssetUrl(asset) : null;
                return assetUrl ? JSON.stringify(assetUrl) : match;
            }
        );
        rewritten = await replaceAsync(rewritten, /(\bimport\s*)(['"])([^'"]+)\2/g, replaceReference);
        return replaceAsync(
            rewritten,
            /(\bimport\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
            replaceReference
        );
    }

    function serializeDocument(doc, hadDoctype) {
        return `${hadDoctype ? '<!DOCTYPE html>\n' : ''}${doc.documentElement.outerHTML}`;
    }

    function sanitizeBodyHtml(html) {
        if (!global.DOMPurify) throw new Error('Visual editing is unavailable until the HTML sanitizer loads');
        // This markup is inserted into the privileged editor document. Limit the
        // visual mode to plain HTML; SVG and MathML carry active namespaced URLs.
        return global.DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true },
            FORBID_TAGS: ['base', 'form', 'iframe', 'link', 'meta', 'object', 'embed'],
            FORBID_ATTR: ['action', 'formaction', 'srcdoc', 'style', 'target'],
            ALLOW_DATA_ATTR: false,
            ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
        });
    }

    function visualBody(source) {
        const doc = new DOMParser().parseFromString(source, 'text/html');
        return sanitizeBodyHtml(doc.body.innerHTML || source);
    }

    function applyVisualBody(source, editedBody) {
        const sanitized = sanitizeBodyHtml(editedBody);
        const bodyMatch = source.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
        if (!bodyMatch) return sanitized;
        const originalScripts = [...new DOMParser().parseFromString(source, 'text/html').body.querySelectorAll('script')]
            .map(script => script.outerHTML)
            .join('\n');
        return source.replace(/(<body\b[^>]*>)[\s\S]*(<\/body>)/i, (_match, open, close) => {
            const scripts = originalScripts ? `\n${originalScripts}` : '';
            return `${open}\n${sanitized}${scripts}\n${close}`;
        });
    }

    async function composePreview(source, currentFile, files, getContent, getAssetUrl) {
        const hadDoctype = /^\s*<!doctype/i.test(source);
        const doc = new DOMParser().parseFromString(source, 'text/html');
        const fileMap = new Map(files.filter(file => file.type === 'file').map(file => [file.path, file]));
        const objectUrls = [];

        for (const link of [...doc.querySelectorAll('link[rel~="stylesheet"][href]')]) {
            const workspacePath = normalizeWorkspacePath(currentFile.path, link.getAttribute('href'));
            const file = workspacePath && fileMap.get(workspacePath);
            if (!file) continue;
            const style = doc.createElement('style');
            style.dataset.workspaceSource = workspacePath;
            style.textContent = await composeStylesheet(file, fileMap, getContent, getAssetUrl);
            link.replaceWith(style);
        }

        for (const style of [...doc.querySelectorAll('style')]) {
            if (style.dataset.workspaceSource) continue;
            style.textContent = await rewriteCssUrls(style.textContent || '', currentFile.path, fileMap, getAssetUrl);
        }

        for (const element of [...doc.querySelectorAll('[style]')]) {
            element.setAttribute('style', await rewriteCssUrls(element.getAttribute('style'), currentFile.path, fileMap, getAssetUrl));
        }

        const assetAttributes = [
            ['img[src]', 'src'], ['source[src]', 'src'], ['video[src]', 'src'],
            ['video[poster]', 'poster'], ['audio[src]', 'src'], ['input[type="image"][src]', 'src'],
            ['link[rel~="icon"][href]', 'href']
        ];
        for (const [selector, attribute] of assetAttributes) {
            for (const element of [...doc.querySelectorAll(selector)]) {
                const file = workspaceFile(currentFile.path, element.getAttribute(attribute), fileMap);
                if (!file || !getAssetUrl) continue;
                const assetUrl = await getAssetUrl(file);
                if (assetUrl) element.setAttribute(attribute, assetUrl);
            }
        }

        for (const element of [...doc.querySelectorAll('img[srcset], source[srcset]')]) {
            const candidates = element.getAttribute('srcset').split(',');
            const rewritten = [];
            for (const candidate of candidates) {
                const [reference, ...descriptor] = candidate.trim().split(/\s+/);
                const file = workspaceFile(currentFile.path, reference, fileMap);
                const assetUrl = file && getAssetUrl ? await getAssetUrl(file) : null;
                rewritten.push([assetUrl || reference, ...descriptor].join(' '));
            }
            element.setAttribute('srcset', rewritten.join(', '));
        }

        for (const script of [...doc.querySelectorAll('script')]) {
            let content = script.textContent || '';
            const sourcePath = normalizeWorkspacePath(currentFile.path, script.getAttribute('src'));
            if (script.hasAttribute('src')) {
                const file = sourcePath && fileMap.get(sourcePath);
                if (!file) {
                    script.remove();
                    continue;
                }
                content = await getContent(file);
            }
            if ((script.type || '').toLowerCase() === 'module') {
            content = await rewriteModuleImports(
                    content,
                    sourcePath || currentFile.path,
                    fileMap,
                    getContent,
                    getAssetUrl,
                    new Set(sourcePath ? [sourcePath] : [])
                );
            }
            const replacement = doc.createElement('script');
            if (script.type) replacement.type = script.type;
            replacement.dataset.workspaceSource = sourcePath || 'inline';
            replacement.textContent = content;
            script.replaceWith(replacement);
        }

        return { html: serializeDocument(doc, hadDoctype), objectUrls };
    }

    global.GhpWorkspacePreview = {
        applyVisualBody,
        composePreview,
        composeStylesheet,
        normalizeWorkspacePath,
        rewriteCssUrls,
        rewriteModuleImports,
        sanitizeBodyHtml,
        visualBody
    };
}(window));
