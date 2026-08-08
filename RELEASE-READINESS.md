# BStudioB / Buildy release readiness

Last checked: 6 August 2026

This is the non-secret hand-off checklist for the BStudioB Ltd Buildy release. It is
intentionally safe to keep in the repository: it contains no passwords, tokens, bank
details, private keys, or OAuth client secrets.

## Green: completed or verified

- BStudioB Ltd is incorporated (company number 17375993) and the Starling Business account is open.
- Buildy is branded as the product formerly called GhP-WebEditor.
- The public landing page is separated from the protected editor route (`/workspace`).
- The BStudioB site uses the dark Buildy wordmark and compact app icon.
- The Buildy landing page includes the Max Udovichenko portfolio showcase and the existing portfolio demos.
- The Railway service is online at `https://buildy.bstudiob.co.uk` and `/health` returns HTTP 200.
- Supabase schema/RLS is applied and the server-only Supabase variables are configured in Railway.
- Public privacy, terms, support, security, pricing and status pages exist.
- Waitlist consent, FormSubmit redirect, CSP allowance and a public success page are implemented.
- Hosted OAuth/API routes have rate limits, and the token handoff is marked `no-store`.
- Local automated tests pass with `npm test`.

## Amber: safe engineering work still to complete

- Run a production smoke test after each deployment: `/`, `/health`, `/pricing`, `/privacy`,
  `/terms`, `/support`, `/security`, `/status`, and the GitHub OAuth start route.
- Verify the hosted forms in a controlled test window. FormSubmit sends external email, so
  the first live submission remains an owner-approved test rather than an automated action.
- Exercise Marketplace webhook signature handling with a local fixture; never replay a live
  purchase event without an approved test event and a known test secret.
- Add a deployment monitor and record the Railway free-credit balance before launch.
- Keep `AUTH_REQUIRED`/private-beta mode and the public landing mode explicit for every deploy.
- Keep the Buildy source repository private; distribute paid builds through an authenticated
  download flow rather than public releases or a cloneable repository.

## Red: requires Nathan's direct action

- Finish Stripe business verification and payout onboarding in UK/GBP, then approve a controlled
  test payment. Do not use personal banking details for company checkout once the company account
  is available.
- Decide whether checkout is Stripe or Squarespace Pay Links and approve the final fee/refund terms.
- Reveal/store the GitHub OAuth secret through the GitHub UI and upload the approved Buildy logo.
- Create/verify the BStudioB GitHub organisation, publisher identity, Marketplace billing plans,
  and production webhook configuration.
- Confirm The Formation Company subscription, Companies House authentication-code handoff and HMRC UTR.
- Choose insurance cover and approve any funding, grant, loan or accelerator applications.

## Release gate

Do not enable paid entitlements or submit to GitHub Marketplace until the red items are complete,
the production smoke test is clean, account deletion/support paths are documented, and the first
controlled payment and webhook test have been reconciled against the company account.
