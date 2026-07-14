import { test, expect } from '@playwright/test';

test('visually edits and reorders nested blocks without leaking editor metadata', async ({ page }) => {
  await page.goto('/');
  await page.click('#newFileBtn');
  await page.fill('#newFileName', 'visual.html');
  await page.selectOption('#fileTemplate', 'blank');
  await page.click('#createFileSubmit');
  const source = '<!doctype html><html><head><title>Visual</title></head><body><main><section id="one">One</section><section id="two">Two</section></main><script src="app.js"></script></body></html>';
  await page.evaluate(value => document.querySelector('.CodeMirror').CodeMirror.setValue(value), source);
  await page.click('#guiModeBtn');

  await page.locator('#guiCanvas #two').click();
  await page.click('#moveGuiUp');
  await page.locator('#guiCanvas #two').evaluate(element => { element.textContent = 'Two edited'; });
  await page.click('#applyGuiChanges');

  const result = await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
  expect(result.indexOf('id="two"')).toBeLessThan(result.indexOf('id="one"'));
  expect(result).toContain('Two edited');
  expect(result).toContain('<title>Visual</title>');
  expect(result).toContain('<script src="app.js"></script>');
  expect(result).not.toContain('gui-selected');
  expect(result).not.toContain('draggable=');
});
