# Buildy — GitHub Marketplace readiness

## Implemented in this repository

- Public Marketplace-facing product page at `/marketplace`, with plans, support,
  privacy and terms links available before sign-in.
- GitHub App OAuth start and callback with a session-bound state value.
- Encrypted-in-session access-token handoff to the existing GitHub API client.
- HMAC-SHA256 verification and durable Supabase persistence for Marketplace purchase events.
- Environment-only configuration for client ID, client secret, callback URL and webhook secret.
- A least-privilege starting manifest at `github-app-manifest.json`.
- The manifest is marked public for Marketplace use; it still requires creation,
  owner review and publisher verification in GitHub.

## Current deployment endpoint

Use `buildy.bstudiob.co.uk` for the hosted OAuth and webhook service. Keep the root
`bstudiob.co.uk` on the BStudioB company site. The Railway service is `GhP-WebEditor`
and its Railway hostname is `ngkim3kp.up.railway.app`.

DNS is now configured in Squarespace:

- CNAME `buildy` → `ngkim3kp.up.railway.app`
- TXT `_railway-verify.buildy` → the Railway verification value shown in the Railway
  custom-domain panel

The records resolve publicly. Railway still needs to finish certificate issuance and
the service must return a healthy response at the custom hostname before production
OAuth or Marketplace webhooks are enabled. Hosting usage still needs monitoring against
Railway's current free credits/limits.

## Still required outside the repository

1. Verify Railway TLS and `/health` at `https://buildy.bstudiob.co.uk/health`.
2. Create the GitHub App under a BStudioB-controlled GitHub organisation.
3. Set the production callback and webhook URLs from `github-app-manifest.json`.
4. Complete GitHub App permission review and security testing.
5. Run `supabase-schema.sql`, add the server-only Supabase variables, and test purchase,
   change and cancellation events before enabling paid entitlements.
6. Verify the public privacy, terms, support and status URLs.
7. Obtain real users/installations and validate the £5 Project Pass offer.
8. Request verified publisher status and Marketplace review when the thresholds and product
   requirements are met.

## Important product decision

Buildy remains desktop-first. The £5 Project Pass is a direct one-time offer for individual
makers; the recurring Client Starter and Client Studio plans are for people building for
others and are the plans intended for GitHub Marketplace. Do not submit until the GitHub
App, billing store, support obligations and public deployment have been verified.

Official requirements: https://docs.github.com/en/enterprise-cloud@latest/apps/github-marketplace/creating-apps-for-github-marketplace/requirements-for-listing-an-app
