# GhP WebEditor

GhP WebEditor helps people edit GitHub Pages sites with code or visual tools,
preview the result, and open a review pull request in a repository they own or
manage. It also provides a local desktop workspace for ZIP-based editing.

> **Release model:** GitHub Pages hosts the public product site; the Railway web
> app is the supported GitHub-connected editor; macOS and Windows desktop builds
> are local/ZIP-first. Copilot, collaboration, and visual editing remain
> experimental. Third-party plugins are disabled until they have a security sandbox.

## GitHub Pages product site

The `github-pages-static` branch builds the public product site that runs entirely
from GitHub Pages. There is no application server, GitHub App secret, database, or
server session at runtime. The static site:

- deliberately does **not** accept GitHub credentials or personal access tokens;
- explains the secure review-PR workflow, links to releases, and accepts feedback;
- keeps the project inbox address out of page source by using FormSubmit's endpoint
  token; and
- directs GitHub-connected work to the hosted editor.

GitHub Pages paths on the same account share a browser origin, so a bearer-token
editor is unsafe there. Use the Railway-hosted editor for GitHub publishing.

To build and test this edition locally:

```bash
npm ci
npm run build:pages
npm run test:pages
BASE_PATH=/GhP-WebEditor/ npm run serve:pages
```

To deploy, push this branch and set the repository's **Settings → Pages → Source**
to **GitHub Actions**. The `Deploy static editor to GitHub Pages` workflow builds,
tests, audits, and publishes `dist/`. No repository secret is required.

## Feature Highlights

- 🧭 **Advanced Folder Navigation** – Breadcrumbs, collapsible tree views, and
directory insights for large repositories.
- 🗂️ **Multi-file Selection & Bulk Actions** – Select many files at once and perform
delete/download actions in a click.
- 🕘 **Git Commit History Viewer** – Inspect the latest commits for the repository or
for the active file without leaving the editor.
- 🤝 **Same-origin Tab Sync** – Share changes between tabs on the same browser
origin using BroadcastChannel. This is not remote collaboration.
- 🎨 **Custom Themes** – Independent UI and CodeMirror themes with persistent
preferences.
- 🔌 **Plugin API (disabled)** – The earlier arbitrary-code loader is disabled
pending a capability-limited sandbox.
- 🔍 **File + Content Search** – Filter the tree instantly or run deep content
searches with contextual results.
- 🤖 **Auto-completion & Experimental Copilot Chat** – CodeMirror hints are built
in; Copilot integration requires separate validation and credentials are memory-only.
- 🧩 **Diff Viewer & History** – Inspect local vs. remote changes with a line-by-line
diff and launch the commit history modal.
- 🧱 **GUI + Code Modes** – Select, edit, move, drag, or delete document blocks, then
render the complete HTML/CSS/JavaScript workspace in an isolated preview.

## Installation

### Option 0: Deploy the static GitHub Pages product site

Use the `github-pages-static` branch and its Pages workflow as described above. The
generated `dist/` directory is a build artifact and is intentionally not committed.

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

The server exposes locked editor dependencies directly from `node_modules`; no
generated vendor directory is required.

On macOS, keep the checkout outside iCloud/optimised-storage folders for the most
predictable development experience. Test scripts include a source hydration preflight,
and the server buffers static assets before sending headers to avoid partial placeholder
responses, but local storage availability remains an operating-system concern.

### Option 2: Run as Electron Desktop App

```bash
npm install
npm run electron
```

The desktop app supports local file and ZIP workflows. Set `GHP_WEB_APP_URL` when
building it to make its GitHub action open the hosted editor.

## Usage Overview

1. **Connect to GitHub:** In the hosted web editor, the user signs in to
their own GitHub account and installs the GitHub App for only the repositories they
select. The app never receives a personal access token in the browser.
2. **Navigate:** Use the left sidebar’s breadcrumbs, search, and folder inspector to
move through large projects.
3. **Open Files:** Multi-select items for bulk actions or open files individually in
a tabbed editor.
4. **Edit and render:** Toggle between Code and GUI modes, then preview nested HTML,
CSS, JavaScript modules, and local assets together.
5. **Create a review PR:** GitHub-backed changes are committed to a new
`ghp-review/*` branch and opened as a pull request against the selected branch. The
repository owner reviews and merges it from their own GitHub account before Pages deploys.

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
- PUT `/api/clone/:id/file` with `{ path, content }` saves UTF-8 text
- DELETE `/api/clone/:id/file?path=...` deletes a file
- POST `/api/clone/:id/directory` with `{ path }` creates a directory
- GET `/api/clone/:id/status` reports local Git changes
- POST `/api/clone/:id/commit` creates a local commit
- POST `/api/github/repos/:owner/:repo/batch` with `review: true` creates a review
  branch and pull request for a reviewed batch of base64 files

Notes:

- Clones are stored under the OS temp directory and are not persisted across restarts.
- Files larger than 2MB are flagged as `tooLarge` and not inlined.
- Clone files can be edited through the local API. Status and local commits are
supported by the API. GitHub-backed workspaces support atomic batch publishing.
- For safety, clone URLs must use HTTPS and target an allowed host. The default
hosts are GitHub, GitLab, and Bitbucket.

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
The plugin UI is retained for future work, but loading executable inline or remote
plugins is disabled until a sandboxed implementation is available.

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
The toolbar toggle swaps between CodeMirror and a structural GUI canvas where you can
select nested blocks, edit inline text, move, drag, or delete elements, and push the
document body back into code without leaking editor metadata. The sandboxed Preview
is the rendering authority and composes workspace styles, scripts, modules, and assets.

### GitHub + Copilot Login
GitHub uses a server-mediated GitHub App user authorization flow. The access token
is stored only in the loopback server's bounded in-memory session and the browser
receives an HTTP-only session cookie. Copilot credentials remain page-memory-only.

Configure a GitHub App with **Contents: read and write** and **Pages: read**, request
user authorization during installation, and use the Railway HTTPS callback and setup
URLs. Export `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG`,
`GITHUB_APP_CALLBACK_URL`, and `GHP_WEB_APP_URL` before starting the hosted editor.
GitHub's installation UI lets each user grant all repositories or only selected
repositories. See [production deployment](docs/DEPLOYMENT.md) for the exact setup.

## Project Structure

```
GhP-WebEditor/
├── public/
│   ├── index.html         # Application UI shell
│   ├── styles.css         # Theme-aware styling
│   ├── app.js             # Front-end logic & integrations
│   └── workspace-preview.js # Multi-file preview composition and sanitising
├── lib/
│   ├── clone-workspace.js  # Clone workspace security and path boundaries
│   └── github-app.js       # OAuth sessions, repository authorization, API proxy
├── test/                   # Unit, API, fixture, and Electron tests
├── .github/workflows/      # Continuous integration
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

## Current limits

- The supported publishing path uses the hosted editor with a configured
  GitHub App. The user owns the selected repository and pull request; the app creates
  a review branch and does not merge or alter Pages settings automatically.
- It does not run Jekyll, npm, bundlers, or framework-specific production builds for
the edited project. Sites requiring a build pipeline must keep that pipeline in
GitHub Actions or another build service.
- The preview composes nested HTML, imported CSS, classic and module JavaScript, and
local image/font/media assets. Multi-page link navigation, service workers, server
features, and framework-specific build behavior still require an acceptance pass
against the deployed Pages URL.
- Clone workspaces are temporary and local. They can be edited and committed locally;
remote push still requires the GitHub-backed workspace flow.
- ZIP import accepts archives up to 25MB (50MB uncompressed), rejects unsafe paths and
  `.git` content, and shows a manifest before replacing the workspace. Export preserves
  binary assets and selected-file exports are ZIP archives.
- Railway intentionally runs one application replica for v1 because GitHub sessions
  are held in memory. Restarting the service signs users out; a shared session store
  is required before horizontal scaling.

## License

This project is distributed under the **GhP WebEditor Commercial License**. A valid
purchase is required for production use. See [LICENSE](LICENSE) for details.

## Support

For deployment, GitHub App, and signed-release setup, see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). For feature requests or support, use the
feedback form on the GitHub Pages product site or contact the project maintainer
through the repository.
