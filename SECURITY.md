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

- The current `github-pages-static` artifact is a product/download site, not an
  authenticated editor. It contains no PAT, OAuth exchange, GitHub App secret, or
  privileged GitHub API client.
- The static site links users to desktop/server workflows for account-connected
  publishing and uses a scoped FormSubmit feedback action. Keep the Pages workflow
  and landing repository protected from unreviewed script/dependency changes.
- The editor preview and credential-bearing server paths are not shipped in the
  static artifact. If a future static editor is proposed, it requires a new threat
  model and review rather than restoring the old browser-held-token design.

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

In the GitHub Pages edition, Git cloning, local Git commits, and the server-mediated
GitHub App flow are disabled because only the product/download site is shipped.

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
