const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'public/index.html',
  'public/app.js',
  'public/workspace-preview.js',
  'public/styles.css',
  'lib/clone-workspace.js',
  'lib/github-app.js',
  'node_modules/codemirror/lib/codemirror.js',
  'node_modules/marked/lib/marked.umd.js',
  'node_modules/fflate/umd/index.js'
];

const missing = requiredFiles.filter(file => !fs.existsSync(path.join(__dirname, '..', file)));
if (missing.length) {
  console.error(`Build verification failed. Missing: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Build assets verified.');
