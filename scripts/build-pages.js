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

for (const file of ['index.html', 'app.js', 'styles.css', 'workspace-preview.js']) {
  copyFile(`public/${file}`, file);
}
if (fs.existsSync(path.join(root, 'public', 'assets'))) copyDirectory('public/assets', 'assets');
copyFile('static/static-api.js', 'static-api.js');

const codeMirrorFiles = [
  'lib/codemirror.js', 'lib/codemirror.css',
  'mode/htmlmixed/htmlmixed.js', 'mode/css/css.js', 'mode/javascript/javascript.js',
  'mode/markdown/markdown.js', 'mode/xml/xml.js',
  'theme/monokai.css', 'theme/dracula.css', 'theme/material.css', 'theme/eclipse.css', 'theme/zenburn.css',
  'addon/hint/show-hint.js', 'addon/hint/show-hint.css', 'addon/hint/html-hint.js',
  'addon/hint/css-hint.js', 'addon/hint/javascript-hint.js', 'addon/hint/anyword-hint.js',
  'addon/search/searchcursor.js'
];
for (const file of codeMirrorFiles) copyFile(`node_modules/codemirror/${file}`, `lib/codemirror/${file}`);

copyFile('node_modules/marked/lib/marked.umd.js', 'lib/marked/lib/marked.umd.js');
copyFile('node_modules/fflate/umd/index.js', 'lib/fflate/umd/index.js');
copyFile('node_modules/@fortawesome/fontawesome-free/css/all.min.css', 'lib/fontawesome/fontawesome-free/css/all.min.css');
copyDirectory('node_modules/@fortawesome/fontawesome-free/webfonts', 'lib/fontawesome/fontawesome-free/webfonts');

const indexPath = path.join(output, 'index.html');
const index = fs.readFileSync(indexPath, 'utf8')
  .replace(/(["'])\/lib\//g, '$1lib/')
  .replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\' data: blob:; style-src \'self\' \'unsafe-inline\' https:; img-src \'self\' data: blob: https:; font-src \'self\' data: https:; connect-src \'self\' https:; frame-src \'self\' data: blob:; media-src \'self\' data: blob: https:; object-src \'none\'; base-uri \'self\'; form-action \'none\'">'
  )
  .replace(
    '<script src="workspace-preview.js"></script>',
    '<script src="static-api.js"></script>\n    <script src="workspace-preview.js"></script>'
  );
fs.writeFileSync(indexPath, index);
fs.writeFileSync(path.join(output, '.nojekyll'), '');

const required = ['index.html', 'app.js', 'static-api.js', 'lib/codemirror/lib/codemirror.js', 'lib/marked/lib/marked.umd.js'];
const missing = required.filter(file => !fs.existsSync(path.join(output, file)));
if (missing.length) throw new Error(`Static build is incomplete: ${missing.join(', ')}`);

console.log('Static GitHub Pages site built in dist/.');
