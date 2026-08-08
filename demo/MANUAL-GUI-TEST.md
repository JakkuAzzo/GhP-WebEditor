# Manual GUI Editing Test for GhP-WebEditor

## Test Scenario: Clone, Edit, and Preview GuyRofe.git

Follow these steps to manually test the GUI editing features:

### 🎯 Test Objectives
1. Clone a real repository (GuyRofe.git)
2. Use point-and-click UI to navigate files
3. Edit content using the editor
4. Preview changes live
5. Test drag-and-drop (if available)

### 📋 Test Steps

#### 1. Start the Server
```bash
npm start
```

Open http://localhost:3000 in your browser

#### 2. Clone the Repository
1. Click the **"Clone from URL"** button in the toolbar
2. Enter URL: `https://github.com/JakkuAzzo/GuyRofe.git`
3. **Uncheck** "Shallow clone" for full history
4. Click **"Clone Repository"**
5. Wait 10-15 seconds for cloning to complete
6. Click "OK" on the success alert

#### 3. Browse Files (Point-and-Click Navigation)
1. Look at the **file tree** on the left sidebar
2. Click on folders to expand them
3. Click on `index.html` (or any `.html` file) to open it
4. Verify the file content appears in the editor

#### 4. Edit Using the Editor
1. Make changes to the HTML content
2. Try these edits:
   - Change a heading text
   - Modify a color in a style attribute
   - Add a new paragraph
3. Click the **💾 Save** button
4. Verify "Saved" status appears

#### 5. Test Preview Feature
1. Click the **👁️ Preview** button in the toolbar
2. The preview pane should open on the right
3. Your changes should be visible in the preview
4. Toggle preview on/off to verify it works

#### 6. Test Tab Management
1. Open multiple files by clicking them in the file tree
2. Verify tabs appear at the top of the editor
3. Click between tabs to switch files
4. Close a tab using the ×  button

#### 7. Test File Search
1. Type in the **search box** above the file tree
2. Verify file list filters based on search
3. Clear search to see all files again

#### 8. GUI Mode (If Available)
1. Look for a **"GUI Mode"** or **"Visual Editor"** button
2. If found, click it to switch modes
3. Try to:
   - Click on elements to select them
   - Double-click to edit text inline
   - Drag elements to reorder (if supported)
4. Switch back to code mode

#### 9. Export Project
1. Click the **Download** button
2. Save the generated `github-pages-site.zip`
3. Extract the archive
4. Verify it contains all your files and changes

### ✅ Expected Results

| Test | Expected Behavior | Status |
|------|------------------|--------|
| Clone | Repository clones successfully, files appear in tree | ⬜ |
| File Navigation | Clicking files opens them in editor | ⬜ |
| Editing | Changes can be made and saved | ⬜ |
| Preview | HTML renders in preview pane | ⬜ |
| Tabs | Multiple files can be open simultaneously | ⬜ |
| Search | File tree filters based on search query | ⬜ |
| GUI Mode | Visual editing mode available (if implemented) | ⬜ |
| Export | Project can be downloaded as a ZIP | ⬜ |

### 🐛 Known Issues to Check

1. **Empty Files**: If files appear empty after cloning, this indicates the `fetchFileContent` function needs the cloneId parameter
2. **No Files**: If no files appear, check browser console for API errors
3. **Preview Not Working**: Verify the preview frame has correct src attribute
4. **GUI Mode Missing**: This feature may need to be implemented

### 📸 Screenshot Checklist

Take screenshots of:
1. ✅ Initial app load
2. ✅ Clone modal with URL entered
3. ✅ File tree after successful clone
4. ✅ HTML file open in editor
5. ✅ Preview pane showing rendered HTML
6. ✅ Multiple tabs open
7. ✅ Export modal/downloaded file

### 🔧 Troubleshooting

**Problem**: No files appear after cloning
- **Solution**: Check browser console for errors, verify server is running

**Problem**: Files appear empty
- **Solution**: This is a known bug, check if `cloneId` is being passed to `fetchFileContent`

**Problem**: Preview shows blank
- **Solution**: Check if HTML has proper DOCTYPE and structure

**Problem**: Can't save changes
- **Solution**: Verify file permissions, check if it's a cloned repo (may be read-only)

### 📊 Test Report Template

```
Date: ___________
Tester: ___________
Browser: ___________
OS: ___________

Results:
- Clone: ✅ / ❌
- Navigation: ✅ / ❌
- Editing: ✅ / ❌
- Preview: ✅ / ❌
- Tabs: ✅ / ❌
- Search: ✅ / ❌
- GUI Mode: ✅ / ❌ / N/A
- Export: ✅ / ❌

Notes:
___________________________________________
___________________________________________
```

### 🚀 Next Steps

If all tests pass:
- ✅ The app is working correctly for basic editing
- Consider implementing advanced GUI features:
  - Contenteditable inline editing
  - Drag-and-drop file organization
  - Visual property editors (color pickers, font selectors)
  - WYSIWYG HTML editing

If tests fail:
- Document the failures
- Check browser console for errors
- Review server logs
- Run automated tests: `cd demo && npm test`
