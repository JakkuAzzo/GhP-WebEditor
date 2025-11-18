# GhP-WebEditor

A commercial-grade GitHub Pages web editor that blends advanced folder navigation,
multi-file operations, real-time collaboration, Copilot-powered assistance, and a
drag-and-drop GUI builder on top of a battle-tested code editor.

## Feature Highlights

- 🧭 **Advanced Folder Navigation** – Breadcrumbs, collapsible tree views, and
directory insights for large repositories.
- 🗂️ **Multi-file Selection & Bulk Actions** – Select many files at once and perform
delete/download actions in a click.
- 🕘 **Git Commit History Viewer** – Inspect the latest commits for the repository or
for the active file without leaving the editor.
- 🤝 **Collaborative Editing** – Start/share sessions, observe presence, and sync
changes via BroadcastChannel/WebRTC fallbacks.
- 🎨 **Custom Themes** – Independent UI and CodeMirror themes with persistent
preferences.
- 🔌 **Plugin System** – Register inline or remote plugins that hook into editor
lifecycle events.
- 🔍 **File + Content Search** – Filter the tree instantly or run deep content
searches with contextual results.
- 🤖 **Auto-completion & Copilot Chat** – Built-in CodeMirror hints plus a GitHub
Copilot chat sidebar once authenticated.
- 🧩 **Diff Viewer & History** – Inspect local vs. remote changes with a line-by-line
diff and launch the commit history modal.
- 🧱 **GUI + Code Modes** – Drag, drop, and edit sections visually, or jump back into
CodeMirror with a single toggle.

## Installation

### Option 1: Run as Web Application (npm)

```bash
# Clone the repository
git clone https://github.com/JakkuAzzo/GhP-WebEditor.git
cd GhP-WebEditor

# Install dependencies
npm install

# Start the web server
npm start
```

Then open `http://localhost:3000`.

### Option 2: Run as Electron Desktop App

```bash
npm install
npm run electron
```

## Usage Overview

1. **Connect to GitHub:** Store a PAT for repo/content access or use the new Copilot
login modal for AI assistance.
2. **Navigate:** Use the left sidebar’s breadcrumbs, search, and folder inspector to
move through large projects.
3. **Open Files:** Multi-select items for bulk actions or open files individually in
a tabbed editor.
4. **Edit:** Toggle between Code and GUI modes, enable split preview, or invite
collaborators.
5. **Commit & Review:** Use the diff viewer and commit history modal before pushing.
6. **Extend:** Load plugins via URL or inline code to automate tasks or add UI.

## New: Clone from Git URL

You can clone any public Git repository by URL and browse files locally in the editor.

How to use:

1. Start the app: `npm start` (use `PORT=3001 npm start` if 3000 is busy)
2. Click "Clone from URL" in the sidebar
3. Paste a repo URL (e.g., `https://github.com/octocat/Hello-World.git`); keep "Shallow clone" enabled for speed
4. After cloning, the file tree loads from the local clone; open files as usual

Backend API (for integrations):

- POST `/api/clone` with JSON `{ url, shallow?: boolean, branch?: string }` → `{ id, url, branch, status }`
- GET `/api/clone/:id/tree` → `{ id, files: [{ path, type, size? }] }`
- GET `/api/clone/:id/file?path=...` → `{ path, content, encoding, size }` or `{ tooLarge: true }`

Notes:

- Clones are stored under the OS temp directory and are not persisted across restarts.
- Files larger than 2MB are flagged as `tooLarge` and not inlined.
- Current scope is read/browse; commit/push from clones can be added next.

## Advanced Capabilities

### Advanced Folder/Directory Navigation
The sidebar (see `public/app.js`) builds a recursive tree with breadcrumbs and
directory summaries so you can zoom into deep paths instantly.

### Multiple File Selection & Bulk Operations
Checkboxes next to each entry let you delete or export entire sets of files.
Selections stay in sync with bulk-action buttons in the sidebar toolbar.

### Git Commit History Viewer
The “Commits” button opens a modal that queries the GitHub API with filtering by
active file when available.

### Collaborative Editing Features
Start or join a session from the secondary toolbar. The editor uses
`BroadcastChannel` syncing, presence indicators, and shareable links.

### Custom Themes
Two drop-downs in the header let you switch UI themes and CodeMirror themes
independently. Preferences persist in `localStorage`.

### Plugin System
Open the Plugin Manager modal to register inline code snippets or remote plugin
objects. Plugins can respond to hooks like `onRegister`, `onFileOpen`, and
`onFileSave`.

### File Search Functionality
Use the quick filter field for file-name searching or the global search modal for
deeper content scans. Results link directly to the editor.

### Auto-completion
CodeMirror hint add-ons are enabled with `Ctrl+Space`/`Cmd+Space` shortcuts and also
trigger automatically on typical code tokens.

### Diff Viewer for Changes
The diff modal applies a lightweight LCS algorithm to visualize additions/removals
between the saved baseline and unsaved edits.

### GUI + Code Editor Modes
The toolbar toggle swaps between CodeMirror and a drag-and-drop GUI canvas where you
can rearrange sections, edit inline text, and push the layout back into code.

### GitHub + Copilot Login
The Copilot panel can call GitHub’s Copilot proxy once you provide a token, so your
AI pair programmer sits directly beside your workspace.

## Project Structure

```
GhP-WebEditor/
├── public/
│   ├── index.html         # Application UI shell
│   ├── styles.css         # Theme-aware styling
│   ├── app.js             # Front-end logic & integrations
│   └── assets/screenshots # Marketing screenshots referenced in the README
├── server.js              # Express server entrypoint
├── main.js                # Electron bootstrap
├── package.json           # Scripts & dependencies
├── README.md              # This document
└── LICENSE                # Commercial terms
```

## Technologies Used

- **Frontend:** HTML5, CSS3, Vanilla JS
- **Editor:** CodeMirror 5 + add-ons
- **Markdown:** Marked.js
- **Backend:** Express.js
- **Desktop:** Electron
- **APIs:** GitHub REST API v3 + Copilot proxy

## License

This project is distributed under the **GhP WebEditor Commercial License**. A valid
purchase is required for production use. See [LICENSE](LICENSE) for details.

## Support

For licensing questions, feature requests, or enterprise support, please contact the
project maintainer or email `sales@ghp-webeditor.example`.
