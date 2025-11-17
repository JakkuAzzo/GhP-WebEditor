# Security Policy

## Supported Versions

Currently supporting the latest version of this project.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Considerations

### GitHub Personal Access Token

This application requires a GitHub Personal Access Token to access the GitHub API. Please note:

1. **Token Storage**: Tokens are stored in browser localStorage
2. **Token Transmission**: Tokens are only sent to GitHub's API endpoints (api.github.com)
3. **Token Permissions**: Only request the minimum required scopes:
   - `repo`: For reading and writing repository contents
   - `read:user`: For reading user profile information

### Best Practices

1. **Generate Tokens with Minimum Permissions**: Only grant the scopes you need
2. **Use Fine-Grained Personal Access Tokens**: If available, use GitHub's fine-grained tokens for better security
3. **Rotate Tokens Regularly**: Change your tokens periodically
4. **Revoke Unused Tokens**: Remove tokens at https://github.com/settings/tokens if no longer needed
5. **Don't Share Tokens**: Never share your personal access token with others

### Known Issues

#### Rate Limiting (Low Severity)

The development server (server.js) does not implement rate limiting. This is acceptable for local development but should be addressed if deploying to production.

**Mitigation**: This application is designed for local use. If deploying publicly, implement rate limiting middleware such as `express-rate-limit`.

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

The application runs locally and does not implement CORS restrictions. When making API calls to GitHub, standard browser security policies apply.

## Data Privacy

- No user data is sent to third parties except GitHub API
- Files are stored locally in browser localStorage
- No analytics or tracking is implemented
- No cookies are used

## Secure Development

This project follows secure development practices:
- Regular dependency updates
- Security audits with npm audit
- CodeQL static analysis
- Minimal external dependencies
- No eval() or similar dangerous functions
- Input sanitization for file operations
