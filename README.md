# GhP-WebEditor
A comprehensive UI web editor for GitHub Pages that works in the browser and allows full customization, adding/deleting pages, and everything you need to manage your GitHub Pages projects.

## Features

- 🎨 **Rich Web Editor**: Full-featured code editor with syntax highlighting for HTML, CSS, JavaScript, Markdown, and more
- 📁 **File Management**: Create, edit, delete files and folders with an intuitive file tree interface
- 🔗 **GitHub Integration**: Connect to your GitHub account to clone, edit, and push changes to your repositories
- 👁️ **Live Preview**: Preview HTML and Markdown files in real-time
- 💾 **Auto-Save**: Automatic local storage of your work
- 📥 **Download/Export**: Export your project as JSON for backup or transfer
- 🖥️ **Multiple Deployment Options**: Run as a web app via npm or as a desktop Electron app
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Installation

### Option 1: Run as Web Application (npm)

```bash
# Clone the repository
git clone https://github.com/JakkuAzzo/GhP-WebEditor.git
cd GhP-WebEditor

# Install dependencies
npm install

# Start the web server
npm start
```

Then open your browser to `http://localhost:3000`

### Option 2: Run as Electron Desktop App

```bash
# Install dependencies (if not already done)
npm install

# Start Electron app
npm run electron
```

## Usage

### Getting Started

1. **Create New Files**: Click the "+" icon in the sidebar to create new HTML, CSS, JavaScript, or Markdown files
2. **Edit Files**: Click on any file in the file tree to open it in the editor
3. **Save Changes**: Press `Ctrl+S` (or `Cmd+S` on Mac) or click the "Save" button
4. **Preview**: Click the "Preview" button to see your HTML or Markdown rendered in real-time

### GitHub Integration

1. **Connect to GitHub**:
   - Click the "Connect GitHub" button in the header
   - Generate a Personal Access Token at [GitHub Settings](https://github.com/settings/tokens/new)
   - Required scopes: `repo` (Full control of private repositories) and `read:user` (Read user profile data)
   - Enter your token and click "Connect"

2. **Select Repository**:
   - Once connected, your repositories will appear in the dropdown
   - Select a repository to load its contents

3. **Edit and Push**:
   - Make changes to files
   - Click "Save" to push changes back to GitHub
   - Commit messages are automatically generated

### File Operations

- **New File**: Click the file+ icon or use the welcome screen button
- **New Folder**: Click the folder+ icon (folders are automatically created when saving files with paths)
- **Delete File**: Open a file and click the "Delete" button
- **Refresh**: Click the refresh icon to reload the file tree from GitHub

### Keyboard Shortcuts

- `Ctrl+S` / `Cmd+S`: Save current file
- Tab key: Insert spaces (configurable)
- Auto-close brackets and quotes

## Project Structure

```
GhP-WebEditor/
├── public/
│   ├── index.html      # Main HTML interface
│   ├── styles.css      # Application styles
│   └── app.js          # Application logic
├── main.js             # Electron main process
├── server.js           # Express web server
├── package.json        # Node.js dependencies
└── README.md           # This file
```

## Technologies Used

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Editor**: CodeMirror - Advanced code editor library
- **Markdown**: Marked.js - Markdown parser
- **Backend**: Express.js - Web server
- **Desktop**: Electron - Cross-platform desktop apps
- **API**: GitHub REST API v3

## GitHub API Permissions

The editor requires the following GitHub permissions:
- `repo`: To read and write repository contents
- `read:user`: To read user profile information

These are required to:
- List your repositories
- Read file contents
- Create/update/delete files
- Commit and push changes

## Security Notes

- GitHub Personal Access Tokens are stored in browser localStorage
- Never share your token with others
- Tokens are only sent to GitHub's API endpoints
- Use tokens with minimal required permissions
- Revoke tokens at https://github.com/settings/tokens if compromised

## Browser Compatibility

- Chrome/Edge: ✅ Fully supported
- Firefox: ✅ Fully supported
- Safari: ✅ Fully supported
- Opera: ✅ Fully supported

## Electron Compatibility

- Windows: ✅ Supported
- macOS: ✅ Supported
- Linux: ✅ Supported

## Development

### Running in Development Mode

```bash
npm start
```

### Building for Production

The application can be distributed as:
1. **Web App**: Deploy the `public/` folder to any static hosting
2. **Electron App**: Use `electron-builder` to create installers

## Limitations

- Folder navigation is simplified in the current version
- Large files (>1MB) may impact performance
- GitHub API rate limits apply (60 requests/hour unauthorized, 5000/hour authorized)

## Future Enhancements

- [ ] Advanced folder/directory navigation
- [ ] Multiple file selection and bulk operations
- [ ] Git commit history viewer
- [ ] Collaborative editing features
- [ ] Custom themes
- [ ] Plugin system
- [ ] File search functionality
- [ ] Auto-completion
- [ ] Diff viewer for changes

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## Acknowledgments

- CodeMirror for the excellent code editor
- GitHub for the API
- Font Awesome for icons
- The open-source community 
