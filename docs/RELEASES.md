# Desktop releases

GhP WebEditor v1 is a local desktop application. It edits website files in the
workspace, previews them locally, and exports a ZIP for the user to upload to
their GitHub Pages repository themselves.

Update `package.json` to the intended version, commit it, and create a matching
annotated `vX.Y.Z` tag. The release workflow rejects a tag that does not match
the package version.

The signed macOS and Windows build requires these repository secrets:

- `MACOS_CERTIFICATE_P12_BASE64` and `MACOS_CERTIFICATE_PASSWORD`
- `APPLE_API_KEY_BASE64`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`
- `WINDOWS_CERTIFICATE_P12_BASE64` and `WINDOWS_CERTIFICATE_PASSWORD`

The workflow verifies the project, builds universal macOS DMGs and a Windows
NSIS installer, then attaches them to the tagged GitHub release. Never commit
certificates or Apple credentials.
