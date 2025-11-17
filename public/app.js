// Application State
const AppState = {
    githubToken: localStorage.getItem('githubToken') || null,
    currentUser: null,
    currentRepo: null,
    repositories: [],
    files: [],
    currentFile: null,
    openTabs: [],
    editor: null
};

// File Templates
const FILE_TEMPLATES = {
    blank: '',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    <h1>Hello, World!</h1>
</body>
</html>`,
    css: `/* CSS Styles */
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
}`,
    js: `// JavaScript Code
console.log('Hello, World!');`,
    md: `# Document Title

## Introduction

This is a markdown document.

- List item 1
- List item 2
- List item 3`
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeEditor();
    setupEventListeners();
    loadStateFromLocalStorage();
    
    if (AppState.githubToken) {
        authenticateWithGitHub();
    }
});

// Initialize CodeMirror Editor
function initializeEditor() {
    const editorElement = document.getElementById('editor');
    AppState.editor = CodeMirror.fromTextArea(editorElement, {
        mode: 'htmlmixed',
        theme: 'monokai',
        lineNumbers: true,
        lineWrapping: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 2,
        tabSize: 2,
        indentWithTabs: false
    });
    
    AppState.editor.on('change', () => {
        if (AppState.currentFile) {
            AppState.currentFile.modified = true;
            updateCurrentTab();
        }
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // GitHub Connection
    document.getElementById('githubConnectBtn').addEventListener('click', showGitHubAuthModal);
    document.getElementById('connectGithub').addEventListener('click', showGitHubAuthModal);
    document.getElementById('connectGithubSubmit').addEventListener('click', connectToGitHub);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // File Operations
    document.getElementById('newFileBtn').addEventListener('click', showNewFileModal);
    document.getElementById('createNewFile').addEventListener('click', showNewFileModal);
    document.getElementById('createFileSubmit').addEventListener('click', createNewFile);
    document.getElementById('newFolderBtn').addEventListener('click', showNewFolderModal);
    document.getElementById('createFolderSubmit').addEventListener('click', createNewFolder);
    document.getElementById('refreshBtn').addEventListener('click', refreshFileTree);
    
    // Editor Actions
    document.getElementById('saveFileBtn').addEventListener('click', saveCurrentFile);
    document.getElementById('previewBtn').addEventListener('click', togglePreview);
    document.getElementById('deleteFileBtn').addEventListener('click', deleteCurrentFile);
    
    // Download
    document.getElementById('downloadBtn').addEventListener('click', downloadProject);
    
    // Repository Selection
    document.getElementById('repoSelect').addEventListener('change', (e) => {
        const repoName = e.target.value;
        if (repoName) {
            loadRepository(repoName);
        }
    });
    
    // Modal Close Buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('active');
        });
    });
    
    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveCurrentFile();
        }
    });
}

// Load state from localStorage
function loadStateFromLocalStorage() {
    const savedFiles = localStorage.getItem('files');
    if (savedFiles) {
        AppState.files = JSON.parse(savedFiles);
        renderFileTree();
    }
}

// Save state to localStorage
function saveStateToLocalStorage() {
    localStorage.setItem('files', JSON.stringify(AppState.files));
}

// GitHub Authentication
function showGitHubAuthModal() {
    document.getElementById('githubAuthModal').classList.add('active');
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
                'Authorization': `token ${AppState.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Authentication failed');
        }
        
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
                'Authorization': `token ${AppState.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
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
        const response = await fetch(`https://api.github.com/repos/${repoFullName}/contents`, {
            headers: {
                'Authorization': `token ${AppState.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        const contents = await response.json();
        AppState.files = contents.map(item => ({
            name: item.name,
            path: item.path,
            type: item.type,
            sha: item.sha,
            url: item.url,
            download_url: item.download_url
        }));
        
        renderFileTree();
        saveStateToLocalStorage();
    } catch (error) {
        console.error('Failed to load repository contents:', error);
        alert('Failed to load repository contents');
    }
}

// File Tree Rendering
function renderFileTree() {
    const fileTree = document.getElementById('fileTree');
    
    if (AppState.files.length === 0) {
        fileTree.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>No files yet. Create a new file or connect to GitHub.</p>
            </div>
        `;
        return;
    }
    
    fileTree.innerHTML = '';
    
    AppState.files.forEach(file => {
        const item = document.createElement('div');
        item.className = `file-tree-item ${file.type}`;
        
        const icon = file.type === 'dir' ? 'fa-folder' : getFileIcon(file.name);
        
        item.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${file.name}</span>
        `;
        
        item.addEventListener('click', () => openFile(file));
        
        fileTree.appendChild(item);
    });
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'html': 'fa-file-code',
        'css': 'fa-file-code',
        'js': 'fa-file-code',
        'json': 'fa-file-code',
        'md': 'fa-file-alt',
        'txt': 'fa-file-alt',
        'jpg': 'fa-file-image',
        'jpeg': 'fa-file-image',
        'png': 'fa-file-image',
        'gif': 'fa-file-image',
        'pdf': 'fa-file-pdf',
        'zip': 'fa-file-archive'
    };
    
    return iconMap[ext] || 'fa-file';
}

// File Operations
function showNewFileModal() {
    document.getElementById('newFileModal').classList.add('active');
    document.getElementById('newFileName').value = '';
}

function showNewFolderModal() {
    document.getElementById('newFolderModal').classList.add('active');
    document.getElementById('newFolderName').value = '';
}

function createNewFile() {
    const fileName = document.getElementById('newFileName').value.trim();
    const template = document.getElementById('fileTemplate').value;
    
    if (!fileName) {
        alert('Please enter a file name');
        return;
    }
    
    if (AppState.files.find(f => f.name === fileName)) {
        alert('A file with this name already exists');
        return;
    }
    
    const newFile = {
        name: fileName,
        path: fileName,
        type: 'file',
        content: FILE_TEMPLATES[template] || '',
        modified: true,
        isNew: true
    };
    
    AppState.files.push(newFile);
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
    
    if (AppState.files.find(f => f.name === folderName)) {
        alert('A folder with this name already exists');
        return;
    }
    
    const newFolder = {
        name: folderName,
        path: folderName,
        type: 'dir',
        isNew: true
    };
    
    AppState.files.push(newFolder);
    renderFileTree();
    saveStateToLocalStorage();
    
    document.getElementById('newFolderModal').classList.remove('active');
}

async function openFile(file) {
    if (file.type === 'dir') {
        alert('Folder navigation is not yet implemented in this version');
        return;
    }
    
    // Check if file is already open
    const existingTab = AppState.openTabs.find(tab => tab.path === file.path);
    if (existingTab) {
        switchToTab(existingTab);
        return;
    }
    
    // Load file content if from GitHub
    if (file.download_url && !file.content) {
        try {
            const response = await fetch(file.download_url);
            file.content = await response.text();
        } catch (error) {
            console.error('Failed to load file content:', error);
            alert('Failed to load file content');
            return;
        }
    }
    
    // Add to open tabs
    AppState.openTabs.push(file);
    AppState.currentFile = file;
    
    // Show editor
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('editorWrapper').style.display = 'flex';
    
    // Load content into editor
    AppState.editor.setValue(file.content || '');
    
    // Set editor mode based on file extension
    const ext = file.name.split('.').pop().toLowerCase();
    setEditorMode(ext);
    
    // Update UI
    updateCurrentFileName();
    renderTabs();
}

function setEditorMode(extension) {
    const modeMap = {
        'html': 'htmlmixed',
        'css': 'css',
        'js': 'javascript',
        'json': 'javascript',
        'md': 'markdown',
        'xml': 'xml'
    };
    
    const mode = modeMap[extension] || 'htmlmixed';
    AppState.editor.setOption('mode', mode);
    
    document.getElementById('editorMode').textContent = extension.toUpperCase();
}

function updateCurrentFileName() {
    document.getElementById('currentFileName').textContent = AppState.currentFile.name;
}

function renderTabs() {
    const tabsContainer = document.getElementById('editorTabs');
    tabsContainer.innerHTML = '';
    
    AppState.openTabs.forEach(file => {
        const tab = document.createElement('div');
        tab.className = 'editor-tab';
        if (file === AppState.currentFile) {
            tab.classList.add('active');
        }
        
        tab.innerHTML = `
            <span>${file.name}${file.modified ? '*' : ''}</span>
            <span class="close-tab" data-path="${file.path}">×</span>
        `;
        
        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('close-tab')) {
                switchToTab(file);
            }
        });
        
        tab.querySelector('.close-tab').addEventListener('click', (e) => {
            e.stopPropagation();
            closeTab(file);
        });
        
        tabsContainer.appendChild(tab);
    });
}

function switchToTab(file) {
    AppState.currentFile = file;
    AppState.editor.setValue(file.content || '');
    updateCurrentFileName();
    renderTabs();
    
    const ext = file.name.split('.').pop().toLowerCase();
    setEditorMode(ext);
}

function closeTab(file) {
    if (file.modified) {
        if (!confirm(`${file.name} has unsaved changes. Close anyway?`)) {
            return;
        }
    }
    
    const index = AppState.openTabs.indexOf(file);
    AppState.openTabs.splice(index, 1);
    
    if (AppState.currentFile === file) {
        if (AppState.openTabs.length > 0) {
            switchToTab(AppState.openTabs[AppState.openTabs.length - 1]);
        } else {
            document.getElementById('welcomeScreen').style.display = 'flex';
            document.getElementById('editorWrapper').style.display = 'none';
            AppState.currentFile = null;
        }
    }
    
    renderTabs();
}

function updateCurrentTab() {
    renderTabs();
}

async function saveCurrentFile() {
    if (!AppState.currentFile) {
        return;
    }
    
    AppState.currentFile.content = AppState.editor.getValue();
    AppState.currentFile.modified = false;
    
    // Update in files array
    const fileIndex = AppState.files.findIndex(f => f.path === AppState.currentFile.path);
    if (fileIndex !== -1) {
        AppState.files[fileIndex] = AppState.currentFile;
    }
    
    saveStateToLocalStorage();
    
    // If connected to GitHub, push changes
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
    
    renderTabs();
}

async function saveToGitHub(file) {
    const response = await fetch(`https://api.github.com/repos/${AppState.currentRepo}/contents/${file.path}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${AppState.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Update ${file.name}`,
            content: btoa(unescape(encodeURIComponent(file.content))),
            sha: file.sha
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to save to GitHub');
    }
    
    const result = await response.json();
    file.sha = result.content.sha;
}

function deleteCurrentFile() {
    if (!AppState.currentFile) {
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${AppState.currentFile.name}?`)) {
        return;
    }
    
    const fileIndex = AppState.files.findIndex(f => f.path === AppState.currentFile.path);
    if (fileIndex !== -1) {
        AppState.files.splice(fileIndex, 1);
    }
    
    closeTab(AppState.currentFile);
    renderFileTree();
    saveStateToLocalStorage();
    
    alert('File deleted!');
}

function togglePreview() {
    const preview = document.getElementById('preview');
    const previewBtn = document.getElementById('previewBtn');
    
    if (preview.style.display === 'none') {
        preview.style.display = 'flex';
        previewBtn.innerHTML = '<i class="fas fa-code"></i> Code';
        
        const content = AppState.editor.getValue();
        const iframe = document.getElementById('previewFrame');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        
        if (AppState.currentFile.name.endsWith('.md')) {
            const html = marked.parse(content);
            iframeDoc.open();
            iframeDoc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
                        pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; }
                    </style>
                </head>
                <body>${html}</body>
                </html>
            `);
            iframeDoc.close();
        } else {
            iframeDoc.open();
            iframeDoc.write(content);
            iframeDoc.close();
        }
    } else {
        preview.style.display = 'none';
        previewBtn.innerHTML = '<i class="fas fa-eye"></i> Preview';
    }
}

function refreshFileTree() {
    if (AppState.currentRepo && AppState.githubToken) {
        loadRepository(AppState.currentRepo);
    } else {
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
    
    const exportFileDefaultName = 'github-pages-project.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    alert('Project exported successfully! You can import this file later.');
}
