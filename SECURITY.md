# Security Policy

## Supported versions

GhP WebEditor is pre-release software. Security fixes currently target the latest
commit on `main` and the `github-pages-static` branch; no production release line is
supported yet.

## Current security boundaries

- The server binds to `127.0.0.1` by default.
- Clone URLs must use HTTPS and target an explicitly allowed host. GitHub, GitLab,
  and Bitbucket are allowed by default; `CLONE_ALLOWED_HOSTS` can narrow the list.
- Clone paths reject traversal, Git-option forms, `.git` internals, and symbolic
  links. Reads and writes are checked against the clone's real filesystem root.
- Clone file content is limited to 2MB and repository trees to 10,000 entries.
- GitHub App access tokens remain in bounded server-side memory and are represented
  in the browser by an HTTP-only, SameSite session cookie. OAuth state is checked on
  callback, and every repository proxy request is checked against repositories the
  user granted to the GitHub App installation. File mutations are reduced to an
  allowlisted commit payload and validated paths, branches, revisions, and base64
  content. Copilot tokens remain page-memory-only.
- Preview content is retained briefly in a bounded in-memory registry and served to
  a sandboxed iframe without same-origin access. Preview documents receive a separate
  restrictive content policy and cannot submit forms.
- Repository-controlled names, search results, commit metadata, and AI responses
  are rendered as text rather than executable HTML.
- Third-party plugins are disabled. The previous `eval`-based loader was removed
  pending a capability-limited sandbox.
- Electron enables context isolation and renderer sandboxing, disables Node
  integration, and loads the application through its loopback server.

### GitHub Pages edition

- The static build has no secret-bearing OAuth exchange and does not embed a GitHub
  App secret. A GitHub App web flow cannot be implemented safely in static files.
- Fine-grained personal access tokens are held only in a closure in the current tab.
  They are never placed in local storage, session storage, URLs, build artifacts, or
  workflow secrets, and are cleared by logout or page reload.
- All authenticated traffic is sent to the fixed `https://api.github.com` origin.
  Repository permissions and selection are enforced by GitHub's token boundary.
- The static artifact self-hosts its JavaScript, fonts, and editor dependencies and
  includes a restrictive meta content policy. Project previews remain in an iframe
  with scripts allowed but same-origin access withheld, so preview code cannot read
  the parent page's token closure.
- Anyone who can execute script in the parent editor page could act with the
  in-memory token. Keep the Pages repository and deployment workflow protected,
  review dependency changes, and revoke a token immediately if exposure is suspected.

## Deployment limitations

The clone registry and clone directories are temporary and local. The server has no
multi-user authentication or distributed rate limiter and must not be exposed as a
public shared service. An operator intentionally changing `HOST` or proxying the
server is responsible for adding authentication, request quotas, monitoring, and
network egress controls.

GitHub API calls originate from the loopback server using a GitHub App user access
token. Configure the app with Contents read/write and Pages read, and select the
narrowest set of repositories during installation. Sessions are process-local and
expire after eight hours or logout. Authenticated clone push is not implemented.

In the GitHub Pages edition, API calls originate from the user's browser instead.
Git cloning, local Git commits, and the server-mediated GitHub App flow are disabled.

## Verification

The repository includes regression coverage for clone URL validation, traversal and
symlink rejection, binary-safe file persistence, local commits, hostile file names,
OAuth state and repository authorization, token non-persistence, isolated preview
execution, GitHub Pages status, visual round-tripping, and Electron renderer
isolation. CI runs syntax, unit/API, browser, Electron, build, and high-severity
dependency-audit gates.

## Reporting a vulnerability

Do not open a public issue containing exploit details. Use GitHub private
vulnerability reporting for the repository, or contact the maintainer privately.
Include reproduction steps, affected versions or commits, impact, and any suggested
mitigation. No fixed response-time SLA is offered during pre-release development.
