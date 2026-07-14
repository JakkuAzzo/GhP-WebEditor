import { test, expect } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';

async function createFile(page, name, content) {
  await page.click('#newFileBtn');
  await page.fill('#newFileName', name);
  await page.selectOption('#fileTemplate', 'blank');
  await page.click('#createFileSubmit');
  await page.evaluate(value => document.querySelector('.CodeMirror').CodeMirror.setValue(value), content);
  await page.click('#saveFileBtn');
  await expect(page.locator('#fileStatus')).toHaveText('Saved');
}

test('exports the workspace as a runnable ZIP with nested site files', async ({ page }) => {
  await page.goto('/');
  await createFile(page, 'index.html', '<h1>Exported site</h1><link rel="stylesheet" href="css/site.css">');
  await createFile(page, 'css/site.css', 'h1 { color: rebeccapurple; }');
  const downloadPromise = page.waitForEvent('download');
  await page.click('#downloadBtn');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('github-pages-site.zip');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const archive = unzipSync(new Uint8Array(Buffer.concat(chunks)));
  expect(Object.keys(archive).sort()).toEqual(['css/site.css', 'index.html']);
  expect(strFromU8(archive['index.html'])).toContain('Exported site');
  expect(strFromU8(archive['css/site.css'])).toContain('rebeccapurple');
});
