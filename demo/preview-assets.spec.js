import { test, expect } from '@playwright/test';

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
