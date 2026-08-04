# Buildy Marketplace setup sheet

This is the non-secret setup record for the BStudioB GitHub App. It is intentionally
safe to keep in the repository: credentials, webhook secrets, Supabase keys and signing
keys must remain in Railway environment variables or a password manager.

## App identity

- Product: **Buildy for GitHub Pages**
- Publisher: **BStudioB Ltd**
- Public URL: `https://buildy.bstudiob.co.uk`
- Support: `support@bstudiob.co.uk`
- Privacy: `https://buildy.bstudiob.co.uk/privacy`
- Terms: `https://buildy.bstudiob.co.uk/terms`
- Status: `https://buildy.bstudiob.co.uk/status`

## Production callback values

- OAuth callback: `https://buildy.bstudiob.co.uk/auth/github/callback`
- Marketplace webhook: `https://buildy.bstudiob.co.uk/api/github/marketplace/webhook`

The same values are kept in `github-app-manifest.json` so the manifest and the hosted
service cannot drift.

## Permission rationale

- `metadata: read` is required for repository discovery and GitHub App API requests.
- `contents: write` is required only when a signed-in user explicitly saves an edit to
  a repository. Buildy must not write without a user action and should be reduced if a
  future read-only mode removes that feature.

## Release gates

Do not request Marketplace review until all of the following are true:

1. Railway TLS is valid and `/health` returns success on the custom hostname.
2. OAuth state validation, token encryption and webhook HMAC tests pass in production.
3. Supabase purchase-event persistence is configured with server-only variables.
4. Pricing, refund handling, support response expectations and account deletion are
   documented publicly.
5. The BStudioB publisher organisation and billing plans are verified in GitHub.

Official requirements: <https://docs.github.com/en/enterprise-cloud@latest/apps/github-marketplace/creating-apps-for-github-marketplace/requirements-for-listing-an-app>
