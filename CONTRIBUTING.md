# Contributing to GitHub Pages Web Editor

Thank you for your interest in contributing to this project!

## Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/GhP-WebEditor.git
   cd GhP-WebEditor
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm start
   ```

## Project Structure

The architecture and test ownership map live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
The root [`AGENTS.md`](AGENTS.md) records security and module-boundary constraints.

```
GhP-WebEditor/
├── public/              # Browser editor UI and preview composer
│   ├── index.html      # Main HTML interface
│   ├── styles.css      # Application styles
│   ├── app.js          # Application logic
│   └── lib/             # Vendor libraries (generated/ignored)
├── lib/                 # Clone/filesystem and optional GitHub App boundaries
├── static/              # Credential-free GitHub Pages product site
├── scripts/             # Pages build/serve and verification scripts
├── test/                # Node API, security, preview, Electron, and Pages tests
├── demo/                # Playwright editor workflows and demonstrations
├── docs/ARCHITECTURE.md # Subsystem/data-flow map
├── AGENTS.md            # AI-agent safety and ownership rules
├── package.json        # Dependencies and scripts
└── README.md           # Documentation
```

## Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Test your changes (use the narrowest relevant command while iterating, then the
   full gate before review):
   ```bash
   npm run lint
   npm test
   npm run test:e2e
   npm run test:electron
   npm run test:pages
   ```

4. Commit your changes:
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Open a Pull Request

## Code Style

- Use consistent indentation (2 spaces)
- Follow existing code patterns
- Add comments for complex logic
- Keep functions focused and small

## Testing

Automated Node, browser, Electron, Pages, build, and dependency-audit checks are
part of the repository. Add regression coverage for behavior changes; see
`docs/ARCHITECTURE.md` and `demo/README.md` for the test ownership map. Manual GUI
scripts remain useful for exploratory checks but are not a substitute for the
automated gate.

## Reporting Issues

When reporting issues, please include:
- Description of the problem
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/OS information
- Screenshots if applicable

## Feature Requests

Feature requests are welcome! Please open an issue describing:
- The feature you'd like to see
- Why it would be useful
- How it should work

## License

This repository is marked `Commercial` in `package.json` and `LICENSE`. Contributions
must follow the repository's current license terms; do not describe the project as
MIT-licensed unless the maintainer changes that policy explicitly.
