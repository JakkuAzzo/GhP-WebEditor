const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(path.join(output, destination)), { recursive: true });
  fs.copyFileSync(path.join(root, source), path.join(output, destination));
}

function copyDirectory(source, destination) {
  fs.mkdirSync(path.dirname(path.join(output, destination)), { recursive: true });
  fs.cpSync(path.join(root, source), path.join(output, destination), { recursive: true });
}

fs.rmSync(output, { recursive: true, force: true });

copyFile('static/landing.html', 'index.html');
copyFile('static/landing.css', 'landing.css');
if (fs.existsSync(path.join(root, 'public', 'assets'))) copyDirectory('public/assets', 'assets');
copyFile('node_modules/@fortawesome/fontawesome-free/css/all.min.css', 'lib/fontawesome/fontawesome-free/css/all.min.css');
copyDirectory('node_modules/@fortawesome/fontawesome-free/webfonts', 'lib/fontawesome/fontawesome-free/webfonts');

const indexPath = path.join(output, 'index.html');
const index = fs.readFileSync(indexPath, 'utf8')
  .replace(/(["'])\/lib\//g, '$1lib/')
  .replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n  <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; style-src \'self\'; img-src \'self\'; font-src \'self\'; object-src \'none\'; base-uri \'none\'; form-action https://formsubmit.co">'
  );
fs.writeFileSync(indexPath, index);
fs.writeFileSync(path.join(output, '.nojekyll'), '');

const required = ['index.html', 'landing.css', 'lib/fontawesome/fontawesome-free/css/all.min.css'];
const missing = required.filter(file => !fs.existsSync(path.join(output, file)));
if (missing.length) throw new Error(`Static build is incomplete: ${missing.join(', ')}`);

console.log('Static GitHub Pages site built in dist/.');
