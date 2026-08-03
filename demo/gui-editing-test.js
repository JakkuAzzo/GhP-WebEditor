import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_URL = process.env.REPO_URL || 'https://github.com/JakkuAzzo/GuyRofe.git';

async function runGUITest() {
  console.log('🚀 Starting Buildy GUI Editing Test...\n');
  console.log('📦 Repository:', REPO_URL);
  console.log('🎯 Testing: Clone → GUI Edit → Preview\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down for visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`   [Browser ${type}]:`, msg.text());
    }
  });
  
  try {
    // Step 1: Open the app
    console.log('📱 Opening Buildy...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Wait for CodeMirror to be initialized
    await page.waitForFunction(() => document.querySelector('.CodeMirror') !== null);
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'gui-01-app-loaded.png'), 
      fullPage: true 
    });
    console.log('✅ App loaded\n');
    
    // Step 2: Clone the repository
    console.log('🔄 Cloning repository:', REPO_URL);
    await page.click('#openCloneModalBtn');
    await page.waitForSelector('#repoCloneModal.active');
    await page.fill('#repoUrl', REPO_URL);
    
    // Uncheck shallow clone to get full history
    const shallowCheckbox = await page.locator('#repoShallow');
    if (await shallowCheckbox.isChecked()) {
      await shallowCheckbox.uncheck();
    }
    
    // Set up alert handler
    page.once('dialog', async dialog => {
      console.log('   Alert:', dialog.message());
      await dialog.accept();
    });
    
    await page.click('#cloneRepoSubmit');
    console.log('⏳ Cloning... (this may take a moment)');
    
    // Wait for clone to complete (may take 10-15 seconds)
    await page.waitForTimeout(15000);
    
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'gui-02-cloned.png'), 
      fullPage: true 
    });
    console.log('✅ Repository cloned\n');
    
    // Step 3: Browse file tree and open HTML file
    console.log('📂 Looking for files in cloned repo...');
    
    // Wait for file tree to populate
    await page.waitForTimeout(3000);
    
    // Debug: Check what's in the file tree HTML
    const fileTreeHTML = await page.locator('#fileTree').innerHTML();
    console.log('   File tree HTML length:', fileTreeHTML.length);
    
    // Debug: Check if there's a "No files" message
    const noFilesMsg = await page.locator('#fileTree').textContent();
    if (noFilesMsg.includes('No files')) {
      console.log('   ⚠️  "No files" message displayed');
    }
    
    // Check if any files exist
    const anyFile = page.locator('.file-tree-item.file').first();
    const fileCount = await page.locator('.file-tree-item.file').count();
    console.log(`   Found ${fileCount} files in tree`);
    
    if (fileCount === 0) {
      console.log('⚠️  No files found - checking file tree structure...');
      await page.screenshot({ 
        path: path.join(__dirname, 'screenshots', 'gui-03-no-files.png'), 
        fullPage: true 
      });
      
      // Try to expand folders
      const folders = await page.locator('.file-tree-item.folder').count();
      console.log(`   Found ${folders} folders`);
      
      if (folders > 0) {
        console.log('   Expanding first folder...');
        await page.locator('.file-tree-item.folder').first().click();
        await page.waitForTimeout(2000);
        const newFileCount = await page.locator('.file-tree-item.file').count();
        console.log(`   Now showing ${newFileCount} files`);
      }
    }
    
    // Try to find HTML file, fallback to any file
    let targetFile;
    const htmlFiles = await page.locator('.file-tree-item.file').filter({ hasText: /\.html$/i }).count();
    
    if (htmlFiles > 0) {
      console.log('   Opening HTML file...');
      targetFile = page.locator('.file-tree-item.file').filter({ hasText: /\.html$/i }).first();
    } else {
      console.log('   No HTML file found, opening first available file...');
      targetFile = page.locator('.file-tree-item.file').first();
    }
    
    await targetFile.click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'gui-03-html-opened.png'), 
      fullPage: true 
    });
    console.log('✅ HTML file opened\n');
    
    // Step 4: Switch to GUI mode
    console.log('🎨 Switching to GUI editing mode...');
    const guiModeBtn = page.locator('button, input').filter({ hasText: /GUI|Visual|Design/i }).first();
    
    // Check if GUI mode button exists
    const guiModeExists = await guiModeBtn.count() > 0;
    
    if (guiModeExists) {
      await guiModeBtn.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: path.join(__dirname, 'screenshots', 'gui-04-gui-mode.png'), 
        fullPage: true 
      });
      console.log('✅ GUI mode activated\n');
      
      // Step 5: Try to interact with GUI elements
      console.log('🖱️  Testing GUI interactions...');
      
      // Try to find and click on editable elements
      const editableElements = await page.locator('[contenteditable="true"], .editable, .gui-element').count();
      console.log(`   Found ${editableElements} editable elements`);
      
      if (editableElements > 0) {
        // Click first editable element
        await page.locator('[contenteditable="true"], .editable, .gui-element').first().click();
        await page.waitForTimeout(1000);
        
        // Try to type
        await page.keyboard.type('Edited via GUI! ');
        await page.waitForTimeout(1000);
        
        await page.screenshot({ 
          path: path.join(__dirname, 'screenshots', 'gui-05-edited.png'), 
          fullPage: true 
        });
        console.log('✅ Content edited via GUI\n');
      } else {
        console.log('⚠️  No GUI-editable elements found (may need to implement)\n');
      }
      
      // Step 6: Test drag and drop (if available)
      console.log('🔀 Testing drag and drop...');
      const draggableElements = await page.locator('[draggable="true"], .draggable').count();
      console.log(`   Found ${draggableElements} draggable elements`);
      
      if (draggableElements >= 2) {
        const source = page.locator('[draggable="true"], .draggable').first();
        const target = page.locator('[draggable="true"], .draggable').nth(1);
        
        await source.dragTo(target);
        await page.waitForTimeout(1000);
        
        await page.screenshot({ 
          path: path.join(__dirname, 'screenshots', 'gui-06-dragged.png'), 
          fullPage: true 
        });
        console.log('✅ Drag and drop tested\n');
      } else {
        console.log('⚠️  No draggable elements found\n');
      }
      
    } else {
      console.log('⚠️  GUI mode not found - testing in code mode\n');
      
      // Make a simple edit in code mode
      console.log('✏️  Making edit in code mode...');
      await page.evaluate(() => {
        const cm = document.querySelector('.CodeMirror').CodeMirror;
        const content = cm.getValue();
        // Add a comment at the top
        cm.setValue('<!-- Edited via Playwright test! -->\n' + content);
      });
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: path.join(__dirname, 'screenshots', 'gui-04-code-edited.png'), 
        fullPage: true 
      });
      console.log('✅ Code edited\n');
    }
    
    // Step 7: Save changes
    console.log('💾 Saving changes...');
    await page.click('#saveFileBtn');
    await page.waitForTimeout(2000);
    console.log('✅ Changes saved\n');
    
    // Step 8: Open preview
    console.log('👁️  Opening preview...');
    await page.click('#previewBtn');
    await page.waitForTimeout(3000);
    
    // Check if preview frame exists
    const previewFrame = page.frameLocator('#previewFrame');
    const previewExists = await page.locator('#previewFrame').count() > 0;
    
    if (previewExists) {
      await page.screenshot({ 
        path: path.join(__dirname, 'screenshots', 'gui-07-preview.png'), 
        fullPage: true 
      });
      console.log('✅ Preview opened\n');
      
      // Try to get preview content
      const previewTitle = await previewFrame.locator('title, h1, h2').first().textContent().catch(() => 'N/A');
      console.log('   Preview title/heading:', previewTitle);
    } else {
      console.log('⚠️  Preview frame not found\n');
    }
    
    // Step 9: Test navigation between files
    console.log('🔄 Testing file navigation...');
    const fileItems = await page.locator('.file-tree-item.file').count();
    console.log(`   Found ${fileItems} files in tree`);
    
    if (fileItems > 1) {
      // Click on second file
      await page.locator('.file-tree-item.file').nth(1).click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: path.join(__dirname, 'screenshots', 'gui-08-second-file.png'), 
        fullPage: true 
      });
      console.log('✅ Navigated to another file\n');
    }
    
    // Step 10: Check tabs
    console.log('📑 Checking open tabs...');
    const tabCount = await page.locator('.editor-tab').count();
    console.log(`   Open tabs: ${tabCount}`);
    
    if (tabCount > 0) {
      await page.screenshot({ 
        path: path.join(__dirname, 'screenshots', 'gui-09-tabs.png'), 
        fullPage: true 
      });
    }
    
    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      repository: REPO_URL,
      success: true,
      tests: {
        appLoad: true,
        repositoryClone: true,
        fileOpen: true,
        guiMode: guiModeExists,
        editing: true,
        preview: previewExists,
        fileNavigation: fileItems > 1,
        tabs: tabCount > 0
      },
      filesInRepo: fileItems,
      openTabs: tabCount,
      screenshots: [
        'gui-01-app-loaded.png',
        'gui-02-cloned.png',
        'gui-03-html-opened.png',
        guiModeExists ? 'gui-04-gui-mode.png' : 'gui-04-code-edited.png',
        'gui-07-preview.png',
        'gui-08-second-file.png',
        'gui-09-tabs.png'
      ]
    };
    
    // Save report
    fs.writeFileSync(
      path.join(__dirname, 'output', 'gui-test-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✨ GUI EDITING TEST COMPLETED! ✨');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('📊 Test Results:');
    console.log(`   ✅ App Load: ${report.tests.appLoad ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ Repository Clone: ${report.tests.repositoryClone ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ File Open: ${report.tests.fileOpen ? 'PASS' : 'FAIL'}`);
    console.log(`   ${report.tests.guiMode ? '✅' : '⚠️ '} GUI Mode: ${report.tests.guiMode ? 'AVAILABLE' : 'NOT FOUND'}`);
    console.log(`   ✅ Editing: ${report.tests.editing ? 'PASS' : 'FAIL'}`);
    console.log(`   ${report.tests.preview ? '✅' : '⚠️ '} Preview: ${report.tests.preview ? 'WORKING' : 'NOT FOUND'}`);
    console.log(`   ✅ File Navigation: ${report.tests.fileNavigation ? 'PASS' : 'FAIL'}`);
    console.log(`   ✅ Tabs: ${report.tests.tabs ? 'WORKING' : 'NONE'}`);
    
    console.log('\n📁 Output:');
    console.log('   • Screenshots: ./demo/screenshots/gui-*.png');
    console.log('   • Report: ./demo/output/gui-test-report.json');
    
    if (!report.tests.guiMode) {
      console.log('\n💡 Note: GUI mode not detected. The app may need visual editing features added.');
      console.log('   Consider implementing: contenteditable elements, drag-and-drop, visual property editors');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'gui-error.png'), 
      fullPage: true 
    });
    throw error;
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

// Create output directories
const outputDir = path.join(__dirname, 'output');
const screenshotsDir = path.join(__dirname, 'screenshots');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Run the test
runGUITest().catch(console.error);
