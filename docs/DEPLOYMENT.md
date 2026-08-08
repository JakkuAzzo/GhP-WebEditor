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
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`
- `GITHUB_APP_SLUG`
- `GITHUB_APP_CALLBACK_URL` (HTTPS production callback)
- `CLONE_ALLOWED_HOSTS` (normally the smallest required host set)
- `CLONE_TIMEOUT_MS`

The hosted service must not be exposed until authentication, quotas, monitoring,
and egress controls are enabled. The service is currently PR-first: it should
create review branches and pull requests rather than silently updating a user's
default branch.

## BStudioB migration checklist

1. Create/select the BStudioB Railway workspace and production project.
2. Install the Buildy GitHub App under the production GitHub owner.
3. Grant only the intended repositories and verify the callback URL.
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
