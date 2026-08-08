# Buildy agent guide

This repository contains the Buildy local-first GitHub Pages site editor. Read this file
before changing code; it records the boundaries that are easy to violate when
working from a single large browser module.

## Architecture and ownership

1. `main.js` is the Electron main process. It starts the loopback Express server,
   creates the window, and owns navigation/external-link policy. Do not put editor
   state or DOM code here.
2. `server.js` is the Express composition root and local API. `createApp(options)`
   is the testable entry point; `startServer()` is the production entry point.
3. `lib/clone-workspace.js` owns filesystem path validation, clone-host validation,
   symlink checks, and repository tree limits. Reuse these validators for new clone
   endpoints; do not duplicate path checks in route handlers.
4. `lib/github-app.js` owns the deferred hosted GitHub App flow: OAuth state,
   process-local sessions, installation-scoped repository authorization, GitHub API
   proxying, and review-PR publishing. Keep GitHub credentials out of the browser.
5. `public/app.js` is the current browser orchestrator. It owns `AppState`, DOM
   event wiring, file-tree/editor tabs, local ZIP import/export, clone API calls,
   optional GitHub calls, visual editing, collaboration UI, Copilot UI, and plugin
   UI. Prefer adding a clearly named domain section or extracting a bounded module
   over adding another unrelated global helper.
6. `public/workspace-preview.js` is the canonical preview composer. It rewrites
   workspace-relative HTML/CSS/module assets before inserting the result into the
   sandboxed preview iframe; do not reimplement preview path resolution elsewhere.
7. `static/` is the GitHub Pages product/download site, not the editor runtime.
   `static/static-api.js` deliberately exposes local-only mode and must not regain
   a browser-held PAT or GitHub App secret.
8. `scripts/build-pages.js` creates the deployable `dist/` landing artifact from
   `static/`; `scripts/serve-pages.js` serves that artifact for Pages tests.
   `dist/` is generated and must not be edited by hand.
9. The Electron/downloadable v1 sets `GHP_LOCAL_ONLY=true`. It supports local file
   editing, preview, and ZIP export; it hides account-connected publishing controls.
10. The server still contains the hosted GitHub App implementation for a future
    release. Do not expose it from the local-only desktop or static Pages modes.

## Data, security, and invariants

11. Browser `AppState.files` is the editor workspace model. The DOM, CodeMirror,
    and GUI canvas are views of that state, not independent authorities.
12. Imported ZIP files are untrusted. Preserve archive size, entry count,
    expansion-ratio, path traversal, `.git`, and binary/text handling limits.
13. Clone paths must pass `lib/clone-workspace.js` validation and remain inside the
    clone's real filesystem root. Never follow symlinks or accept Git option-like
    path segments.
14. Clone hosts are HTTPS-only and restricted by `CLONE_ALLOWED_HOSTS`; do not add
    arbitrary URL fetching to the clone API.
15. Preview HTML is untrusted. Keep the iframe sandbox and restrictive preview CSP;
    do not allow preview code same-origin access to editor state or credentials.
16. Repository names, file names, search results, commit metadata, and AI output
    must be rendered as text. Do not turn them into `innerHTML` without a reviewed
    sanitizer boundary.
17. GitHub App sessions and OAuth state are process-local, bounded, HTTP-only and
    expiring. Hosted deployments require real authentication, quotas, monitoring,
    and egress controls before public exposure.
18. GitHub mutations must use the existing allowlisted path/branch/revision/base64
    validation and installation-scoped repository check. Prefer review PRs over
    direct branch mutation for new hosted workflows.
19. Do not persist PATs, OAuth access tokens, Copilot tokens, or GitHub credentials
    in localStorage, sessionStorage, URLs, ZIPs, build artifacts, or logs.
20. Third-party plugins are intentionally disabled until a capability-limited
    sandbox exists. Do not reintroduce `eval` or arbitrary URL/code execution.
21. `public/app.js` may use localStorage for non-secret workspace/UI preferences;
    keep sensitive values out of that persistence path.
22. Built React/Vite sites are supported when imported as production output
    (`dist/` contents). The editor does not run `npm install` or arbitrary project
    build scripts; source React projects are preserved for export but must be built
    with the user's normal toolchain before preview.

## Tests, builds, and generated files

23. `npm run lint` performs syntax checks across first-party runtime files.
24. `npm test` runs Node API/security tests in `test/*.test.js`; `npm run test:e2e`
    runs the deterministic browser suite in `demo/`; `npm run test:electron`
    validates the packaged local-only renderer; `npm run test:pages` validates the
    generated static landing site.
25. Use `npm run test:all` for the full local gate when practical. CI additionally
    runs Node 20/22, Chromium, Electron, Pages, and high-severity `npm audit` gates.
26. `scripts/hydrate-tests.js` only walks test/application sources before tests; it
    is not a source generator. Do not add generated output to tracked source.
27. `public/lib/`, `node_modules/`, `dist/`, `release/`, `playwright-report/`, and
    test screenshots/results are generated or vendor content. Do not edit them by
    hand or commit them.
28. Pages deployment is only from `github-pages-static` through `.github/workflows/pages.yml`.
    Desktop releases use matching `package.json` versions and `vX.Y.Z` tags through
    `.github/workflows/release.yml`; signing secrets must never enter git.
29. Preserve `createApp`, `startServer`, and exported helper APIs used by tests unless
    a change explicitly updates their callers and regression coverage.
30. Before merging structural work, inspect `git diff --check`, run the relevant
    test slice plus the full build, and verify that no generated/vendor files changed.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the subsystem map and test
matrix. See [`SECURITY.md`](SECURITY.md) for the security policy and deployment
limitations.
