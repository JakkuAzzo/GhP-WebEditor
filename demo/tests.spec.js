import { test, expect } from '@playwright/test';

test.describe('GhP WebEditor Tests', () => {
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
  });

  test('should save file content', async ({ page }) => {
    // Create file
    await page.click('#newFileBtn');
    await page.fill('#newFileName', 'test.txt');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(500);
    
    // Add content
    await page.evaluate(() => {
      window.AppState.editor.setValue('Hello World');
    });
    
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
    await page.fill('#repoUrl', 'https://github.com/octocat/Hello-World.git');
    
    // Clone
    await page.click('#cloneRepoSubmit');
    
    // Wait for clone to complete (may take a few seconds)
    await page.waitForTimeout(5000);
    
    // Check if files appear
    const fileTree = page.locator('#fileTree');
    await expect(fileTree).not.toContainText('No files yet');
  });

  test('should open cloned file', async ({ page }) => {
    // Clone repo first
    await page.click('#openCloneModalBtn');
    await page.fill('#repoUrl', 'https://github.com/octocat/Hello-World.git');
    await page.click('#cloneRepoSubmit');
    await page.waitForTimeout(5000);
    
    // Click on a file in the tree
    const fileItem = page.locator('.file-tree-item.file').first();
    await fileItem.click();
    await page.waitForTimeout(1000);
    
    // Check editor shows content
    await expect(page.locator('#editorWrapper')).toBeVisible();
    
    // Get editor content
    const content = await page.evaluate(() => {
      return window.AppState.editor.getValue();
    });
    
    expect(content.length).toBeGreaterThan(0);
  });

  test('should toggle preview', async ({ page }) => {
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
    
    await page.evaluate((html) => {
      window.AppState.editor.setValue(html);
    }, htmlContent);
    
    await page.click('#saveFileBtn');
    await page.waitForTimeout(1000);
    
    // Create styles.css
    await page.click('#newFileBtn');
    await page.fill('#newFileName', 'styles.css');
    await page.click('#createFileSubmit');
    await page.waitForTimeout(500);
    
    await page.evaluate(() => {
      window.AppState.editor.setValue('body { font-family: Arial; margin: 0; padding: 20px; }');
    });
    
    await page.click('#saveFileBtn');
    await page.waitForTimeout(1000);
    
    // Verify files created
    await expect(page.locator('#fileTree')).toContainText('index.html');
    await expect(page.locator('#fileTree')).toContainText('styles.css');
  });
});
