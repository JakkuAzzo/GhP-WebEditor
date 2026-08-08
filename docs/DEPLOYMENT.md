# Buildy deployment

## Environments

- **Local:** Electron or `npm start`; no GitHub credentials required for v1 local
  editing and ZIP export.
- **Staging:** the existing personal Railway project is for validation only.
- **Production:** migrate the hosted service to the BStudioB Railway workspace,
  with the production GitHub App installation owned by the intended BStudioB
  account and only the selected Buildy repositories granted.
- **Product site:** `github-pages-static` deploys the credential-free landing and
  release site through GitHub Actions.

## Hosted service configuration

The root `railway.toml` provides the safe default start command and `/api/health`
check. Configure these variables in Railway; never commit values:

- `NODE_ENV=production`
- `BUILDY_PUBLIC_MODE=true` only for an approved hosted deployment
- `BUILDY_SESSION_SECRET`
- `BUILDY_TOKEN_ENCRYPTION_KEY`
- `BUILDY_GITHUB_CLIENT_ID`
- `BUILDY_GITHUB_CLIENT_SECRET`
- `BUILDY_GITHUB_APP_SLUG`
- `BUILDY_GITHUB_CALLBACK_URL=https://buildy.bstudiob.co.uk/auth/github/callback`
- `BUILDY_GITHUB_WEBHOOK_SECRET`
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `BUILDY_STRIPE_WEBHOOK_SECRET` (server-side only)
- `CLONE_ALLOWED_HOSTS` (normally the smallest required host set)
- `CLONE_TIMEOUT_MS`

`BUILDY_JOBS_ENABLED` must remain unset/false until the Postgres migration is applied,
the web process is wired to `createPostgresJobStore`, and an isolated worker is
deployed with `BUILDY_WORKER_MODULE`. When enabled, `/api/jobs` requires a server-only
`BUILDY_JOB_API_TOKEN` bearer token and applies an in-memory rate limit; production
must replace this with authenticated account/entitlement checks and durable quotas.

`GET /api/jobs/:id/artifact` is fail-closed until object storage and entitlement
checks are configured. It never serves local filesystem paths; production must return
an expiring, entitlement-checked object-storage URL.

The worker contract currently defines only these runtime variables:

- `BUILDY_WORKER_MODULE` — absolute path to an isolated executor module;
- `BUILDY_WORKER_POLL_MS` — queue polling interval (defaults to 2 seconds);
- `BUILDY_WORKER_MAX_ATTEMPTS` — bounded retry count (defaults to 3).

There is no repository-defined `DATABASE_URL`, queue URL, or artifact-storage
variable yet. Do not add one to production until the Supabase/Postgres adapter and
artifact-retention implementation are wired and tested.

The hosted service must not be exposed until authentication, quotas, monitoring,
and egress controls are enabled. The service is currently PR-first: it should
create review branches and pull requests rather than silently updating a user's
default branch.

## BStudioB migration checklist

1. Create/select the BStudioB Railway workspace and private production repository/project.
2. Install the Buildy GitHub App under the production GitHub owner.
3. Grant only the intended repositories and configure:
   `https://buildy.bstudiob.co.uk/auth/github/callback` and
   `https://buildy.bstudiob.co.uk/api/github/marketplace/webhook`.
4. Add production secrets through Railway's encrypted variables UI.
5. Connect the repository and select the intended production branch.
6. Deploy with the health check enabled and verify `/api/runtime` and GitHub login.
7. Run a repository selection, edit, PR creation, logout, and access-revocation
   smoke test before adding a public domain.
8. Keep the personal Railway service as staging until production is verified, then
   disable or delete it deliberately.

## Current limitations

The repository does not yet contain the Postgres-backed worker service or sandboxed
React source-build pipeline. Those are separate milestones and must be implemented
before promising hosted source builds or durable multi-user workspaces.

Migration `002_accounts_entitlements.sql` defines the Supabase account, entitlement,
project-membership, and RLS boundary. It must be applied only in the BStudioB-owned
Supabase project and verified with tenant-isolation tests before production use.

`lib/entitlements.js` is the canonical fail-closed access rule. Stripe and GitHub
Marketplace webhook handlers must normalize provider events into the migration's
entitlement shape before protected downloads or builds call this policy.
