# Buildy milestones

This is the implementation tracking document for the Buildy completion roadmap.
The product is being delivered in phases so local editing remains usable while the
hosted service and background infrastructure are added.

## Complete

- Local code and visual editing.
- Sandboxed multi-file preview with CSS, module, and asset rewriting.
- ZIP import/export with archive safety limits.
- Built React/Vite production-output preview and export coverage.
- Local clone browsing, editing, status, and commits.
- Credential-free GitHub Pages product/download site.
- Electron local-only security boundary.
- Root architecture and AI-agent documentation.

## In progress — Buildy foundation

- Complete visible product rename while retaining the existing repository URL.
- Publish explicit Railway configuration and staging/production ownership rules.
- Migrate production hosting to the BStudioB Railway workspace.
- Keep personal Railway deployment staging-only and private.

## Next — frontend completion

- Split the browser orchestrator into bounded state, transport, editor, preview,
  import/export, and collaboration modules without changing behavior.
- Finish mobile/accessibility/error/recovery states.
- Add project validation and clearer React source-versus-build guidance.

## Next — hosted web application

- Production GitHub App OAuth and installation-scoped repository selection.
- Persistent hosted projects and workspace revisions.
- PR-first publishing, webhooks, revocation, quotas, audit events, and health checks.

## Next — background services

- Lean Railway web + worker + Postgres architecture.
- Build-job state machine, cancellation, idempotency, and explicit job API foundation.
- Postgres migration, parameterised persistence adapter, and separate worker entrypoint.
- Isolated, allowlisted React/Vite source builds with bounded resources and artifacts.

### Implementation note

`lib/build-jobs.js` and `/api/jobs` now provide the validated state machine and local
store. They are deliberately disabled unless `BUILDY_JOBS_ENABLED=true`; production
must replace the memory store with Postgres before enabling public access. The
allowlisted command runner in `lib/project-build.js` is suitable for local/staging
fixtures only and is not a hosted sandbox by itself.

## Release gates

- **Private beta:** hosted auth, repository scoping, PR flow, and staging deployment.
- **Public beta:** worker/build sandbox, mobile/accessibility, monitoring, backups,
  rate limits, and security review.
- **Production:** BStudioB ownership, domain/TLS, rollback, signed installers,
  current documentation, and complete local/hosted operational tests.
