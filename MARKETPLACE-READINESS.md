# Buildy — GitHub Marketplace readiness

## Implemented in this repository

- GitHub App OAuth start and callback with a session-bound state value.
- Encrypted-in-session access-token handoff to the existing GitHub API client.
- HMAC-SHA256 verification and durable Supabase persistence for Marketplace purchase events.
- Environment-only configuration for client ID, client secret, callback URL and webhook secret.
- A least-privilege starting manifest at `github-app-manifest.json`.

## Intended free deployment endpoint

Use `buildy.bstudiob.co.uk` for the hosted OAuth and webhook service. Keep the root
`bstudiob.co.uk` on the BStudioB company site. Railway can provide a free
`*.up.railway.app` domain; the Squarespace DNS zone can then point the `buildy` CNAME at
that Railway target. Hosting usage still needs monitoring against Railway's current free
credits/limits.

## Still required outside the repository

1. Generate the Railway public domain for the existing Buildy service.
2. Add `buildy.bstudiob.co.uk` as a CNAME in the domain's DNS and verify HTTPS.
3. Create the GitHub App under a BStudioB-controlled GitHub organisation.
4. Set the production callback and webhook URLs.
5. Complete GitHub App permission review and security testing.
6. Run `supabase-schema.sql`, add the server-only Supabase variables, and test purchase,
   change and cancellation events before enabling paid entitlements.
7. Prepare privacy, terms, support and status URLs.
8. Obtain real users/installations and validate the £5 Project Pass offer.
9. Request verified publisher status and Marketplace review when the thresholds and product
   requirements are met.

## Important product decision

Buildy remains desktop-first. The £5 Project Pass is a direct one-time offer for individual
makers; the recurring Client Starter and Client Studio plans are for people building for
others and are the plans intended for GitHub Marketplace. Do not submit until the GitHub
App, billing store, support obligations and public deployment have been verified.

Official requirements: https://docs.github.com/en/enterprise-cloud@latest/apps/github-marketplace/creating-apps-for-github-marketplace/requirements-for-listing-an-app
