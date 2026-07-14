const fs = require('fs');
const path = require('path');

const roots = ['test', 'public', 'demo'];
const extensions = new Set(['.js', '.json', '.html', '.css', '.md']);
const ignoredDirectories = new Set(['lib', 'node_modules', 'output', 'screenshots', 'test-results', 'playwright-report']);

function hydrate(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      hydrate(fullPath);
    } else if (extensions.has(path.extname(entry.name))) {
      fs.readFileSync(fullPath);
    }
  }
}

for (const root of roots) hydrate(path.join(__dirname, '..', root));
for (const file of ['playwright.config.js', 'playwright.electron.config.js']) {
  fs.readFileSync(path.join(__dirname, '..', file));
}

console.log('Test and application sources hydrated.');
