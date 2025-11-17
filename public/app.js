const AppState = {
    githubToken: localStorage.getItem('githubToken') || null,
    copilotToken: localStorage.getItem('copilotToken') || null,
    copilotEndpoint: localStorage.getItem('copilotEndpoint') || 'https://copilot-proxy.githubusercontent.com/v1/chat/completions',
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
    collaboration: {
        sessionId: null,
        channel: null,
        participants: new Map()
    },
    guiMode: 'code',
    fileCache: {},
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
    <link rel="stylesheet" href="styles.css" />
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
    loadPluginsFromStorage();
    refreshFileStructure();
    renderFileTree();
    updateBreadcrumbs(AppState.focusedDirectory);

    if (AppState.githubToken) {
        authenticateWithGitHub();
    }

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
        const snippet = e.dataTransfer.getData('text/plain');
        guiCanvas.insertAdjacentHTML('beforeend', snippet);
    });

    document.getElementById('applyGuiChanges').addEventListener('click', () => {
        if (!AppState.currentFile) return;
        const html = guiCanvas.innerHTML;
        AppState.editor.setValue(html);
        switchEditorMode('code');
    });

    document.getElementById('resetGuiCanvas').addEventListener('click', () => {
        if (!AppState.currentFile) return;
        guiCanvas.innerHTML = AppState.editor.getValue();
    });
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

function showModal(id) {
    document.getElementById(id).classList.add('active');
}

function showGitHubAuthModal() {
    showModal('githubAuthModal');
}

async function connectToGitHub() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) {
        alert('Please enter a valid GitHub token');
        return;
    }
    AppState.githubToken = token;
    localStorage.setItem('githubToken', token);
    document.getElementById('githubAuthModal').classList.remove('active');
    await authenticateWithGitHub();
}

async function authenticateWithGitHub() {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `token ${AppState.githubToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });
        if (!response.ok) throw new Error('Authentication failed');
        AppState.currentUser = await response.json();
        updateUserInfo();
        await loadRepositories();
    } catch (error) {
        console.error('GitHub authentication error:', error);
        alert('Failed to authenticate with GitHub. Please check your token.');
        logout();
    }
}

function updateUserInfo() {
    document.getElementById('githubConnectBtn').style.display = 'none';
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userAvatar').src = AppState.currentUser.avatar_url;
    document.getElementById('userName').textContent = AppState.currentUser.login;
}

function logout() {
    AppState.githubToken = null;
    AppState.currentUser = null;
    AppState.repositories = [];
    localStorage.removeItem('githubToken');
    document.getElementById('githubConnectBtn').style.display = 'flex';
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('repoSelect').innerHTML = '<option value="">Select a repository...</option>';
}

async function loadRepositories() {
    try {
        const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
            headers: {
                Authorization: `token ${AppState.githubToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });
        AppState.repositories = await response.json();
        const repoSelect = document.getElementById('repoSelect');
        repoSelect.innerHTML = '<option value="">Select a repository...</option>';
        AppState.repositories.forEach(repo => {
            const option = document.createElement('option');
            option.value = repo.full_name;
            option.textContent = repo.full_name;
            repoSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load repositories:', error);
    }
}

async function loadRepository(repoFullName) {
    AppState.currentRepo = repoFullName;
    try {
        const repoInfoRes = await fetch(`https://api.github.com/repos/${repoFullName}`, {
            headers: {
                Authorization: `token ${AppState.githubToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });
        const repoInfo = await repoInfoRes.json();
        AppState.currentBranch = repoInfo.default_branch || 'main';

        const treeRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees/${AppState.currentBranch}?recursive=1`, {
            headers: {
                Authorization: `token ${AppState.githubToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });
        const treeData = await treeRes.json();
        const treeEntries = treeData.tree || [];
        const files = [];

        treeEntries.forEach(item => {
            if (item.type === 'blob') {
                files.push({
                    name: item.path.split('/').pop(),
                    path: item.path,
                    type: 'file',
                    sha: item.sha,
                    download_url: `https://raw.githubusercontent.com/${repoFullName}/${AppState.currentBranch}/${item.path}`
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
        refreshFileStructure();
        renderFileTree();
        saveStateToLocalStorage();
    } catch (error) {
        console.error('Failed to load repository contents:', error);
        alert('Failed to load repository contents');
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
            fileTree.innerHTML = `<div class="empty-state"><p>No matches for "${AppState.searchQuery}"</p></div>`;
            return;
        }
        fileTree.innerHTML = '';
        matches.forEach(match => {
            const row = document.createElement('div');
            row.className = `file-tree-item ${match.type}`;
            row.innerHTML = `
                <input type="checkbox" class="file-checkbox" ${AppState.selectedFiles.has(match.path) ? 'checked' : ''} data-path="${match.path}">
                <i class="fas ${match.type === 'dir' ? 'fa-folder' : getFileIcon(match.name)}"></i>
                <span>${match.path}</span>
            `;
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
    const toggleIcon = node.type === 'dir' ? '<i class="fas fa-chevron-right"></i>' : '';
    wrapper.innerHTML = `
        <span class="folder-toggle">${toggleIcon}</span>
        <input type="checkbox" class="file-checkbox" data-path="${node.path}" ${isSelected ? 'checked' : ''}>
        <i class="fas ${icon}"></i>
        <span>${node.name || 'root'}</span>
    `;

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
        isNew: true
    };
    AppState.files.push(newFile);
    refreshFileStructure();
    renderFileTree();
    saveStateToLocalStorage();
    openFile(newFile);
    document.getElementById('newFileModal').classList.remove('active');
}

function createNewFolder() {
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
    AppState.files.push({ name: folderName, path, type: 'dir', isNew: true });
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

    if (!file.content) {
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
    document.getElementById('fileStatus').textContent = 'Saved';
    renderTabs();
    document.getElementById('guiCanvas').innerHTML = file.content || '';
    PluginManager.runHook('onFileOpen', { file });
}

async function fetchFileContent(file) {
    if (AppState.fileCache[file.path]) {
        return AppState.fileCache[file.path];
    }
    if (file.content) return file.content;
    if (file.download_url) {
        const res = await fetch(file.download_url);
        const text = await res.text();
        AppState.fileCache[file.path] = text;
        return text;
    }
    return '';
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
        tab.innerHTML = `<span>${file.name}${file.modified ? '*' : ''}</span><span class="close-tab" data-path="${file.path}">×</span>`;
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
    document.getElementById('guiCanvas').innerHTML = file.content || '';
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
    AppState.currentFile.content = AppState.editor.getValue();
    AppState.currentFile.modified = false;
    AppState.currentFile.baseContent = AppState.currentFile.content;
    document.getElementById('fileStatus').textContent = 'Saved';
    const index = AppState.files.findIndex(f => f.path === AppState.currentFile.path);
    if (index !== -1) AppState.files[index] = AppState.currentFile;
    saveStateToLocalStorage();
    if (AppState.githubToken && AppState.currentRepo && !AppState.currentFile.isNew) {
        try {
            await saveToGitHub(AppState.currentFile);
            alert('File saved to GitHub successfully!');
        } catch (error) {
            console.error('Failed to save to GitHub:', error);
            alert('Failed to save to GitHub. File saved locally.');
        }
    } else {
        alert('File saved locally!');
    }
    PluginManager.runHook('onFileSave', { file: AppState.currentFile });
    renderTabs();
}

async function saveToGitHub(file) {
    const response = await fetch(`https://api.github.com/repos/${AppState.currentRepo}/contents/${file.path}`, {
        method: 'PUT',
        headers: {
            Authorization: `token ${AppState.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Update ${file.name}`,
            content: btoa(unescape(encodeURIComponent(file.content))),
            sha: file.sha
        })
    });
    if (!response.ok) throw new Error('Failed to save to GitHub');
    const result = await response.json();
    file.sha = result.content.sha;
}

function deleteCurrentFile() {
    if (!AppState.currentFile) return;
    if (!confirm(`Delete ${AppState.currentFile.name}?`)) return;
    AppState.files = AppState.files.filter(f => f.path !== AppState.currentFile.path);
    AppState.selectedFiles.delete(AppState.currentFile.path);
    refreshFileStructure();
    closeTab(AppState.currentFile);
    renderFileTree();
    saveStateToLocalStorage();
}

function togglePreview() {
    if (!AppState.currentFile) {
        alert('Open a file first');
        return;
    }
    const preview = document.getElementById('preview');
    if (preview.style.display === 'none' || preview.style.display === '') {
        preview.style.display = 'flex';
        const content = AppState.editor.getValue();
        const iframe = document.getElementById('previewFrame');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (AppState.currentFile?.name.endsWith('.md')) {
            iframeDoc.open();
            iframeDoc.write(`<html><body>${marked.parse(content)}</body></html>`);
            iframeDoc.close();
        } else {
            iframeDoc.open();
            iframeDoc.write(content);
            iframeDoc.close();
        }
    } else {
        preview.style.display = 'none';
    }
}

function refreshFileTree() {
    if (AppState.currentRepo && AppState.githubToken) {
        loadRepository(AppState.currentRepo);
    } else {
        refreshFileStructure();
        renderFileTree();
    }
}

function downloadProject() {
    const projectData = {
        files: AppState.files,
        metadata: {
            name: 'GitHub Pages Project',
            created: new Date().toISOString()
        }
    };
    const dataStr = JSON.stringify(projectData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.href = dataUri;
    linkElement.download = 'github-pages-project.json';
    linkElement.click();
}

function bulkDeleteSelected() {
    if (!AppState.selectedFiles.size) {
        alert('Select files first');
        return;
    }
    if (!confirm(`Delete ${AppState.selectedFiles.size} files?`)) return;
    AppState.files = AppState.files.filter(f => !AppState.selectedFiles.has(f.path));
    AppState.openTabs = AppState.openTabs.filter(tab => !AppState.selectedFiles.has(tab.path));
    if (AppState.currentFile && AppState.selectedFiles.has(AppState.currentFile.path)) {
        AppState.currentFile = null;
        document.getElementById('editorWrapper').style.display = 'none';
        document.getElementById('welcomeScreen').style.display = 'flex';
    }
    AppState.selectedFiles.clear();
    refreshFileStructure();
    renderFileTree();
    renderTabs();
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
        div.innerHTML = `<strong>${result.file.path}</strong><p>${result.snippet.replace(query, `<mark>${query}</mark>`)}</p>`;
        div.addEventListener('click', () => {
            document.getElementById('searchModal').classList.remove('active');
            openFile(result.file);
        });
        resultsContainer.appendChild(div);
    });
}

async function loadCommitHistory() {
    if (!AppState.currentRepo || !AppState.githubToken) {
        alert('Connect to a repository first');
        return;
    }
    showModal('commitModal');
    const list = document.getElementById('commitList');
    list.innerHTML = '<p>Loading commits...</p>';
    try {
        const filePath = AppState.currentFile?.path;
        const url = new URL(`https://api.github.com/repos/${AppState.currentRepo}/commits`);
        url.searchParams.set('sha', AppState.currentBranch);
        url.searchParams.set('per_page', '20');
        if (filePath) url.searchParams.set('path', filePath);
        const response = await fetch(url, {
            headers: {
                Authorization: `token ${AppState.githubToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });
        if (!response.ok) throw new Error('Failed to fetch commits');
        const commits = await response.json();
        list.innerHTML = '';
        commits.forEach(commit => {
            const item = document.createElement('div');
            item.className = 'commit-item';
            item.innerHTML = `
                <strong>${commit.commit.message}</strong>
                <p>${commit.commit.author.name} · ${new Date(commit.commit.author.date).toLocaleString()}</p>
                <code>${commit.sha.slice(0, 7)}</code>
            `;
            list.appendChild(item);
        });
    } catch (error) {
        console.error(error);
        list.innerHTML = '<p class="empty-state">Failed to load commits.</p>';
    }
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
        document.getElementById('guiCanvas').innerHTML = AppState.editor.getValue();
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
    const endpoint = document.getElementById('copilotEndpoint').value.trim();
    if (!token) {
        alert('Token required');
        return;
    }
    AppState.copilotToken = token;
    AppState.copilotEndpoint = endpoint || AppState.copilotEndpoint;
    localStorage.setItem('copilotToken', AppState.copilotToken);
    localStorage.setItem('copilotEndpoint', AppState.copilotEndpoint);
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
    messages.innerHTML += `<div class="copilot-message user">${prompt}</div>`;
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
        messages.innerHTML += `<div class="copilot-message assistant">${answer}</div>`;
    } catch (error) {
        console.error(error);
        messages.innerHTML += '<div class="copilot-message assistant">Copilot unavailable. Check token/endpoint.</div>';
    }
}

async function addPluginFromUrl() {
    const url = document.getElementById('pluginUrl').value.trim();
    if (!url) return;
    try {
        const res = await fetch(url);
        const code = await res.text();
        const plugin = eval(`(${code})`);
        PluginManager.register(plugin, code);
        document.getElementById('pluginUrl').value = '';
    } catch (error) {
        alert('Failed to load plugin');
        console.error(error);
    }
}

function addPluginFromCode() {
    const code = document.getElementById('pluginCode').value.trim();
    if (!code) return;
    try {
        const plugin = eval(`(${code})`);
        PluginManager.register(plugin, code);
        document.getElementById('pluginCode').value = '';
    } catch (error) {
        alert('Invalid plugin code');
        console.error(error);
    }
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
        card.innerHTML = `<div><strong>${plugin.name || plugin.id}</strong><p>${plugin.description || ''}</p></div>`;
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
    const stored = localStorage.getItem('pluginStore');
    if (!stored) return;
    try {
        const plugins = JSON.parse(stored);
        plugins.forEach(meta => {
            if (meta.source) {
                try {
                    const plugin = eval(`(${meta.source})`);
                    PluginManager.register(plugin, meta.source);
                } catch (error) {
                    console.error('Failed to revive plugin', meta.id, error);
                }
            } else {
                PluginManager.register({ id: meta.id, name: meta.name, description: meta.description }, '');
            }
        });
    } catch (error) {
        console.error('Failed to load plugins', error);
    }
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
