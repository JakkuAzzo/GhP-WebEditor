(function installStaticGitHubApi(global) {
    'use strict';

    const API_ROOT = 'https://api.github.com';
    const nativeFetch = global.fetch.bind(global);
    let accessToken = null;
    let currentUser = null;

    function json(data, status = 200) {
        return new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    function errorMessage(payload, fallback) {
        return payload?.message || fallback;
    }

    async function github(endpoint, options = {}) {
        if (!accessToken) return json({ message: 'GitHub token required' }, 401);
        const response = await nativeFetch(`${API_ROOT}${endpoint}`, {
            ...options,
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${accessToken}`,
                'X-GitHub-Api-Version': '2022-11-28',
                ...options.headers
            }
        });
        return response;
    }

    async function listRepositories() {
        const repositories = [];
        for (let page = 1; page <= 10; page += 1) {
            const response = await github(`/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=100&page=${page}`);
            if (!response.ok) return response;
            const batch = await response.json();
            repositories.push(...batch);
            if (batch.length < 100) break;
        }
        return json(repositories.map(repo => ({
            full_name: repo.full_name,
            default_branch: repo.default_branch,
            permissions: repo.permissions
        })));
    }

    function repositoryRoute(pathname) {
        const match = pathname.match(/^\/api\/github\/repos\/([^/]+)\/([^/]+)(?:\/(.*))?$/);
        if (!match) return null;
        return {
            owner: decodeURIComponent(match[1]),
            repo: decodeURIComponent(match[2]),
            remainder: match[3] || ''
        };
    }

    function repositoryPrefix(route) {
        return `/repos/${encodeURIComponent(route.owner)}/${encodeURIComponent(route.repo)}`;
    }

    async function pagesStatus(route) {
        const prefix = `${repositoryPrefix(route)}/pages`;
        const siteResponse = await github(prefix);
        if (siteResponse.status === 404) return json({ configured: false });
        if (!siteResponse.ok) return siteResponse;
        const site = await siteResponse.json();
        const buildResponse = await github(`${prefix}/builds/latest`);
        const build = buildResponse.ok ? await buildResponse.json() : null;
        return json({
            configured: true,
            url: site.html_url,
            buildType: site.build_type,
            source: site.source ? { branch: site.source.branch, path: site.source.path } : null,
            build: build ? {
                status: build.status,
                commit: build.commit,
                error: build.error?.message || null,
                updatedAt: build.updated_at
            } : null
        });
    }

    async function repositoryRequest(route, url, options) {
        const prefix = repositoryPrefix(route);
        if (!route.remainder) return github(prefix, options);
        if (route.remainder === 'pages/status') return pagesStatus(route);
        if (route.remainder === 'tree') {
            const branch = url.searchParams.get('branch') || 'main';
            return github(`${prefix}/git/trees/${encodeURIComponent(branch)}?recursive=1`, options);
        }
        if (route.remainder.startsWith('contents/')) {
            const contentPath = route.remainder.slice('contents/'.length)
                .split('/')
                .map(segment => encodeURIComponent(decodeURIComponent(segment)))
                .join('/');
            const ref = url.searchParams.get('ref');
            const suffix = ref && (!options.method || options.method === 'GET') ? `?ref=${encodeURIComponent(ref)}` : '';
            return github(`${prefix}/contents/${contentPath}${suffix}`, options);
        }
        if (route.remainder === 'commits') return github(`${prefix}/commits${url.search}`, options);
        if (route.remainder === 'batch' && options.method === 'POST') {
            let payload;
            try { payload = JSON.parse(options.body || '{}'); } catch { return json({ message: 'Invalid batch payload' }, 400); }
            if (!payload || typeof payload.message !== 'string' || !payload.message.trim() || !Array.isArray(payload.changes) || payload.changes.length > 500) {
                return json({ message: 'Invalid batch publish request' }, 400);
            }
            const branch = payload.branch || 'main';
            const refResponse = await github(`${prefix}/git/ref/heads/${encodeURIComponent(branch)}`);
            if (!refResponse.ok) return refResponse;
            const ref = await refResponse.json();
            const commitResponse = await github(`${prefix}/git/commits/${encodeURIComponent(ref.object.sha)}`);
            if (!commitResponse.ok) return commitResponse;
            const baseCommit = await commitResponse.json();
            const treeEntries = [];
            for (const change of payload.changes) {
                if (!change || typeof change.path !== 'string' || typeof change.content !== 'string') return json({ message: 'Invalid batch file' }, 400);
                const blobResponse = await github(`${prefix}/git/blobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: change.content, encoding: 'base64' }) });
                if (!blobResponse.ok) return blobResponse;
                const blob = await blobResponse.json();
                treeEntries.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha });
            }
            const treeResponse = await github(`${prefix}/git/trees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }) });
            if (!treeResponse.ok) return treeResponse;
            const tree = await treeResponse.json();
            const newCommitResponse = await github(`${prefix}/git/commits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: payload.message.trim(), tree: tree.sha, parents: [ref.object.sha] }) });
            if (!newCommitResponse.ok) return newCommitResponse;
            const newCommit = await newCommitResponse.json();
            const updateResponse = await github(`${prefix}/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sha: newCommit.sha, force: false }) });
            if (!updateResponse.ok) return updateResponse;
            return json({ status: 'published', sha: newCommit.sha, commit: newCommit });
        }
        return json({ message: 'Unsupported static API route' }, 404);
    }

    async function staticFetch(input, options = {}) {
        const rawUrl = typeof input === 'string' ? input : input.url;
        const url = new URL(rawUrl, global.location.href);
        if (!url.pathname.startsWith('/api/')) return nativeFetch(input, options);

        if (url.pathname === '/api/auth/github/status') {
            return json({ configured: true, authenticated: Boolean(accessToken && currentUser), user: currentUser });
        }
        if (url.pathname === '/api/auth/github/logout') {
            accessToken = null;
            currentUser = null;
            return new Response(null, { status: 204 });
        }
        if (url.pathname === '/api/github/repositories') {
            if (!accessToken) return json({ message: 'GitHub token required' }, 401);
            return listRepositories();
        }
        const route = repositoryRoute(url.pathname);
        if (route) return repositoryRequest(route, url, options);
        return json({ message: 'This operation requires the server edition' }, 501);
    }

    async function connect(token) {
        const candidate = String(token || '').trim();
        if (!candidate) throw new Error('Enter a fine-grained personal access token');
        accessToken = candidate;
        try {
            const response = await github('/user');
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(errorMessage(payload, `GitHub rejected the token (${response.status})`));
            currentUser = payload;
            return payload;
        } catch (error) {
            accessToken = null;
            currentUser = null;
            throw error;
        }
    }

    function openTokenSettings() {
        global.open('https://github.com/settings/personal-access-tokens/new', '_blank', 'noopener,noreferrer');
    }

    global.GhpStaticApi = Object.freeze({ connect, openTokenSettings });
    global.fetch = staticFetch;

    global.addEventListener('DOMContentLoaded', () => {
        document.documentElement.dataset.runtime = 'github-pages';
        const credentials = document.getElementById('staticGithubCredentials');
        const serverDescription = document.getElementById('serverGithubDescription');
        if (credentials) credentials.hidden = false;
        if (serverDescription) serverDescription.hidden = true;
        const tagline = document.querySelector('.tagline');
        if (tagline) tagline.textContent = 'Static GitHub Pages edition · direct browser-to-GitHub editing';
        const welcome = document.querySelector('.welcome-content > p');
        if (welcome) welcome.textContent = 'Edit locally or connect a repository-scoped GitHub token. No application server is required.';
        const connectButton = document.getElementById('connectGithubSubmit');
        if (connectButton) connectButton.textContent = 'Connect with token';
        const cloneButton = document.getElementById('openCloneModalBtn');
        if (cloneButton) {
            cloneButton.disabled = true;
            cloneButton.title = 'Repository cloning requires the server edition; connect through GitHub instead.';
        }
    });
})(window);
