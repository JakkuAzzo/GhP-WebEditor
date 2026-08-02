import { test, expect } from '@playwright/test';
import { strFromU8, unzipSync, zipSync } from 'fflate';

async function createFile(page, name, content) {
  await page.click('#newFileBtn');
  await page.fill('#newFileName', name);
  await page.selectOption('#fileTemplate', 'blank');
  await page.click('#createFileSubmit');
  await page.locator('.CodeMirror').waitFor();
  await page.evaluate(value => document.querySelector('.CodeMirror').CodeMirror.setValue(value), content);
  await page.click('#saveFileBtn');
  await expect(page.locator('#fileStatus')).toHaveText('Saved');
}

test('renders nested pages, CSS imports, CSS URLs, and local image assets', async ({ page }) => {
  await page.goto('/');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>';
  await createFile(page, 'assets/logo.svg', svg);
  await createFile(page, 'styles/theme.css', 'h1 { font-weight: 700; }');
  await createFile(page, 'styles/base.css', '@import "./theme.css"; .hero { background-image: url("../assets/logo.svg"); }');
  await createFile(page, 'pages/index.html', '<!doctype html><html><head><link rel="stylesheet" href="../styles/base.css"></head><body><main class="hero"><h1>Asset preview</h1><img src="../assets/logo.svg?v=1#mark" alt="Logo"></main></body></html>');
  await page.click('#previewBtn');
  const preview = page.frameLocator('#previewFrame');
  await expect(preview.locator('h1')).toHaveCSS('font-weight', '700');
  await expect(preview.locator('img')).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
  await expect.poll(() => preview.locator('.hero').evaluate(element => getComputedStyle(element).backgroundImage)).toContain('data:image/svg+xml;base64,');
});

async function importZip(page, name, files) {
  const archive = zipSync(Object.fromEntries(Object.entries(files).map(([path, content]) => [
    path,
    typeof content === 'string' ? new TextEncoder().encode(content) : content
  ])));
  await page.setInputFiles('#importFileInput', {
    name,
    mimeType: 'application/zip',
    buffer: Buffer.from(archive)
  });
  await expect(page.locator('#confirmImportBtn')).toBeEnabled();
  await page.click('#confirmImportBtn');
}

test('previews a React/Vite production build and rewrites module assets', async ({ page }) => {
  await page.goto('/');
  await importZip(page, 'react-vite-dist.zip', {
    'index.html': '<!doctype html><html><head><link rel="stylesheet" href="/assets/index.css"></head><body><div id="root"></div><script type="module" src="/assets/index.js"></script></body></html>',
    'assets/index.css': '#root { color: rgb(12, 92, 180); }',
    'assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="blue"/></svg>',
    'assets/index.js': "const logo = new URL('./logo.svg', import.meta.url); document.querySelector('#root').innerHTML = `<main><h1>React production build</h1><img src=\"${logo}\" alt=\"React logo\"></main>`;"
  });
  await page.fill('#fileSearchInput', 'index.html');
  await page.locator('#fileTree .file-tree-item.file').filter({ hasText: 'index.html' }).click();
  await page.click('#previewBtn');
  const preview = page.frameLocator('#previewFrame');
  await expect(preview.locator('h1')).toHaveText('React production build');
  await expect(preview.locator('main')).toHaveCSS('color', 'rgb(12, 92, 180)');
  await expect(preview.locator('img')).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
});

test('imports and exports a React source project without running build scripts', async ({ page }) => {
  await page.goto('/');
  await importZip(page, 'react-source.zip', {
    'package.json': JSON.stringify({ scripts: { build: 'vite build' }, dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' } }),
    'index.html': '<div id="root"></div><script type="module" src="/src/main.jsx"></script>',
    'src/App.jsx': 'export default function App() { return <main>React source</main>; }',
    'src/main.jsx': "import { createRoot } from 'react-dom/client'; import App from './App.jsx'; createRoot(document.getElementById('root')).render(<App />);"
  });
  await expect(page.locator('#fileTree')).toContainText('package.json');
  await page.fill('#fileSearchInput', 'src/App.jsx');
  await expect(page.locator('#fileTree')).toContainText('src/App.jsx');
  const downloadPromise = page.waitForEvent('download');
  await page.click('#downloadBtn');
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const archive = unzipSync(new Uint8Array(Buffer.concat(chunks)));
  expect(strFromU8(archive['package.json'])).toContain('vite build');
  expect(strFromU8(archive['src/App.jsx'])).toContain('React source');
});
