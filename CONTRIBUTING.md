# Contributing to Buildy

Thank you for your interest in contributing to this project!

## Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Buildy.git
   cd Buildy
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

```
Buildy/
├── public/              # Frontend files
│   ├── index.html      # Main HTML interface
│   ├── styles.css      # Application styles
│   ├── app.js          # Application logic
│   └── lib/            # Vendor libraries (auto-generated)
├── main.js             # Electron main process
├── server.js           # Express web server
├── setup-libs.js       # Library setup script (Node)
├── setup-libs.sh       # Library setup script (Bash)
├── package.json        # Dependencies and scripts
└── README.md           # Documentation
```

## Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Test your changes:
   ```bash
   npm start
   # OR
   npm run electron
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

Currently, the project uses manual testing. Contributions to add automated tests are welcome!

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

By contributing, you agree that your contributions will be licensed under the MIT License.
