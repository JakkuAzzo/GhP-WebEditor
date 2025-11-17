const fs = require('fs');
const path = require('path');

console.log('Setting up vendor libraries...');

// Function to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  // Create lib directory if it doesn't exist
  if (!fs.existsSync('public/lib')) {
    fs.mkdirSync('public/lib', { recursive: true });
  }

  // Copy CodeMirror
  console.log('Copying CodeMirror...');
  copyDir('node_modules/codemirror', 'public/lib/codemirror');

  // Copy Marked
  console.log('Copying Marked...');
  copyDir('node_modules/marked', 'public/lib/marked');

  // Copy Font Awesome
  console.log('Copying Font Awesome...');
  if (!fs.existsSync('public/lib/fontawesome')) {
    fs.mkdirSync('public/lib/fontawesome', { recursive: true });
  }
  copyDir('node_modules/@fortawesome/fontawesome-free', 'public/lib/fontawesome/fontawesome-free');

  console.log('Setup complete! You can now run "npm start" or "npm run electron"');
} catch (error) {
  console.error('Error setting up libraries:', error);
  process.exit(1);
}
