# Architecture map

GhP WebEditor has three deliberately different delivery modes:

| Mode | Entry point | Purpose | GitHub credentials |
| --- | --- | --- | --- |
| Desktop | `main.js` → `server.js` → `public/index.html` | Local editing, preview, visual editing, ZIP export | Disabled in v1 |
| Local/server editor | `server.js` → `public/` | Editor UI plus clone API and deferred hosted GitHub App routes | Server-side only when explicitly configured |
| GitHub Pages site | `static/landing.html` → `scripts/build-pages.js` | Product explanation, releases, setup guidance, feedback form | None |

## Runtime flow

1. Electron starts a loopback Express server with `GHP_LOCAL_ONLY=true`, then loads
   the local URL in a context-isolated, sandboxed BrowserWindow.
2. Express serves the editor assets and exposes `/api/health`, `/api/runtime`,
   preview storage, clone filesystem APIs, and the optional GitHub App routes.
3. `public/app.js` hydrates `AppState`, binds the DOM, and coordinates the editor.
   File contents may come from local workspace state, a cloned repository, or the
   deferred GitHub API flow. ZIP import replaces the local workspace; ZIP export
   serializes the current file entries.
4. Preview requests are composed by `public/workspace-preview.js`. Local HTML,
   CSS, JavaScript modules, and assets are rewritten into one document and loaded
   in `#previewFrame` with `sandbox="allow-scripts"`.
5. The static Pages build copies only the landing site and its self-hosted assets
   into `dist/`; it does not ship the editor runtime or any credential flow.

## Subsystem guide

### Browser editor (`public/`)

- `index.html`: UI contract and modal/control IDs consumed by `app.js` and E2E tests.
- `app.js`: stateful browser orchestration. Important sections are initialization,
  clone/GitHub transport, file tree/tabs, editing/save, preview/export/import,
  collaboration, Copilot, and disabled plugin controls.
- `workspace-preview.js`: canonical URL rewriting and visual-editor sanitization
  helpers. Keep preview security policy changes here and in the server preview CSP.
- `styles.css`: editor/workbench presentation; it does not own application state.

### Server and filesystem (`server.js`, `lib/`)

- `server.js` composes middleware and routes. It keeps clone registries,
  preview registries, and GitHub sessions in process memory.
- `lib/clone-workspace.js` is the filesystem trust boundary.
- `lib/github-app.js` is the GitHub OAuth/API trust boundary. It checks every
  repository request against repositories granted to the installed GitHub App.

### Static product site (`static/`, `scripts/`)

- `landing.html` and `landing.css` are the user-facing marketing/download surface.
- `static-api.js` marks the site as local-only and disables clone/publishing actions.
- `build-pages.js` rewrites absolute library paths for a GitHub Pages subpath and
  writes `.nojekyll`; `serve-pages.js` is a minimal test server with traversal checks.

### Tests and CI

- `test/*.test.js`: API, path safety, OAuth/repository authorization, preview, and
  local Git commit tests using `createApp()`.
- `demo/*.spec.js`: browser editor workflows, including visual editing, ZIP export,
  built React/Vite output, and source React import/export.
- `test/electron/app.spec.js`: renderer isolation and local-only desktop controls.
- `test/pages/static.spec.js`: Pages artifact paths, feedback action, and mobile layout.
- `.github/workflows/ci.yml`: main/PR unit, browser, Electron, build, and audit gates.
- `.github/workflows/pages.yml`: static Pages deployment from `github-pages-static`.
- `.github/workflows/release.yml`: signed desktop artifacts and GitHub release assets.

## Known structural trade-offs

`public/app.js` remains a large orchestrator because the current UI contract is
DOM-ID based and is covered by browser tests. Splitting it should be a bounded,
behavior-preserving migration with explicit state/transport interfaces, not an
opportunistic rewrite. The hosted GitHub App code is intentionally retained but not
exposed by v1; a future hosted release must first add deployment authentication,
quotas, monitoring, and a deliberate branch/configuration policy.
