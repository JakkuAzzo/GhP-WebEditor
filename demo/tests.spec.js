import { test, expect } from '@playwright/test';

async function setEditorContent(page, content) {
  await page.locator('.CodeMirror').waitFor();
  await page.evaluate(value => {
    document.querySelector('.CodeMirror').CodeMirror.setValue(value);
  }, content);
}

async function getEditorContent(page) {
  return page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
}

async function createFileWithContent(page, name, content) {
  await page.click('#newFileBtn');
  await page.fill('#newFileName', name);
  await page.selectOption('#fileTemplate', 'blank');
  await page.click('#createFileSubmit');
  await setEditorContent(page, content);
  await page.click('#saveFileBtn');
  await expect(page.locator('#fileStatus')).toHaveText('Saved');
}

test.describe('Buildy Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should load the application', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('GitHub Pages Web Editor');
    await expect(page.locator('.welcome-screen')).toBeVisible();
  });

  test('should create a new file', async ({ page }) => {
    // Click new file button
    await page.click('#newFileBtn');
    
    // Wait for modal
    await expect(page.locator('#newFileModal')).toHaveClass(/active/);
    
    // Fill form
    await page.fill('#newFileName', 'test.html');
    await page.selectOption('#fileTemplate', 'html');
    
    // Create file
    await page.click('#createFileSubmit');
    
    // Wait for editor to show
    await expect(page.locator('#editorWrapper')).toBeVisible();
    await expect(page.locator('#currentFileName')).toContainText('test.html');
    await expect(page.locator('#fileStatus')).toHaveText('Unsaved');
  });

  test('should save file content', async ({ page }) => {
    // Create file
    await page.click('#newFileBtn');
    await page.fill('#newFileName', 'test.txt');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(500);
    
    // Add content
    await setEditorContent(page, 'Hello World');
    
    // Save
    await page.click('#saveFileBtn');
    await page.waitForTimeout(500);
    
    // Check status
    await expect(page.locator('#fileStatus')).toContainText('Saved');
  });

  test('should clone a repository', async ({ page }) => {
    // Click clone button
    await page.click('#openCloneModalBtn');
    
    // Wait for modal
    await expect(page.locator('#repoCloneModal')).toHaveClass(/active/);
    
    // Fill URL
    await page.fill('#repoUrl', 'https://fixture.test/sample/repo.git');
    
    // Clone
    await page.click('#cloneRepoSubmit');
    
    // Wait for clone to complete (may take a few seconds)
    const fileTree = page.locator('#fileTree');
    await expect(fileTree).toContainText('index.html');
  });

  test('should open cloned file', async ({ page }) => {
    // Clone repo first
    await page.click('#openCloneModalBtn');
    await page.fill('#repoUrl', 'https://fixture.test/sample/repo.git');
    await page.click('#cloneRepoSubmit');
    await expect(page.locator('#fileTree')).toContainText('index.html');
    
    // Click on a file in the tree
    const fileItem = page.locator('.file-tree-item.file').first();
    await fileItem.click();
    await page.waitForTimeout(1000);
    
    // Check editor shows content
    await expect(page.locator('#editorWrapper')).toBeVisible();
    
    // Get editor content
    const content = await getEditorContent(page);
    
    expect(content.length).toBeGreaterThan(0);
  });

  test('should durably save a cloned file through the clone API', async ({ page }) => {
    await page.click('#openCloneModalBtn');
    await page.fill('#repoUrl', 'https://fixture.test/sample/repo.git');
    await page.click('#cloneRepoSubmit');
    await expect(page.locator('#fileTree')).toContainText('index.html');
    await page.getByText('index.html', { exact: true }).click();
    await setEditorContent(page, '<h1>Persisted clone edit</h1>');
    const saveRequest = page.waitForRequest(request => request.method() === 'PUT' && /\/api\/clone\/[^/]+\/file$/.test(request.url()));
    await page.click('#saveFileBtn');
    await saveRequest;
    await expect(page.locator('#fileStatus')).toHaveText('Saved');
  });

  test('should durably bulk-delete selected clone files', async ({ page }) => {
    await page.click('#openCloneModalBtn');
    await page.fill('#repoUrl', 'https://fixture.test/sample/repo.git');
    await page.click('#cloneRepoSubmit');
    await expect(page.locator('#fileTree')).toContainText('index.html');
    await page.locator('.file-checkbox[data-path="index.html"]').check();
    page.once('dialog', dialog => dialog.accept());
    const deleteRequest = page.waitForRequest(request => request.method() === 'DELETE' && /\/api\/clone\/[^/]+\/file\?/.test(request.url()));
    await page.click('#bulkDeleteBtn');
    await deleteRequest;
    await expect(page.locator('#fileTree')).not.toContainText('index.html');
  });

  test('should render attacker-controlled file names as text and keep tokens out of localStorage', async ({ page }) => {
    await page.click('#newFileBtn');
    await page.fill('#newFileName', '<img src=x onerror=window.__xss=1>.txt');
    await page.click('#createFileSubmit');
    await expect(page.locator('#fileTree')).toContainText('<img src=x onerror=window.__xss=1>.txt');
    expect(await page.locator('#fileTree img').count()).toBe(0);
    expect(await page.evaluate(() => ({
      xss: window.__xss || 0,
      githubToken: localStorage.getItem('githubToken'),
      copilotToken: localStorage.getItem('copilotToken')
    }))).toEqual({ xss: 0, githubToken: null, copilotToken: null });
    await expect(page.locator('#previewFrame')).toHaveAttribute('sandbox', 'allow-scripts');
  });

  test('should toggle preview', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    // Create HTML file
    await page.click('#newFileBtn');
    await page.fill('#newFileName', 'preview-test.html');
    await page.selectOption('#fileTemplate', 'html');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(500);
    
    // Toggle preview
    await page.click('#previewBtn');
    await page.waitForTimeout(500);
    
    // Check preview is visible
    await expect(page.locator('#preview')).toBeVisible();
    await expect(page.locator('#previewFrame')).toBeVisible();
    await expect(page.locator('.editor-stack')).toHaveClass(/preview-open/);
    const box = await page.locator('#previewFrame').boundingBox();
    const viewport = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    const preview = page.frameLocator('#previewFrame');
    await expect(preview.locator('.hero')).toHaveCSS('background-image', /linear-gradient/);
    expect(consoleErrors).toEqual([]);
  });

  test('should compose workspace HTML, CSS, and JS and preserve the document through visual mode', async ({ page }) => {
    await createFileWithContent(page, 'styles.css', 'h1 { color: rgb(1, 2, 3); }');
    await createFileWithContent(page, 'script.js', "document.body.dataset.scriptRan = 'yes';");
    const html = '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="styles.css"></head><body><h1>Composed site</h1><script src="script.js"></script></body></html>';
    await createFileWithContent(page, 'index.html', html);

    await page.click('#guiModeBtn');
    await expect(page.locator('#guiCanvas h1')).toHaveText('Composed site');
    await page.click('#applyGuiChanges');
    const roundTripped = await getEditorContent(page);
    expect(roundTripped).toContain('<!doctype html>');
    expect(roundTripped).toContain('href="styles.css"');
    expect(roundTripped).toContain('src="script.js"');

    await page.click('#previewBtn');
    const preview = page.frameLocator('#previewFrame');
    await expect(preview.locator('h1')).toHaveText('Composed site');
    await expect.poll(() => preview.locator('body').getAttribute('data-script-ran')).toBe('yes');
    expect(await preview.locator('h1').evaluate(element => getComputedStyle(element).color)).toBe('rgb(1, 2, 3)');
  });

  test('should create folder', async ({ page }) => {
    // Click new folder button
    await page.click('#newFolderBtn');
    
    // Wait for modal
    await expect(page.locator('#newFolderModal')).toHaveClass(/active/);
    
    // Fill form
    await page.fill('#newFolderName', 'test-folder');
    
    // Create folder
    await page.click('#createFolderSubmit');
    await page.waitForTimeout(500);
    
    // Check file tree contains folder
    await expect(page.locator('#fileTree')).toContainText('test-folder');
  });

  test('should search files', async ({ page }) => {
    // Create some files first
    await page.click('#newFileBtn');
    await page.fill('#newFileName', 'search-test.html');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(500);
    
    // Use search
    await page.fill('#fileSearchInput', 'search');
    await page.waitForTimeout(500);
    
    // Check filtered results
    const fileTree = page.locator('#fileTree');
    await expect(fileTree).toContainText('search-test.html');
  });

  test('should switch between tabs', async ({ page }) => {
    // Create first file
    await page.click('#newFileBtn');
    await page.fill('#newFileName', 'tab1.html');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(500);
    
    // Create second file
    await page.click('#newFileBtn');
    await page.fill('#newFileName', 'tab2.js');
    await page.selectOption('#fileTemplate', 'js');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(500);
    
    // Check both tabs exist
    const tabs = page.locator('.editor-tab');
    await expect(tabs).toHaveCount(2);
    
    // Click first tab
    await tabs.first().click();
    await page.waitForTimeout(500);
    
    // Check current file changed
    await expect(page.locator('#currentFileName')).toContainText('tab1.html');
  });

  test('should delete file', async ({ page }) => {
    // Create file
    await page.click('#newFileBtn');
    await page.fill('#newFileName', 'delete-me.txt');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(500);
    
    // Handle confirmation dialog
    page.on('dialog', dialog => dialog.accept());
    
    // Delete file
    await page.click('#deleteFileBtn');
    await page.waitForTimeout(500);
    
    // Check file is gone
    const fileTree = page.locator('#fileTree');
    await expect(fileTree).not.toContainText('delete-me.txt');
  });
});

test.describe('Sports Website Demo Test', () => {
  test('should build complete sports website', async ({ page }) => {
    test.setTimeout(60000); // Increase timeout for this test
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Create index.html
    await page.click('#newFileBtn');
    await page.fill('#newFileName', 'index.html');
    await page.selectOption('#fileTemplate', 'blank');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(500);
    
    // Add HTML content
    const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Sports Central</title><link rel="stylesheet" href="styles.css"></head>
<body><h1>Welcome to Sports Central</h1><p>Your sports hub</p></body>
</html>`;
    
    await setEditorContent(page, htmlContent);
    
    await page.click('#saveFileBtn');
    await page.waitForTimeout(1000);
    
    // Create styles.css
    await page.click('#newFileBtn');
    await page.fill('#newFileName', 'styles.css');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(500);
    
    await setEditorContent(page, 'body { font-family: Arial; margin: 0; padding: 20px; }');
    
    await page.click('#saveFileBtn');
    await page.waitForTimeout(1000);
    
    // Verify files created
    await expect(page.locator('#fileTree')).toContainText('index.html');
    await expect(page.locator('#fileTree')).toContainText('styles.css');
  });
});
