# GhP WebEditor Demo & Tests

This folder contains automated testing and demonstration scripts for the GhP WebEditor application using Playwright.

## 📋 Contents

- **sports-demo.js** - Comprehensive demo that builds a complete sports website with images
- **tests.spec.js** - Full test suite covering all major features
- **package.json** - Dependencies and npm scripts

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed
- Main application running on `http://localhost:3000`

### Installation

```bash
cd demo
npm install
npm run install-browsers
```

### Running the Demo

The sports demo will automatically:
1. Launch the web editor
2. Create 3 files (HTML, CSS, JavaScript)
3. Build a complete sports website with:
   - Hero section
   - Featured matches grid
   - Latest news cards
   - Live stats dashboard
   - Responsive footer
4. Save all files
5. Preview the site
6. Export the project
7. Take screenshots at each step
8. Generate a metrics report

```bash
npm run demo
```

**Output:**
- `screenshots/` - PNG files showing each step
- `output/preview/` - Extracted HTML/CSS/JS files (ready to open!)
- `output/` - Exported project files and metrics report

### Viewing the Sports Website

After running the demo, view the generated website:

```bash
npm run preview
```

Or manually open: `output/preview/index.html`

To extract preview files from an export:

```bash
npm run extract
```

### Running Tests

Run all automated tests:

```bash
npm test
```

Run tests with visible browser (debugging):

```bash
npm run test:headed
```

## 📸 Screenshot Gallery

The demo captures screenshots at these checkpoints:
1. **01-welcome.png** - Initial application state
2. **02-file-created.png** - After creating index.html
3. **03-styles-created.png** - After creating styles.css
4. **04-script-created.png** - After creating script.js
5. **05-preview.png** - Preview of the rendered site
6. **06-export.png** - Export functionality

## 🧪 Test Coverage

The test suite covers:

- ✅ Application loading and initialization
- ✅ File creation (HTML, CSS, JS, TXT)
- ✅ Folder creation and organization
- ✅ File saving and status updates
- ✅ Git repository cloning
- ✅ Opening cloned files
- ✅ Preview toggle and rendering
- ✅ File search functionality
- ✅ Tab switching between files
- ✅ File deletion
- ✅ Complete sports website build

## 📊 Demo Metrics

The sports demo generates a metrics report including:

```json
{
  "demoName": "Sports Website Builder",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "duration": "45s",
  "filesCreated": 3,
  "linesOfCode": 250,
  "features": [
    "Responsive Design",
    "Live Score Updates",
    "Smooth Scrolling",
    "Animated Stats",
    "News Grid",
    "Hero Section"
  ],
  "screenshots": 6,
  "success": true
}
```

## 🏗️ Sports Website Structure

The demo builds a complete sports website with:

### HTML (`index.html`)
- Navigation bar with logo and menu
- Hero section with call-to-action
- Featured matches grid (3 cards)
- Latest news section (3 articles)
- Live stats dashboard
- Footer with social links

### CSS (`styles.css`)
- Modern, responsive design
- CSS Grid and Flexbox layouts
- Smooth animations and transitions
- Mobile-friendly breakpoints
- Custom color scheme

### JavaScript (`script.js`)
- Smooth scroll navigation
- Live score updates simulation
- Animated statistics counters
- Intersection Observer for animations

## 🖼️ Image Sources

The demo uses public domain sports images from Wikimedia Commons:
- Football/Soccer stadium
- Tennis court
- Athletics track

## 🐛 Troubleshooting

### Port Already in Use
If the demo fails because port 3000 is busy, update the server port and the demo URL:

```javascript
// In sports-demo.js, line ~15
await page.goto('http://localhost:YOUR_PORT');
```

### Browser Not Installed
If Playwright browsers aren't installed:

```bash
npm run install-browsers
```

### Test Failures
- Ensure the main application is running before tests
- Check server logs for errors
- Verify no modal dialogs are blocking UI
- Increase timeouts if your system is slow

### Screenshots Not Saved
Check that the demo has write permissions:

```bash
chmod +w screenshots/
chmod +w output/
```

## 📝 Customizing the Demo

### Change Demo Content

Edit `sports-demo.js` and modify the `SPORTS_SITE` object:

```javascript
const SPORTS_SITE = {
  html: '<!-- Your HTML -->',
  css: '/* Your CSS */',
  js: '// Your JavaScript'
};
```

### Add More Screenshots

Insert additional capture points:

```javascript
await page.screenshot({ 
  path: path.join(screenshotsDir, '07-custom-step.png'),
  fullPage: true 
});
```

### Adjust Timing

Increase wait times if steps fail:

```javascript
await page.waitForTimeout(2000); // Wait 2 seconds
```

## 🔍 Advanced Testing

### Running Specific Tests

```bash
npx playwright test --grep "should create a new file"
```

### Debug Mode

```bash
npx playwright test --debug
```

### Generate HTML Report

```bash
npx playwright test --reporter=html
npx playwright show-report
```

## 📚 Learn More

- [Playwright Documentation](https://playwright.dev)
- [GhP WebEditor README](../README.md)
- [Test Best Practices](https://playwright.dev/docs/best-practices)

## 🤝 Contributing

To add new tests:
1. Create test cases in `tests.spec.js`
2. Follow existing naming conventions
3. Add appropriate waits and assertions
4. Document expected behavior

## 📄 License

Same as parent project (see ../LICENSE)
