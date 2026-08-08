# Security Policy

## Supported Versions

Currently supporting the latest version of this project.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Considerations

### Hosted mode

The hosted Buildy service uses GitHub OAuth. The access token is held in the server-side
session and encrypted before it is persisted in the session store when
`BUILDY_TOKEN_ENCRYPTION_KEY` is configured. The browser receives only the data needed for
the current editor session. OAuth uses a session-bound state value to prevent request forgery.

The hosted service requests only the GitHub permissions required by the configured GitHub
App. The source repository is private and is not used as a public download channel.

### Desktop mode

The downloadable desktop application may accept a user-supplied GitHub token for local use.
Users should create the narrowest fine-grained token possible, avoid sharing it, and revoke
it when the project is finished. Desktop credentials remain under the user's local control.

### Best Practices

1. **Generate Tokens with Minimum Permissions**: Only grant the scopes you need
2. **Use Fine-Grained Personal Access Tokens**: If available, use GitHub's fine-grained tokens for better security
3. **Rotate Tokens Regularly**: Change your tokens periodically
4. **Revoke Unused Tokens**: Remove tokens at https://github.com/settings/tokens if no longer needed
5. **Don't Share Tokens**: Never share your personal access token with others

### Runtime protections

The hosted service applies rate limits to login, OAuth, API and Marketplace webhook routes.
It also uses Helmet security headers, a restricted form-action policy, bounded JSON bodies,
session cookies marked HttpOnly/SameSite, and path validation that rejects symlinks and
`.git` access from cloned repositories.

#### Dependency Vulnerabilities

We regularly monitor and update dependencies to address security vulnerabilities. The project uses:
- Latest Electron version (to fix heap buffer overflow and ASAR integrity issues)
- CodeMirror 5.65.16
- Express 4.18.2
- Other up-to-date dependencies

## Reporting a Vulnerability

If you discover a security vulnerability, please:

1. **Do NOT** open a public issue
2. Email the maintainers directly (or use GitHub's private vulnerability reporting)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

## Security Updates

Security updates will be released as soon as possible after a vulnerability is confirmed. Check the releases page for updates.

## CORS and CSP

The hosted service does not enable broad CORS. Helmet supplies the default content-security
policy; the only external form destination explicitly allowed is FormSubmit for the public
waitlist/contact forms.

## Data Privacy

- Hosted GitHub identity and authorised repository access are processed through GitHub OAuth.
- Hosted sessions use an HttpOnly cookie; repository clones are temporary and expire after one hour.
- Desktop projects remain on the user's computer unless the user explicitly exports or uploads them.
- No analytics or tracking is implemented by Buildy.

## Secure Development

This project follows secure development practices:
- Regular dependency updates
- Security audits with npm audit
- CodeQL static analysis
- Minimal external dependencies
- No eval() or similar dangerous functions
- Input sanitization for file operations
