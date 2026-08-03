# Buildy — free hosting and domain plan

## Recommended architecture

- `bstudiob.co.uk`: BStudioB company website on GitHub Pages.
- `buildy.bstudiob.co.uk`: Buildy's authenticated Express backend on the existing Railway service.
- Desktop app: local embedded server; no hosting required.
- GitHub App: OAuth callback and Marketplace webhook on the Buildy subdomain.

## Steps

1. In Railway, generate the service's free `*.up.railway.app` domain.
2. Confirm the service listens on Railway's `PORT` variable and `/health` returns `200`.
3. In the Squarespace DNS panel, add the CNAME Railway gives for `buildy.bstudiob.co.uk`.
4. Wait for HTTPS to provision and verify `/health` through the company subdomain.
5. Set Railway variables:

   - `BUILDY_GITHUB_CLIENT_ID`
   - `BUILDY_GITHUB_CLIENT_SECRET`
   - `BUILDY_GITHUB_CALLBACK_URL=https://buildy.bstudiob.co.uk/auth/github/callback`
   - `BUILDY_GITHUB_WEBHOOK_SECRET`
   - `BUILDY_SESSION_SECRET`
   - `BUILDY_PUBLIC_MODE=true`
   - `BUILDY_TOKEN_ENCRYPTION_KEY`
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (free Supabase project; run `supabase-schema.sql` first)

6. Finish the GitHub App draft using:

   - callback: `https://buildy.bstudiob.co.uk/auth/github/callback`
   - webhook: `https://buildy.bstudiob.co.uk/api/github/marketplace/webhook`

## Cost control

Do not purchase a second domain, hosting plan, or Firebase paid tier. Keep the service
private until the endpoint, authentication, permissions, and webhook signature checks have
been tested. Monitor Railway usage because a free domain does not mean unlimited compute.
