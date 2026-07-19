# Production deployment

GhP WebEditor has three separate surfaces:

- **GitHub Pages** is the public product and download site. It never receives GitHub credentials.
- **Railway** hosts the GitHub-connected editor. It creates review pull requests; it never merges them or changes a repository's Pages settings.
- **Desktop installers** are local/ZIP-first workspaces. When `GHP_WEB_APP_URL` is supplied, their GitHub button opens the hosted editor.

## Railway

1. Create a Railway project from this repository and deploy the intended server branch.
2. Railway uses `railway.toml`; its health check is `GET /api/health`.
3. Create a public Railway domain, then set `GHP_WEB_APP_URL` to that exact HTTPS origin.
4. Set `GITHUB_APP_CALLBACK_URL` to `<origin>/api/auth/github/callback`, plus the GitHub App client ID, client secret, and slug.
5. Keep the service at one replica until sessions move from the in-memory store to shared storage. A restart signs users out, which is intentional and safe.

## GitHub App

Create an app under the project owner's GitHub account or organization:

- Callback URL: `<origin>/api/auth/github/callback`
- Setup URL: `<origin>/api/auth/github/setup`
- User authorization callback: enabled
- Repository permissions: **Contents: read and write**, **Pages: read**
- Installation: users choose all repositories or selected repositories themselves

Verify with a dedicated test repository: sign in as the repository owner, install only that test repository, edit a file, create a review PR, merge it manually, and confirm the GitHub Pages workflow deploys the correct commit.

## Signed desktop releases

Update `package.json` to the intended version, commit it, and create a matching
annotated `vX.Y.Z` tag after all checks pass. The release workflow rejects a tag that
does not match the package version and expects these repository secrets:

- `MACOS_CERTIFICATE_P12_BASE64` and `MACOS_CERTIFICATE_PASSWORD`
- `APPLE_API_KEY_BASE64`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER` (the `.p8`
  key file must be base64 encoded before saving it as a secret)
- `WINDOWS_CERTIFICATE_P12_BASE64` and `WINDOWS_CERTIFICATE_PASSWORD`

The workflow verifies the project, builds universal macOS DMGs and a Windows NSIS installer, then attaches them to the tagged GitHub release. Never put certificates, Apple credentials, GitHub App secrets, or Railway variables in the repository.
