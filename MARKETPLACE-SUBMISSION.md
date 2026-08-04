# Buildy Marketplace submission runbook

This is the final operator sequence after the code and public pages are deployed. It
contains no credentials or webhook secrets.

## 1. Configure the hosted service

In Railway, add these server-only variables to the Buildy service:

```text
BUILDY_SESSION_SECRET                 # at least 32 random bytes
BUILDY_PUBLIC_MODE=true
BUILDY_TOKEN_ENCRYPTION_KEY           # at least 32 random bytes
BUILDY_GITHUB_CLIENT_ID
BUILDY_GITHUB_CLIENT_SECRET
BUILDY_GITHUB_CALLBACK_URL=https://buildy.bstudiob.co.uk/auth/github/callback
BUILDY_GITHUB_WEBHOOK_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NODE_ENV=production
```

Run `supabase-schema.sql` in the Supabase project before enabling Marketplace billing.
Do not add `BUILDY_USERS` for public mode; hosted users should enter through GitHub
OAuth. Verify:

- `GET https://buildy.bstudiob.co.uk/marketplace` → 200
- `GET https://buildy.bstudiob.co.uk/health` → `status: ok` and all required config flags true
- `/auth/github/start` redirects to GitHub
- OAuth callback returns to Buildy with a valid session

## 2. Create the GitHub App

Use `github-app-manifest.json` as the source of truth. Create the App under the
`BStudioB-Ltd` organisation, set the webhook secret, and keep the App public. Install
it only on a test repository first, then verify read/write behaviour and uninstall it.

## 3. Create the Marketplace draft

Use the public product page as the listing URL:

`https://buildy.bstudiob.co.uk/marketplace`

Add the logo, feature image, screenshots, description, support email, privacy URL,
terms URL and pricing. Configure the Marketplace webhook to:

`https://buildy.bstudiob.co.uk/api/github/marketplace/webhook`

Send signed test events and confirm purchase, change and cancellation records are
written to Supabase and that cancelled access is removed.

## 4. Pricing constraint

GitHub Marketplace supports recurring flat-rate or per-unit monthly/yearly plans. The
£5 one-time Project Pass must remain a direct BStudioB/Stripe offer; list only the
recurring Client Starter and Client Studio plans in Marketplace.

## 5. Verification and submission

Before requesting review, the organisation owner must enable two-factor authentication,
verify `bstudiob.co.uk`, request publisher verification, complete financial onboarding,
and confirm that support, privacy, terms, refunds and deletion requests are operational.

Do not submit while the App is invite-only, the webhook is untested, or the production
health flags are incomplete.
