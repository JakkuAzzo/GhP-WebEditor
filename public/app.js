const AppState = {
    githubAuthenticated: false,
    copilotToken: null,
    copilotEndpoint: 'https://copilot-proxy.githubusercontent.com/v1/chat/completions',
    currentUser: null,
    currentRepo: null,
    currentBranch: 'main',
    repositories: [],
    files: [],
    fileStructure: null,
    currentFile: null,
    openTabs: [],
    editor: null,
    focusedDirectory: '',
    breadcrumbs: [''],
    selectedFiles: new Set(),
    searchQuery: '',
    plugins: [],
    clones: {}, // id -> { id, url, branch }
    currentCloneId: null,
    collaboration: {
        sessionId: null,
        channel: null,
        participants: new Map()
    },
    guiMode: 'code',
    selectedGuiElement: null,
    fileCache: {},
    assetCache: {},
    lastBroadcast: 0,
    uiTheme: localStorage.getItem('uiTheme') || 'dark',
    codeTheme: localStorage.getItem('codeTheme') || 'monokai',
    suppressBroadcast: false
};

const FILE_TEMPLATES = {
    blank: '',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Landing Page</title>
    <style>
        :root { color-scheme: light; font-family: Inter, system-ui, sans-serif; }
        body { margin: 0; color: #161b22; background: #f6f8fa; }
        .hero { padding: 5rem 2rem; text-align: center; color: white; background: linear-gradient(135deg, #0969da, #8250df); }
        .hero button { padding: .8rem 1.4rem; border: 0; border-radius: 999px; font-weight: 700; }
        .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 1rem; max-width: 64rem; margin: 0 auto; padding: 2rem; }
        .features article { padding: 1.25rem; border: 1px solid #d0d7de; border-radius: .75rem; background: white; }
    </style>
</head>
<body>
    <header class="hero">
        <h1>Welcome!</h1>
        <p>Build something remarkable.</p>
        <button>Get Started</button>
    </header>
    <section class="features">
        <article>
            <h2>Feature One</h2>
            <p>Explain the value proposition.</p>
        </article>
        <article>
            <h2>Feature Two</h2>
            <p>Highlight another benefit.</p>
        </article>
    </section>
</body>
</html>`,
    css: `:root {
    --accent: #2f81f7;
    --bg: #ffffff;
    --text: #161b22;
}
body {
    margin: 0;
    font-family: 'Inter', sans-serif;
    color: var(--text);
    background: var(--bg);
}
.hero {
    padding: 4rem 2rem;
    text-align: center;
    background: linear-gradient(135deg, var(--accent), #6b9eff);
    color: #fff;
}
button {
    padding: 0.8rem 1.6rem;
    border-radius: 999px;
    border: none;
    font-weight: 600;
}
`,
    js: `document.addEventListener('DOMContentLoaded', () => {
    console.log('Welcome to GhP WebEditor Pro!');
});`,
    md: `# Welcome

Start documenting your GitHub Pages project.
`
};

function sanitizeEditorHtml(html) {
    return GhpWorkspacePreview.sanitizeBodyHtml(html);
}

function appendTextMessage(container, text, className = '') {
    const message = document.createElement('div');
    message.className = className;
    message.textContent = text;
    container.appendChild(message);
    return message;
}

function encodeGitHubPath(filePath) {
    return filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function decodeGitHubContent(content) {
    const bytes = Uint8Array.from(atob(content.replace(/\s/g, '')), character => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function assetMimeType(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    return {
        apng: 'image/apng', avif: 'image/avif', gif: 'image/gif', ico: 'image/x-icon',
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp',
        woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
        mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm'
    }[extension] || 'application/octet-stream';
}

function utf8ToBase64(content) {
    const bytes = new TextEncoder().encode(content);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
}

const PluginManager = {
    register(plugin, sourceCode = '') {
        if (!plugin || !plugin.id) {
            console.warn('Plugin requires an id');
            return;
        }
        if (AppState.plugins.find(p => p.id === plugin.id)) {
            console.warn('Plugin already registered:', plugin.id);
            return;
        }
        plugin.__source = sourceCode;
        AppState.plugins.push(plugin);
        persistPlugins();
        renderPlugins();
        plugin.onRegister?.({ editor: AppState.editor, app: AppState });
    },
    runHook(hook, payload) {
        AppState.plugins.forEach(plugin => {
            try {
                plugin[hook]?.(payload);
            } catch (error) {
                console.error(`Plugin ${plugin.id} hook error`, error);
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initializeEditor();
    initializeGuiEditor();
    initializeThemes();
    initializeCollaboration();
    initializeCopilotPanel();
    setupEventListeners();
    loadStateFromLocalStorage();
    refreshFileStructure();
    renderFileTree();
    updateBreadcrumbs(AppState.focusedDirectory);

    authenticateWithGitHub();

    const urlSession = new URLSearchParams(window.location.search).get('session');
    if (urlSession) {
        joinCollaborationSession(urlSession);
    }
});

function initializeEditor() {
    const editorElement = document.getElementById('editor');
    AppState.editor = CodeMirror.fromTextArea(editorElement, {
        mode: 'htmlmixed',
        theme: AppState.codeTheme,
        lineNumbers: true,
        lineWrapping: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 2,
        tabSize: 2,
        extraKeys: {
            'Ctrl-Space': 'autocomplete',
            'Cmd-Space': 'autocomplete',
            'Ctrl-P': () => document.getElementById('fileSearchInput').focus(),
            'Cmd-P': () => document.getElementById('fileSearchInput').focus(),
            'Shift-Ctrl-F': openSearchModal,
            'Shift-Cmd-F': openSearchModal
        }
    });

    AppState.editor.on('change', () => {
        if (AppState.currentFile) {
            AppState.currentFile.content = AppState.editor.getValue();
            AppState.currentFile.modified = true;
            document.getElementById('fileStatus').textContent = 'Unsaved';
            updateCurrentTab();
            if (AppState.suppressBroadcast) {
                AppState.suppressBroadcast = false;
            } else {
                broadcastEditorChange();
            }
            PluginManager.runHook('onDocumentChange', {
                file: AppState.currentFile,
                content: AppState.editor.getValue()
            });
        }
    });

    AppState.editor.on('inputRead', (cm, change) => {
        if (change.text[0] && /[\w<\.]/.test(change.text[0])) {
            cm.showHint({ completeSingle: false });
        }
    });
}

function initializeGuiEditor() {
    const paletteItems = document.querySelectorAll('.palette-item');
    const guiCanvas = document.getElementById('guiCanvas');

    paletteItems.forEach(item => {
        item.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', item.dataset.snippet);
        });
    });

    guiCanvas.addEventListener('dragover', e => e.preventDefault());
    guiCanvas.addEventListener('drop', e => {
        e.preventDefault();
        if (AppState.draggedGuiElement) {
            const target = topLevelGuiElement(e.target, guiCanvas);
            if (target && target !== AppState.draggedGuiElement) {
                target.parentNode.insertBefore(AppState.draggedGuiElement, target);
            } else if (!target) {
                guiCanvas.appendChild(AppState.draggedGuiElement);
            }
            AppState.draggedGuiElement = null;
            prepareGuiCanvas();
            return;
        }
        const snippet = e.dataTransfer.getData('text/plain');
        if (snippet) {
            guiCanvas.insertAdjacentHTML('beforeend', snippet);
            prepareGuiCanvas();
        }
    });

    guiCanvas.addEventListener('click', event => {
        const element = event.target instanceof Element && event.target !== guiCanvas ? event.target : null;
        if (element) selectGuiElement(element);
    });
    guiCanvas.addEventListener('dragstart', event => {
        const element = topLevelGuiElement(event.target, guiCanvas);
        if (!element) return;
        AppState.draggedGuiElement = element;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-ghp-gui-block', 'move');
    });
    guiCanvas.addEventListener('dragend', () => { AppState.draggedGuiElement = null; });

    document.getElementById('moveGuiUp').addEventListener('click', () => moveSelectedGuiElement(-1));
    document.getElementById('moveGuiDown').addEventListener('click', () => moveSelectedGuiElement(1));
    document.getElementById('deleteGuiElement').addEventListener('click', deleteSelectedGuiElement);

    document.getElementById('applyGuiChanges').addEventListener('click', () => {
        if (!AppState.currentFile) return;
        const html = GhpWorkspacePreview.applyVisualBody(AppState.editor.getValue(), cleanGuiCanvasHtml());
        AppState.editor.setValue(html);
        switchEditorMode('code');
    });

    document.getElementById('resetGuiCanvas').addEventListener('click', () => {
        if (!AppState.currentFile) return;
        guiCanvas.innerHTML = GhpWorkspacePreview.visualBody(AppState.editor.getValue());
        prepareGuiCanvas();
    });
}

function topLevelGuiElement(target, canvas) {
    if (!(target instanceof Element) || target === canvas || !canvas.contains(target)) return null;
    let element = target;
    while (element.parentElement && element.parentElement !== canvas) element = element.parentElement;
    return element.parentElement === canvas ? element : null;
}

function selectGuiElement(element) {
    if (AppState.selectedGuiElement) AppState.selectedGuiElement.classList.remove('gui-selected');
    AppState.selectedGuiElement = element;
    element?.classList.add('gui-selected');
}

function prepareGuiCanvas() {
    const canvas = document.getElementById('guiCanvas');
    selectGuiElement(null);
    [...canvas.children].forEach(element => element.setAttribute('draggable', 'true'));
}

function moveSelectedGuiElement(direction) {
    const element = AppState.selectedGuiElement;
    if (!element) return;
    if (direction < 0 && element.previousElementSibling) {
        element.parentNode.insertBefore(element, element.previousElementSibling);
    } else if (direction > 0 && element.nextElementSibling) {
        element.parentNode.insertBefore(element.nextElementSibling, element);
    }
}

function deleteSelectedGuiElement() {
    const element = AppState.selectedGuiElement;
    if (!element) return;
    element.remove();
    AppState.selectedGuiElement = null;
}

function cleanGuiCanvasHtml() {
    const clone = document.getElementById('guiCanvas').cloneNode(true);
    clone.querySelectorAll('.gui-selected').forEach(element => element.classList.remove('gui-selected'));
    clone.querySelectorAll('[draggable]').forEach(element => element.removeAttribute('draggable'));
    clone.querySelectorAll('[contenteditable]').forEach(element => element.removeAttribute('contenteditable'));
    return clone.innerHTML;
}

function initializeThemes() {
    document.body.setAttribute('data-theme', AppState.uiTheme);
    document.getElementById('uiThemeSelect').value = AppState.uiTheme;
    document.getElementById('codeThemeSelect').value = AppState.codeTheme;
}

function initializeCollaboration() {
    if (!('BroadcastChannel' in window)) {
        document.getElementById('collabStatus').textContent = 'Collab unavailable';
        return;
    }
}

function initializeCopilotPanel() {
    if (AppState.copilotToken) {
        document.getElementById('copilotMessages').innerHTML = '<p class="copilot-message">Copilot is connected. Ask away!</p>';
    }
}

function setupEventListeners() {
    document.getElementById('openCloneModalBtn').addEventListener('click', () => showModal('repoCloneModal'));
    document.getElementById('cloneRepoSubmit').addEventListener('click', cloneRepositoryFromUrl);
    document.getElementById('cloneChangesBtn').addEventListener('click', openCloneChanges);
    document.getElementById('cloneCommitSubmit').addEventListener('click', commitCloneChanges);
    document.getElementById('githubConnectBtn').addEventListener('click', showGitHubAuthModal);
    document.getElementById('connectGithub').addEventListener('click', showGitHubAuthModal);
    document.getElementById('connectGithubSubmit').addEventListener('click', connectToGitHub);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.getElementById('newFileBtn').addEventListener('click', showNewFileModal);
    document.getElementById('createNewFile').addEventListener('click', showNewFileModal);
    document.getElementById('createFileSubmit').addEventListener('click', createNewFile);
    document.getElementById('newFolderBtn').addEventListener('click', showNewFolderModal);
    document.getElementById('createFolderSubmit').addEventListener('click', createNewFolder);
    document.getElementById('refreshBtn').addEventListener('click', refreshFileTree);

    document.getElementById('saveFileBtn').addEventListener('click', saveCurrentFile);
    document.getElementById('previewBtn').addEventListener('click', togglePreview);
    document.getElementById('togglePreviewPane').addEventListener('click', togglePreview);
    document.getElementById('deleteFileBtn').addEventListener('click', deleteCurrentFile);
    document.getElementById('downloadBtn').addEventListener('click', downloadProject);

    document.getElementById('repoSelect').addEventListener('change', e => {
        if (e.target.value === '__install__') {
            if (window.GhpStaticApi) window.GhpStaticApi.openTokenSettings();
            else window.location.assign('/api/auth/github/install');
            return;
        }
        if (e.target.value) {
            loadRepository(e.target.value);
        }
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', e => e.target.closest('.modal').classList.remove('active'));
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    document.getElementById('fileSearchInput').addEventListener('input', e => {
        AppState.searchQuery = e.target.value.trim().toLowerCase();
        renderFileTree();
    });

    document.getElementById('clearSearchBtn').addEventListener('click', () => {
        AppState.searchQuery = '';
        document.getElementById('fileSearchInput').value = '';
        renderFileTree();
    });

    document.getElementById('selectAllFiles').addEventListener('change', e => {
        if (e.target.checked) {
            AppState.selectedFiles = new Set(AppState.files.filter(f => f.type === 'file').map(f => f.path));
        } else {
            AppState.selectedFiles.clear();
        }
        renderFileTree();
    });

    document.getElementById('bulkDeleteBtn').addEventListener('click', bulkDeleteSelected);
    document.getElementById('bulkDownloadBtn').addEventListener('click', bulkDownloadSelected);
    document.getElementById('contentSearchBtn').addEventListener('click', openSearchModal);
    document.getElementById('runContentSearch').addEventListener('click', runContentSearch);

    document.getElementById('pluginManagerBtn').addEventListener('click', () => showModal('pluginModal'));
    document.getElementById('addPluginUrlBtn').addEventListener('click', addPluginFromUrl);
    document.getElementById('addPluginInlineBtn').addEventListener('click', addPluginFromCode);

    document.getElementById('commitHistoryBtn').addEventListener('click', loadCommitHistory);
    document.getElementById('diffViewerBtn').addEventListener('click', openDiffViewer);
    document.getElementById('diffViewerBtnInline').addEventListener('click', openDiffViewer);

    document.getElementById('copilotLoginBtn').addEventListener('click', () => showModal('copilotModal'));
    document.getElementById('copilotSaveBtn').addEventListener('click', saveCopilotSettings);
    document.getElementById('copilotSendBtn').addEventListener('click', sendCopilotPrompt);

    document.getElementById('codeModeBtn').addEventListener('click', () => switchEditorMode('code'));
    document.getElementById('guiModeBtn').addEventListener('click', () => switchEditorMode('gui'));

    document.getElementById('startCollabBtn').addEventListener('click', startCollaborationSession);
    document.getElementById('copyCollabLink').addEventListener('click', copyCollabLink);

    document.getElementById('copilotModal').addEventListener('keydown', e => e.stopPropagation());

    document.getElementById('uiThemeSelect').addEventListener('change', e => {
        AppState.uiTheme = e.target.value;
        localStorage.setItem('uiTheme', AppState.uiTheme);
        document.body.setAttribute('data-theme', AppState.uiTheme);
    });

    document.getElementById('codeThemeSelect').addEventListener('change', e => {
        AppState.codeTheme = e.target.value;
        localStorage.setItem('codeTheme', AppState.codeTheme);
        if (AppState.editor) {
            AppState.editor.setOption('theme', AppState.codeTheme);
        }
    });

    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentFile();
        }
    });
}
async function cloneRepositoryFromUrl() {
    const url = document.getElementById('repoUrl').value.trim();
    const shallow = document.getElementById('repoShallow').checked;
    const status = document.getElementById('cloneStatus');
    if (!url) {
        alert('Enter a repository URL');
        return;
    }
    status.textContent = 'Cloning...';
    try {
        const res = await fetch('/api/clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, shallow })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Clone failed');
        }
        const data = await res.json();
        AppState.clones[data.id] = data;
        AppState.currentCloneId = data.id;
        status.textContent = 'Cloned. Loading tree...';
        await loadClonedTree(data.id);
        document.getElementById('repoCloneModal').classList.remove('active');
        document.getElementById('repoUrl').value = '';
        status.textContent = '';
        alert('Repository cloned locally. You can browse files now.');
    } catch (error) {
        console.error(error);
        status.textContent = 'Clone failed: ' + (error.message || error);
    }
}

async function loadClonedTree(id) {
    const res = await fetch(`/api/clone/${id}/tree`);
    if (!res.ok) throw new Error('Failed to fetch tree');
    const data = await res.json();
    // Map into AppState.files schema
    const files = data.files.map(item => {
        if (item.type === 'file') {
            return {
                name: item.path.split('/').pop(),
                path: item.path,
                type: 'file',
                sha: null,
                cloneId: id,
                download_url: null // we will fetch via backend
            };
        }
        return { name: item.path.split('/').pop(), path: item.path, type: 'dir', cloneId: id };
    });
    AppState.files = files;
    AppState.fileCache = {};
    AppState.assetCache = {};
    AppState.currentRepo = null; // disconnect GitHub context for clarity
    AppState.currentBranch = 'unknown';
    refreshFileStructure();
    renderFileTree();
    updateWorkspaceBadge('Local Clone');
}

function updateWorkspaceBadge(label) {
    const repoSelect = document.getElementById('repoSelect');
    if (label) {
        document.getElementById('pagesStatus').hidden = true;
        repoSelect.value = '';
        repoSelect.style.display = 'none';
        let badge = document.getElementById('workspaceBadge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'workspaceBadge';
            badge.className = 'workspace-badge';
            repoSelect.parentNode.appendChild(badge);
        }
        badge.textContent = `📂 ${label}`;
        badge.style.display = 'block';
        document.getElementById('cloneChangesBtn').style.display = 'inline-flex';
    } else {
        const badge = document.getElementById('workspaceBadge');
        if (badge) badge.style.display = 'none';
        repoSelect.style.display = 'block';
        document.getElementById('cloneChangesBtn').style.display = 'none';
    }
}

async function fetchFileContent(file) {
    if (Object.prototype.hasOwnProperty.call(AppState.fileCache, file.path)) {
        return AppState.fileCache[file.path];
    }
    if (file.content) return file.content;
    if (file.cloneId) {
        try {
            const params = new URLSearchParams({ path: file.path });
            const res = await fetch(`/api/clone/${file.cloneId}/file?` + params.toString());
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to load file');
            }
            const data = await res.json();
            if (data.tooLarge) {
                const msg = `File is too large to preview (${data.size} bytes).`;
                AppState.fileCache[file.path] = msg;
                return msg;
            }
            AppState.fileCache[file.path] = data.content || '';
            return data.content || '';
        } catch (error) {
            console.error('fetchFileContent error for cloned file:', file.path, error);
            return `// Error loading file: ${error.message}`;
        }
    }
    if (file.githubPath && AppState.currentRepo && AppState.githubAuthenticated) {
        const path = encodeGitHubPath(file.githubPath);
        const params = new URLSearchParams({ ref: AppState.currentBranch });
        const res = await fetch(`/api/github/repos/${AppState.currentRepo}/contents/${path}?${params}`);
        if (!res.ok) throw new Error(`GitHub file request failed (${res.status})`);
        const data = await res.json();
        if (data.encoding !== 'base64' || typeof data.content !== 'string') {
            throw new Error('GitHub file is not available as editable text');
        }
        const text = decodeGitHubContent(data.content);
        AppState.fileCache[file.path] = text;
        return text;
    }
    return '';
}

async function fetchFileAsset(file) {
    const workspace = file.cloneId || AppState.currentRepo || 'local';
    const cacheKey = `${workspace}:${file.path}`;
    if (AppState.assetCache[cacheKey]) return AppState.assetCache[cacheKey];
    const base64 = await fetchFileBase64(file);
    if (!base64) return null;
    const dataUrl = `data:${assetMimeType(file.path)};base64,${base64}`;
    AppState.assetCache[cacheKey] = dataUrl;
    return dataUrl;
}

async function fetchFileBase64(file) {
    if (typeof file.content === 'string') return utf8ToBase64(file.content);
    if (file.cloneId) {
        const params = new URLSearchParams({ path: file.path, encoding: 'base64' });
        const response = await fetch(`/api/clone/${file.cloneId}/file?${params}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.tooLarge || data.encoding !== 'base64') return null;
        return data.content;
    }
    if (file.githubPath && AppState.currentRepo && AppState.githubAuthenticated) {
        const path = encodeGitHubPath(file.githubPath);
        const params = new URLSearchParams({ ref: AppState.currentBranch });
        const response = await fetch(`/api/github/repos/${AppState.currentRepo}/contents/${path}?${params}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.encoding !== 'base64' || typeof data.content !== 'string') return null;
        return data.content.replace(/\s/g, '');
    }
    return null;
}

function base64ToBytes(content) {
    const binary = atob(content);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function showModal(id) {
    document.getElementById(id).classList.add('active');
}

function showGitHubAuthModal() {
    showModal('githubAuthModal');
}

async function connectToGitHub() {
    if (window.GhpStaticApi) {
        const button = document.getElementById('connectGithubSubmit');
        const input = document.getElementById('staticGithubToken');
        button.disabled = true;
        button.textContent = 'Connecting…';
        try {
            await window.GhpStaticApi.connect(input.value);
            input.value = '';
            document.getElementById('githubAuthModal').classList.remove('active');
            await authenticateWithGitHub();
        } catch (error) {
            alert(`GitHub connection failed: ${error.message}`);
        } finally {
            button.disabled = false;
            button.textContent = 'Connect GitHub';
        }
        return;
    }
    document.getElementById('githubAuthModal').classList.remove('active');
    window.location.assign('/api/auth/github/start');
}

async function authenticateWithGitHub() {
    try {
        const response = await fetch('/api/auth/github/status');
        if (!response.ok) throw new Error('Authentication status failed');
        const status = await response.json();
        if (!status.configured) {
            const connect = document.getElementById('githubConnectBtn');
            connect.disabled = true;
            connect.title = 'Configure GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, and GITHUB_APP_SLUG';
            return;
        }
        if (!status.authenticated) return;
        AppState.githubAuthenticated = true;
        AppState.currentUser = status.user;
        updateUserInfo();
        await loadRepositories();
    } catch (error) {
        console.error('GitHub authentication error:', error);
        alert('Failed to restore the GitHub login. Please sign in again.');
    }
}

function updateUserInfo() {
    document.getElementById('githubConnectBtn').style.display = 'none';
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userAvatar').src = AppState.currentUser.avatar_url;
    document.getElementById('userName').textContent = AppState.currentUser.login;
}

async function logout() {
    await fetch('/api/auth/github/logout', { method: 'POST' }).catch(() => {});
    AppState.githubAuthenticated = false;
    AppState.currentUser = null;
    AppState.repositories = [];
    document.getElementById('githubConnectBtn').style.display = 'flex';
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('repoSelect').innerHTML = '<option value="">Select a repository...</option>';
}

async function loadRepositories() {
    try {
        const response = await fetch('/api/github/repositories');
        if (!response.ok) throw new Error(`GitHub repositories request failed (${response.status})`);
        AppState.repositories = await response.json();
        if (!Array.isArray(AppState.repositories)) throw new Error('GitHub returned an invalid repository list');
        const repoSelect = document.getElementById('repoSelect');
        repoSelect.innerHTML = '<option value="">Select a repository...</option>';
        AppState.repositories.forEach(repo => {
            const option = document.createElement('option');
            option.value = repo.full_name;
            option.textContent = repo.full_name;
            repoSelect.appendChild(option);
        });
        const accessOption = document.createElement('option');
        accessOption.value = '__install__';
        accessOption.textContent = AppState.repositories.length ? 'Manage repository access…' : 'Choose repositories on GitHub…';
        repoSelect.appendChild(accessOption);
    } catch (error) {
        console.error('Failed to load repositories:', error);
    }
}

async function loadRepository(repoFullName) {
    AppState.currentRepo = repoFullName;
    AppState.currentCloneId = null;
    updateWorkspaceBadge(null);
    try {
        const repoInfoRes = await fetch(`/api/github/repos/${repoFullName}`);
        if (!repoInfoRes.ok) throw new Error(`Repository request failed (${repoInfoRes.status})`);
        const repoInfo = await repoInfoRes.json();
        AppState.currentBranch = repoInfo.default_branch || 'main';

        const treeRes = await fetch(`/api/github/repos/${repoFullName}/tree?branch=${encodeURIComponent(AppState.currentBranch)}`);
        if (!treeRes.ok) throw new Error(`Repository tree request failed (${treeRes.status})`);
        const treeData = await treeRes.json();
        if (treeData.truncated) throw new Error('Repository tree is too large for the editor to load safely');
        const treeEntries = treeData.tree || [];
        const files = [];

        treeEntries.forEach(item => {
            if (item.type === 'blob') {
                files.push({
                    name: item.path.split('/').pop(),
                    path: item.path,
                    type: 'file',
                    sha: item.sha,
                    githubPath: item.path
                });
            } else if (item.type === 'tree') {
                files.push({
                    name: item.path.split('/').pop(),
                    path: item.path,
                    type: 'dir',
                    sha: item.sha
                });
            }
        });

        AppState.files = files;
        AppState.fileCache = {};
        AppState.assetCache = {};
        refreshFileStructure();
        renderFileTree();
        saveStateToLocalStorage();
        loadPagesStatus(repoFullName);
    } catch (error) {
        console.error('Failed to load repository contents:', error);
        alert('Failed to load repository contents');
    }
}

async function loadPagesStatus(repoFullName = AppState.currentRepo) {
    const panel = document.getElementById('pagesStatus');
    if (!repoFullName || !AppState.githubAuthenticated) {
        panel.hidden = true;
        return;
    }
    panel.hidden = false;
    panel.textContent = `Editing ${repoFullName} on ${AppState.currentBranch}. Checking GitHub Pages…`;
    try {
        const response = await fetch(`/api/github/repos/${repoFullName}/pages/status`);
        if (response.status === 403) {
            const credential = window.GhpStaticApi ? 'fine-grained token' : 'GitHub App';
            panel.textContent = `Editing ${repoFullName} on ${AppState.currentBranch}. Grant the ${credential} Pages: read permission to verify deployment.`;
            return;
        }
        if (!response.ok) throw new Error(`Pages status failed (${response.status})`);
        const status = await response.json();
        panel.replaceChildren();
        const workspace = document.createElement('strong');
        workspace.textContent = `${repoFullName} · ${AppState.currentBranch}`;
        panel.appendChild(workspace);
        if (!status.configured) {
            panel.appendChild(document.createElement('br'));
            panel.append('GitHub Pages is not configured for this repository.');
            return;
        }
        const source = status.source ? `${status.source.branch}${status.source.path || ''}` : status.buildType || 'GitHub Actions';
        panel.appendChild(document.createElement('br'));
        panel.append(`Pages source: ${source}. Build: ${status.build?.status || 'status unavailable'}. `);
        if (AppState.lastGitHubCommitSha && status.build?.commit !== AppState.lastGitHubCommitSha) {
            panel.append('The latest saved commit is awaiting deployment. ');
        }
        if (status.url) {
            const link = document.createElement('a');
            link.href = status.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Open published site';
            panel.appendChild(link);
        }
    } catch (error) {
        panel.textContent = `Editing ${repoFullName} on ${AppState.currentBranch}. ${error.message}`;
    }
}

function refreshFileStructure() {
    const root = { name: 'root', path: '', type: 'dir', children: [] };
    const nodes = { '': root };

    AppState.files.forEach(item => {
        const parts = item.path.split('/');
        let currentPath = '';
        parts.forEach((part, index) => {
            const isLast = index === parts.length - 1;
            const segmentPath = parts.slice(0, index + 1).join('/');
            const parentPath = parts.slice(0, index).join('/');
            const parentNode = nodes[parentPath || ''];
            if (!parentNode) return;

            if (!nodes[segmentPath]) {
                const node = {
                    name: part,
                    path: segmentPath,
                    type: isLast ? item.type : 'dir',
                    children: []
                };
                parentNode.children.push(node);
                nodes[segmentPath] = node;
            }
        });
    });

    AppState.fileStructure = root;
    updateBreadcrumbs(AppState.focusedDirectory);
}

function renderFileTree() {
    const fileTree = document.getElementById('fileTree');
    if (!AppState.fileStructure || !AppState.fileStructure.children.length) {
        fileTree.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><p>No files yet. Create a new file or connect to GitHub.</p></div>`;
        return;
    }

    if (AppState.searchQuery) {
        const matches = AppState.files.filter(item => item.path.toLowerCase().includes(AppState.searchQuery));
        if (matches.length === 0) {
            fileTree.innerHTML = '';
            appendTextMessage(fileTree, `No matches for "${AppState.searchQuery}"`, 'empty-state');
            return;
        }
        fileTree.innerHTML = '';
        matches.forEach(match => {
            const row = document.createElement('div');
            row.className = `file-tree-item ${match.type}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'file-checkbox';
            checkbox.checked = AppState.selectedFiles.has(match.path);
            checkbox.dataset.path = match.path;
            const icon = document.createElement('i');
            icon.className = `fas ${match.type === 'dir' ? 'fa-folder' : getFileIcon(match.name)}`;
            const label = document.createElement('span');
            label.textContent = match.path;
            row.append(checkbox, icon, label);
            row.addEventListener('click', e => {
                if (e.target.classList.contains('file-checkbox')) return;
                if (match.type === 'dir') {
                    AppState.focusedDirectory = match.path;
                    updateBreadcrumbs(match.path);
                    renderFileTree();
                } else {
                    openFile(match);
                }
            });
            row.querySelector('.file-checkbox').addEventListener('click', e => {
                toggleFileSelection(match.path, e.target.checked);
            });
            fileTree.appendChild(row);
        });
        return;
    }

    const focusNode = findNodeByPath(AppState.focusedDirectory);
    if (!focusNode) return;
    fileTree.innerHTML = '';
    focusNode.children.sort((a, b) => a.path.localeCompare(b.path)).forEach(child => {
        fileTree.appendChild(renderTreeNode(child));
    });
    updateFolderSummary(focusNode);
}

function renderTreeNode(node) {
    const wrapper = document.createElement('div');
    wrapper.className = `file-tree-item ${node.type}`;
    const isSelected = AppState.selectedFiles.has(node.path);
    const icon = node.type === 'dir' ? 'fa-folder' : getFileIcon(node.name);
    const toggle = document.createElement('span');
    toggle.className = 'folder-toggle';
    if (node.type === 'dir') {
        const toggleIcon = document.createElement('i');
        toggleIcon.className = 'fas fa-chevron-right';
        toggle.appendChild(toggleIcon);
    }
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'file-checkbox';
    checkbox.dataset.path = node.path;
    checkbox.checked = isSelected;
    const fileIcon = document.createElement('i');
    fileIcon.className = `fas ${icon}`;
    const label = document.createElement('span');
    label.textContent = node.name || 'root';
    wrapper.append(toggle, checkbox, fileIcon, label);

    wrapper.addEventListener('click', e => {
        if (e.target.classList.contains('file-checkbox')) return;
        if (node.type === 'dir') {
            AppState.focusedDirectory = node.path;
            updateBreadcrumbs(node.path);
            renderFileTree();
        } else {
            const file = AppState.files.find(f => f.path === node.path);
            openFile(file);
        }
    });

    wrapper.querySelector('.file-checkbox').addEventListener('change', e => {
        toggleFileSelection(node.path, e.target.checked);
    });

    if (node.type === 'dir' && node.children && node.children.length) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'folder-children';
        node.children.forEach(child => {
            childrenContainer.appendChild(renderTreeNode(child));
        });
        wrapper.appendChild(childrenContainer);
    }

    return wrapper;
}

function findNodeByPath(path) {
    if (!AppState.fileStructure) return null;
    if (!path) return AppState.fileStructure;
    const parts = path.split('/');
    let current = AppState.fileStructure;
    for (const part of parts) {
        current = current.children?.find(child => child.name === part);
        if (!current) break;
    }
    return current;
}

function toggleFileSelection(path, selected) {
    if (selected) {
        AppState.selectedFiles.add(path);
    } else {
        AppState.selectedFiles.delete(path);
    }
}

function updateBreadcrumbs(path) {
    if (path && !findNodeByPath(path)) {
        path = '';
        AppState.focusedDirectory = '';
    }
    const breadcrumbs = document.getElementById('breadcrumbs');
    breadcrumbs.innerHTML = '';
    const segments = path ? path.split('/') : [];
    const paths = [''];
    segments.reduce((acc, segment) => {
        const newPath = acc ? `${acc}/${segment}` : segment;
        paths.push(newPath);
        return newPath;
    }, '');

    paths.forEach((segmentPath, index) => {
        const label = index === 0 ? 'root' : segmentPath.split('/').pop();
        const span = document.createElement('span');
        span.className = `breadcrumb ${segmentPath === path ? 'active' : ''}`;
        span.dataset.path = segmentPath;
        span.textContent = label;
        span.addEventListener('click', () => {
            AppState.focusedDirectory = segmentPath;
            updateBreadcrumbs(segmentPath);
            renderFileTree();
        });
        breadcrumbs.appendChild(span);
    });
}

function updateFolderSummary(node) {
    const summary = document.getElementById('folderSummary');
    if (!node || node.path === '') {
        summary.textContent = 'Root directory. Total items: ' + node.children.length;
        return;
    }
    const files = node.children.filter(child => child.type === 'file').length;
    const folders = node.children.filter(child => child.type === 'dir').length;
    summary.textContent = `${node.path} → ${folders} folders, ${files} files`;
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        html: 'fa-file-code',
        css: 'fa-file-code',
        js: 'fa-file-code',
        json: 'fa-file-code',
        md: 'fa-file-alt',
        txt: 'fa-file-alt',
        jpg: 'fa-file-image',
        jpeg: 'fa-file-image',
        png: 'fa-file-image',
        gif: 'fa-file-image',
        pdf: 'fa-file-pdf',
        zip: 'fa-file-archive'
    };
    return iconMap[ext] || 'fa-file';
}

function showNewFileModal() {
    showModal('newFileModal');
    document.getElementById('newFileName').value = '';
}

function showNewFolderModal() {
    showModal('newFolderModal');
    document.getElementById('newFolderName').value = '';
}

function createNewFile() {
    const fileName = document.getElementById('newFileName').value.trim();
    const template = document.getElementById('fileTemplate').value;
    if (!fileName) {
        alert('Please enter a file name');
        return;
    }
    const path = AppState.focusedDirectory ? `${AppState.focusedDirectory}/${fileName}` : fileName;
    if (AppState.files.find(f => f.path === path)) {
        alert('File already exists');
        return;
    }
    const newFile = {
        name: fileName,
        path,
        type: 'file',
        content: FILE_TEMPLATES[template] || '',
        modified: true,
        isNew: true,
        cloneId: AppState.currentCloneId || null
    };
    AppState.files.push(newFile);
    refreshFileStructure();
    renderFileTree();
    saveStateToLocalStorage();
    openFile(newFile);
    document.getElementById('newFileModal').classList.remove('active');
}

async function createNewFolder() {
    const folderName = document.getElementById('newFolderName').value.trim();
    if (!folderName) {
        alert('Please enter a folder name');
        return;
    }
    const path = AppState.focusedDirectory ? `${AppState.focusedDirectory}/${folderName}` : folderName;
    if (AppState.files.find(f => f.path === path)) {
        alert('Folder already exists');
        return;
    }
    if (AppState.currentCloneId) {
        const response = await fetch(`/api/clone/${AppState.currentCloneId}/directory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            alert(`Folder creation failed: ${body.error || 'Unknown error'}`);
            return;
        }
    }
    AppState.files.push({ name: folderName, path, type: 'dir', isNew: true, cloneId: AppState.currentCloneId || null });
    refreshFileStructure();
    renderFileTree();
    saveStateToLocalStorage();
    document.getElementById('newFolderModal').classList.remove('active');
}

async function openFile(file) {
    if (!file || file.type === 'dir') {
        AppState.focusedDirectory = file?.path || '';
        updateBreadcrumbs(AppState.focusedDirectory);
        renderFileTree();
        return;
    }

    if (typeof file.content !== 'string') {
        file.content = await fetchFileContent(file);
    }
    if (!file.baseContent) {
        file.baseContent = file.content || '';
    }

    const existingTab = AppState.openTabs.find(tab => tab.path === file.path);
    if (!existingTab) {
        AppState.openTabs.push(file);
    }
    AppState.currentFile = file;

    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('editorWrapper').style.display = 'flex';

    AppState.editor.setValue(file.content || '');
    const ext = file.name.split('.').pop().toLowerCase();
    setEditorMode(ext);
    updateCurrentFileName();
    document.getElementById('fileStatus').textContent = file.modified ? 'Unsaved' : 'Saved';
    renderTabs();
    document.getElementById('guiCanvas').innerHTML = GhpWorkspacePreview.visualBody(file.content || '');
    prepareGuiCanvas();
    PluginManager.runHook('onFileOpen', { file });
}

function setEditorMode(extension) {
    const modeMap = {
        html: 'htmlmixed',
        css: 'css',
        js: 'javascript',
        json: 'javascript',
        md: 'markdown',
        xml: 'xml'
    };
    AppState.editor.setOption('mode', modeMap[extension] || 'htmlmixed');
    AppState.editor.setOption('theme', AppState.codeTheme);
    document.getElementById('editorMode').textContent = extension.toUpperCase();
}

function updateCurrentFileName() {
    document.getElementById('currentFileName').textContent = AppState.currentFile?.name || 'Untitled';
}

function renderTabs() {
    const tabsContainer = document.getElementById('editorTabs');
    tabsContainer.innerHTML = '';
    AppState.openTabs.forEach(file => {
        const tab = document.createElement('div');
        tab.className = 'editor-tab';
        if (file === AppState.currentFile) tab.classList.add('active');
        const label = document.createElement('span');
        label.textContent = `${file.name}${file.modified ? '*' : ''}`;
        const close = document.createElement('span');
        close.className = 'close-tab';
        close.dataset.path = file.path;
        close.textContent = '×';
        tab.append(label, close);
        tab.addEventListener('click', e => {
            if (!e.target.classList.contains('close-tab')) {
                switchToTab(file);
            }
        });
        tab.querySelector('.close-tab').addEventListener('click', e => {
            e.stopPropagation();
            closeTab(file);
        });
        tabsContainer.appendChild(tab);
    });
}

function switchToTab(file) {
    AppState.currentFile = file;
    AppState.editor.setValue(file.content || '');
    document.getElementById('guiCanvas').innerHTML = GhpWorkspacePreview.visualBody(file.content || '');
    prepareGuiCanvas();
    updateCurrentFileName();
    const ext = file.name.split('.').pop().toLowerCase();
    setEditorMode(ext);
    renderTabs();
}

function closeTab(file) {
    if (file.modified && !confirm(`${file.name} has unsaved changes. Close anyway?`)) {
        return;
    }
    const index = AppState.openTabs.indexOf(file);
    if (index !== -1) AppState.openTabs.splice(index, 1);
    if (AppState.currentFile === file) {
        if (AppState.openTabs.length > 0) {
            switchToTab(AppState.openTabs[AppState.openTabs.length - 1]);
        } else {
            AppState.currentFile = null;
            document.getElementById('editorWrapper').style.display = 'none';
            document.getElementById('welcomeScreen').style.display = 'flex';
        }
    }
    renderTabs();
}

function updateCurrentTab() {
    renderTabs();
}

async function saveCurrentFile() {
    if (!AppState.currentFile) return;
    const file = AppState.currentFile;
    file.content = AppState.editor.getValue();
    document.getElementById('fileStatus').textContent = 'Saving…';
    try {
        if (file.cloneId) {
            await saveCloneFile(file);
        } else if (AppState.githubAuthenticated && AppState.currentRepo) {
            await saveToGitHub(AppState.currentFile);
            file.isNew = false;
        } else {
            saveStateToLocalStorage();
        }
        file.modified = false;
        file.baseContent = file.content;
        AppState.fileCache[file.path] = file.content;
        document.getElementById('fileStatus').textContent = 'Saved';
        const index = AppState.files.findIndex(candidate => candidate.path === file.path);
        if (index !== -1) AppState.files[index] = file;
        PluginManager.runHook('onFileSave', { file });
        renderTabs();
    } catch (error) {
        file.modified = true;
        document.getElementById('fileStatus').textContent = 'Save failed';
        console.error('Failed to save file:', error);
        alert(`Save failed: ${error.message}`);
    }
}

async function saveCloneFile(file) {
    const response = await fetch(`/api/clone/${file.cloneId}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path, content: file.content })
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Clone save failed');
    }
}

async function saveToGitHub(file) {
    const response = await fetch(`/api/github/repos/${AppState.currentRepo}/contents/${encodeGitHubPath(file.path)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Update ${file.name}`,
            content: btoa(unescape(encodeURIComponent(file.content))),
            sha: file.sha,
            branch: AppState.currentBranch
        })
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `GitHub save failed (${response.status})`);
    }
    const result = await response.json();
    if (!result.content?.sha) throw new Error('GitHub did not return the saved file revision');
    file.sha = result.content.sha;
    file.githubPath = file.path;
    AppState.lastGitHubCommitSha = result.commit?.sha || null;
    loadPagesStatus();
}

async function deleteCurrentFile() {
    if (!AppState.currentFile) return;
    const file = AppState.currentFile;
    if (!confirm(`Delete ${file.name}?`)) return;
    try {
        if (file.cloneId) {
            const params = new URLSearchParams({ path: file.path });
            const response = await fetch(`/api/clone/${file.cloneId}/file?${params}`, { method: 'DELETE' });
            if (!response.ok) throw new Error((await response.json()).error || 'Delete failed');
        } else if (AppState.currentRepo && AppState.githubAuthenticated && file.sha) {
            const response = await fetch(`/api/github/repos/${AppState.currentRepo}/contents/${encodeGitHubPath(file.path)}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: `Delete ${file.name}`, sha: file.sha, branch: AppState.currentBranch })
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.message || `GitHub delete failed (${response.status})`);
            }
        }
    } catch (error) {
        alert(`Delete failed: ${error.message}`);
        return;
    }
    AppState.files = AppState.files.filter(candidate => candidate.path !== file.path);
    AppState.selectedFiles.delete(file.path);
    refreshFileStructure();
    closeTab(file);
    renderFileTree();
    saveStateToLocalStorage();
}

async function togglePreview() {
    if (!AppState.currentFile) {
        alert('Open a file first');
        return;
    }
    const preview = document.getElementById('preview');
    const editorStack = preview.closest('.editor-stack');
    if (preview.style.display === 'none' || preview.style.display === '') {
        preview.style.display = 'flex';
        editorStack.classList.add('preview-open');
        const content = AppState.editor.getValue();
        const iframe = document.getElementById('previewFrame');
        (AppState.previewObjectUrls || []).forEach(url => URL.revokeObjectURL(url));
        AppState.previewObjectUrls = [];
        if (AppState.currentFile?.name.endsWith('.md')) {
            iframe.srcdoc = `<html><body>${marked.parse(content)}</body></html>`;
        } else {
            const preview = await GhpWorkspacePreview.composePreview(
                content,
                AppState.currentFile,
                AppState.files,
                fetchFileContent,
                fetchFileAsset
            );
            AppState.previewObjectUrls = preview.objectUrls;
            if (window.GhpStaticApi) {
                iframe.removeAttribute('src');
                iframe.srcdoc = preview.html;
            } else {
                iframe.removeAttribute('srcdoc');
                const response = await fetch('/api/preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ html: preview.html })
                });
                if (!response.ok) throw new Error('Unable to prepare the isolated preview');
                const prepared = await response.json();
                iframe.src = `/api/preview/${encodeURIComponent(prepared.id)}`;
            }
        }
    } else {
        preview.style.display = 'none';
        editorStack.classList.remove('preview-open');
    }
}

function refreshFileTree() {
    if (AppState.currentRepo && AppState.githubAuthenticated) {
        loadRepository(AppState.currentRepo);
    } else {
        refreshFileStructure();
        renderFileTree();
    }
}

async function downloadProject() {
    const button = document.getElementById('downloadBtn');
    const originalLabel = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Building ZIP…';
    try {
        const entries = {};
        for (const file of AppState.files.filter(candidate => candidate.type === 'file')) {
            const base64 = await fetchFileBase64(file);
            if (!base64) throw new Error(`Unable to include ${file.path}`);
            entries[file.path] = base64ToBytes(base64);
        }
        if (!Object.keys(entries).length) throw new Error('The workspace has no files to export');
        const archive = fflate.zipSync(entries, { level: 6 });
        const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }));
        const link = document.createElement('a');
        link.href = url;
        const projectName = (AppState.currentRepo?.split('/').pop() || 'github-pages-site').replace(/[^A-Za-z0-9._-]/g, '-');
        link.download = `${projectName}.zip`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        alert(`Export failed: ${error.message}`);
    } finally {
        button.disabled = false;
        button.innerHTML = originalLabel;
    }
}

async function bulkDeleteSelected() {
    if (!AppState.selectedFiles.size) {
        alert('Select files first');
        return;
    }
    const roots = [...AppState.selectedFiles];
    const targets = AppState.files.filter(file => roots.some(root => file.path === root || file.path.startsWith(`${root}/`)));
    if (!confirm(`Delete ${targets.length} workspace item${targets.length === 1 ? '' : 's'}?`)) return;
    try {
        for (const file of targets.filter(candidate => candidate.type === 'file')) {
            if (file.cloneId) {
                const params = new URLSearchParams({ path: file.path });
                const response = await fetch(`/api/clone/${file.cloneId}/file?${params}`, { method: 'DELETE' });
                if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Unable to delete ${file.path}`);
            } else if (AppState.currentRepo && AppState.githubAuthenticated && file.sha) {
                const response = await fetch(`/api/github/repos/${AppState.currentRepo}/contents/${encodeGitHubPath(file.path)}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: `Delete ${file.name}`, sha: file.sha, branch: AppState.currentBranch })
                });
                if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || `Unable to delete ${file.path}`);
            }
        }
        const cloneDirectories = targets
            .filter(candidate => candidate.type === 'dir' && candidate.cloneId)
            .sort((a, b) => b.path.split('/').length - a.path.split('/').length);
        for (const directory of cloneDirectories) {
            const params = new URLSearchParams({ path: directory.path });
            const response = await fetch(`/api/clone/${directory.cloneId}/directory?${params}`, { method: 'DELETE' });
            if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Unable to delete ${directory.path}`);
        }
    } catch (error) {
        alert(`Bulk delete failed: ${error.message}`);
        refreshFileTree();
        return;
    }
    const targetPaths = new Set(targets.map(file => file.path));
    AppState.files = AppState.files.filter(file => !targetPaths.has(file.path));
    AppState.openTabs = AppState.openTabs.filter(tab => !targetPaths.has(tab.path));
    if (AppState.currentFile && targetPaths.has(AppState.currentFile.path)) {
        AppState.currentFile = null;
        document.getElementById('editorWrapper').style.display = 'none';
        document.getElementById('welcomeScreen').style.display = 'flex';
    }
    AppState.selectedFiles.clear();
    refreshFileStructure();
    renderFileTree();
    renderTabs();
    saveStateToLocalStorage();
    if (AppState.currentRepo) loadPagesStatus();
}

async function bulkDownloadSelected() {
    if (!AppState.selectedFiles.size) {
        alert('Select files first');
        return;
    }
    const bundle = {};
    for (const path of AppState.selectedFiles) {
        const file = AppState.files.find(f => f.path === path);
        if (!file || file.type === 'dir') continue;
        const content = await fetchFileContent(file);
        bundle[path] = content;
    }
    const dataStr = JSON.stringify(bundle, null, 2);
    const link = document.createElement('a');
    link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    link.download = 'selected-files.json';
    link.click();
}

function openSearchModal() {
    showModal('searchModal');
}

async function runContentSearch() {
    const query = document.getElementById('contentSearchInput').value.trim();
    const resultsContainer = document.getElementById('searchResults');
    if (!query) {
        resultsContainer.innerHTML = '<p class="empty-state">Enter a query.</p>';
        return;
    }
    resultsContainer.innerHTML = '<p>Searching...</p>';
    const results = [];
    for (const file of AppState.files.filter(f => f.type === 'file')) {
        const content = await fetchFileContent(file);
        if (content && content.toLowerCase().includes(query.toLowerCase())) {
            const snippet = content.substr(content.toLowerCase().indexOf(query.toLowerCase()), 80);
            results.push({ file, snippet });
        }
    }
    if (!results.length) {
        resultsContainer.innerHTML = '<p class="empty-state">No matches.</p>';
        return;
    }
    resultsContainer.innerHTML = '';
    results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'search-result';
        const title = document.createElement('strong');
        title.textContent = result.file.path;
        const snippet = document.createElement('p');
        snippet.textContent = result.snippet;
        div.append(title, snippet);
        div.addEventListener('click', () => {
            document.getElementById('searchModal').classList.remove('active');
            openFile(result.file);
        });
        resultsContainer.appendChild(div);
    });
}

async function loadCommitHistory() {
    if (!AppState.currentRepo || !AppState.githubAuthenticated) {
        alert('Connect to a repository first');
        return;
    }
    showModal('commitModal');
    const list = document.getElementById('commitList');
    list.innerHTML = '<p>Loading commits...</p>';
    try {
        const filePath = AppState.currentFile?.path;
        const url = new URL(`/api/github/repos/${AppState.currentRepo}/commits`, window.location.origin);
        url.searchParams.set('sha', AppState.currentBranch);
        url.searchParams.set('per_page', '20');
        if (filePath) url.searchParams.set('path', filePath);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch commits');
        const commits = await response.json();
        list.innerHTML = '';
        commits.forEach(commit => {
            const item = document.createElement('div');
            item.className = 'commit-item';
            const title = document.createElement('strong');
            title.textContent = commit.commit.message;
            const author = document.createElement('p');
            author.textContent = `${commit.commit.author.name} · ${new Date(commit.commit.author.date).toLocaleString()}`;
            const sha = document.createElement('code');
            sha.textContent = commit.sha.slice(0, 7);
            item.append(title, author, sha);
            list.appendChild(item);
        });
    } catch (error) {
        console.error(error);
        list.innerHTML = '<p class="empty-state">Failed to load commits.</p>';
    }
}

async function openCloneChanges() {
    if (!AppState.currentCloneId) return;
    showModal('cloneChangesModal');
    const list = document.getElementById('cloneStatusList');
    list.textContent = 'Loading status…';
    try {
        const response = await fetch(`/api/clone/${AppState.currentCloneId}/status`);
        if (!response.ok) throw new Error('Unable to load status');
        const status = await response.json();
        list.innerHTML = '';
        if (!status.files.length) {
            appendTextMessage(list, 'Working tree is clean.', 'empty-state');
            return;
        }
        status.files.forEach(file => appendTextMessage(list, `${file.index}${file.working_dir} ${file.path}`, 'commit-item'));
    } catch (error) {
        list.textContent = error.message;
    }
}

async function commitCloneChanges() {
    if (!AppState.currentCloneId) return;
    const message = document.getElementById('cloneCommitMessage').value.trim();
    const authorName = document.getElementById('cloneAuthorName').value.trim();
    const authorEmail = document.getElementById('cloneAuthorEmail').value.trim();
    const response = await fetch(`/api/clone/${AppState.currentCloneId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, authorName, authorEmail })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        alert(body.error || 'Commit failed');
        return;
    }
    document.getElementById('cloneCommitMessage').value = '';
    await openCloneChanges();
    alert(`Committed ${body.sha.slice(0, 7)} locally.`);
}

function openDiffViewer() {
    if (!AppState.currentFile) {
        alert('Open a file first');
        return;
    }
    showModal('diffModal');
    const diffContainer = document.getElementById('diffContainer');
    const original = AppState.currentFile.baseContent || '';
    const current = AppState.editor.getValue();
    diffContainer.innerHTML = '';
    const diff = computeDiff(original, current);
    diff.forEach(part => {
        const line = document.createElement('div');
        line.className = `diff-line ${part.type}`;
        line.textContent = part.text;
        diffContainer.appendChild(line);
    });
}

function computeDiff(oldStr, newStr) {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');
    const table = Array(oldLines.length + 1).fill(null).map(() => Array(newLines.length + 1).fill(0));
    for (let i = 1; i <= oldLines.length; i++) {
        for (let j = 1; j <= newLines.length; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                table[i][j] = table[i - 1][j - 1] + 1;
            } else {
                table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
            }
        }
    }
    const diff = [];
    let i = oldLines.length;
    let j = newLines.length;
    while (i > 0 && j > 0) {
        if (oldLines[i - 1] === newLines[j - 1]) {
            diff.unshift({ type: 'same', text: `  ${oldLines[i - 1]}` });
            i--;
            j--;
        } else if (table[i - 1][j] >= table[i][j - 1]) {
            diff.unshift({ type: 'removed', text: `- ${oldLines[i - 1]}` });
            i--;
        } else {
            diff.unshift({ type: 'added', text: `+ ${newLines[j - 1]}` });
            j--;
        }
    }
    while (i > 0) {
        diff.unshift({ type: 'removed', text: `- ${oldLines[i - 1]}` });
        i--;
    }
    while (j > 0) {
        diff.unshift({ type: 'added', text: `+ ${newLines[j - 1]}` });
        j--;
    }
    return diff;
}

function switchEditorMode(mode) {
    if (mode === AppState.guiMode) return;
    AppState.guiMode = mode;
    document.getElementById('codeModeBtn').classList.toggle('active', mode === 'code');
    document.getElementById('guiModeBtn').classList.toggle('active', mode === 'gui');
    const cmElement = document.querySelector('.CodeMirror');
    if (cmElement) {
        cmElement.style.display = mode === 'code' ? 'block' : 'none';
    }
    document.getElementById('guiEditor').style.display = mode === 'gui' ? 'grid' : 'none';
    if (mode === 'gui' && AppState.currentFile) {
        document.getElementById('guiCanvas').innerHTML = GhpWorkspacePreview.visualBody(AppState.editor.getValue());
        prepareGuiCanvas();
    }
}

function startCollaborationSession() {
    if (!('BroadcastChannel' in window)) {
        alert('Collaboration not supported in this browser.');
        return;
    }
    const sessionId = AppState.collaboration.sessionId || crypto.randomUUID();
    joinCollaborationSession(sessionId);
    const link = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    document.getElementById('collabLink').value = link;
    document.getElementById('collabStatus').textContent = `Session ${sessionId.slice(0, 6)}`;
    showModal('collabModal');
}

function joinCollaborationSession(sessionId) {
    AppState.collaboration.sessionId = sessionId;
    if (AppState.collaboration.channel) {
        AppState.collaboration.channel.close();
    }
    AppState.collaboration.channel = new BroadcastChannel(`ghp-editor-${sessionId}`);
    AppState.collaboration.channel.onmessage = handleCollabMessage;
    AppState.collaboration.channel.postMessage({ type: 'JOIN', user: AppState.currentUser?.login || 'guest', timestamp: Date.now() });
    document.getElementById('collabStatus').textContent = `Session ${sessionId.slice(0, 6)}`;
    updateCollabParticipantsDisplay();
}

function handleCollabMessage(event) {
    const { type, content, filePath, user } = event.data;
    if (type === 'JOIN') {
        AppState.collaboration.participants.set(user, Date.now());
        updateCollabParticipantsDisplay();
    }
    if (type === 'CONTENT_UPDATE' && AppState.currentFile?.path === filePath) {
        if (Date.now() - AppState.lastBroadcast > 500) {
            AppState.suppressBroadcast = true;
            AppState.editor.setValue(content);
            AppState.currentFile.content = content;
            AppState.currentFile.modified = true;
            updateCurrentTab();
        }
    }
}

function updateCollabParticipantsDisplay() {
    if (!AppState.collaboration.participants.size) {
        document.getElementById('collabStatus').textContent = AppState.collaboration.sessionId
            ? `Session ${AppState.collaboration.sessionId.slice(0, 6)}`
            : 'Solo mode';
        return;
    }
    const names = Array.from(AppState.collaboration.participants.keys());
    document.getElementById('collabStatus').textContent = `Editing: ${names.join(', ')}`;
}

function broadcastEditorChange() {
    if (!AppState.collaboration.channel || !AppState.currentFile) return;
    if (Date.now() - AppState.lastBroadcast < 300) return;
    AppState.lastBroadcast = Date.now();
    AppState.collaboration.channel.postMessage({
        type: 'CONTENT_UPDATE',
        filePath: AppState.currentFile.path,
        content: AppState.editor.getValue(),
        user: AppState.currentUser?.login || 'guest'
    });
}

function copyCollabLink() {
    const link = document.getElementById('collabLink').value;
    navigator.clipboard.writeText(link);
    alert('Collaboration link copied!');
}

function saveCopilotSettings() {
    const token = document.getElementById('copilotToken').value.trim();
    if (!token) {
        alert('Token required');
        return;
    }
    AppState.copilotToken = token;
    document.getElementById('copilotToken').value = '';
    document.getElementById('copilotModal').classList.remove('active');
    document.getElementById('copilotMessages').innerHTML = '<p class="copilot-message">Copilot connected.</p>';
}

async function sendCopilotPrompt() {
    if (!AppState.copilotToken) {
        alert('Authenticate with Copilot first');
        return;
    }
    const prompt = document.getElementById('copilotPrompt').value.trim();
    if (!prompt) return;
    const messages = document.getElementById('copilotMessages');
    appendTextMessage(messages, prompt, 'copilot-message user');
    document.getElementById('copilotPrompt').value = '';
    try {
        const response = await fetch(AppState.copilotEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${AppState.copilotToken}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are GitHub Copilot inside GhP WebEditor.' },
                    { role: 'user', content: prompt }
                ]
            })
        });
        if (!response.ok) throw new Error('Copilot request failed');
        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content || 'No response';
        appendTextMessage(messages, answer, 'copilot-message assistant');
    } catch (error) {
        console.error(error);
        messages.innerHTML += '<div class="copilot-message assistant">Copilot unavailable. Check token/endpoint.</div>';
    }
}

async function addPluginFromUrl() {
    alert('Third-party plugins are disabled until sandboxing is available.');
}

function addPluginFromCode() {
    alert('Inline plugins are disabled until sandboxing is available.');
}

function renderPlugins() {
    const list = document.getElementById('pluginList');
    if (!list) return;
    if (!AppState.plugins.length) {
        list.innerHTML = '<p class="empty-state">No plugins registered yet.</p>';
        return;
    }
    list.innerHTML = '';
    AppState.plugins.forEach(plugin => {
        const card = document.createElement('div');
        card.className = 'plugin-card';
        const details = document.createElement('div');
        const title = document.createElement('strong');
        const description = document.createElement('p');
        title.textContent = plugin.name || plugin.id;
        description.textContent = plugin.description || '';
        details.append(title, description);
        card.appendChild(details);
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-small btn-danger';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
            AppState.plugins = AppState.plugins.filter(p => p.id !== plugin.id);
            persistPlugins();
            renderPlugins();
        });
        card.appendChild(removeBtn);
        list.appendChild(card);
    });
}

function persistPlugins() {
    const serialized = AppState.plugins.map(plugin => ({
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        source: plugin.__source || ''
    }));
    localStorage.setItem('pluginStore', JSON.stringify(serialized));
}

function loadPluginsFromStorage() {
    localStorage.removeItem('pluginStore');
}

function saveStateToLocalStorage() {
    const localProject = {
        files: AppState.files.filter(f => f.isNew),
        focusedDirectory: AppState.focusedDirectory
    };
    localStorage.setItem('localProject', JSON.stringify(localProject));
}

function loadStateFromLocalStorage() {
    const saved = localStorage.getItem('localProject');
    if (!saved) return;
    try {
        const parsed = JSON.parse(saved);
        if (parsed.files?.length) {
            AppState.files = parsed.files;
            refreshFileStructure();
            renderFileTree();
        }
        AppState.focusedDirectory = parsed.focusedDirectory || '';
        updateBreadcrumbs(AppState.focusedDirectory);
    } catch (error) {
        console.error('Failed to load state', error);
    }
}
