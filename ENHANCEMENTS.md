# Future Enhancements

## Git & Repository Management

### 1. Branch Switching for Clones
**Value:** Navigate between branches in cloned repos without re-cloning.

**Implementation:**
- Add branch selector dropdown in UI when working with clone
- Backend endpoint: `POST /api/clone/:id/checkout { branch }`
- Use `simple-git` to fetch and checkout branches
- Reload file tree after branch switch

**Complexity:** Medium

### 2. Commit & Push from Clones
**Value:** Make changes and commit directly from editor.

**Implementation:**
- Add commit form (message, author) in UI
- Backend endpoints:
  - `POST /api/clone/:id/commit { message, files }`
  - `POST /api/clone/:id/push { remote?, branch? }`
- Require auth for push (GitHub token or SSH keys)
- Show commit status and errors

**Complexity:** High (requires auth management)

### 3. Git Status & Diff for Clones
**Value:** See what's changed before committing.

**Implementation:**
- Backend: `GET /api/clone/:id/status` returns modified/added/deleted files
- UI: badge showing uncommitted changes count
- Enhance diff viewer to compare working tree vs last commit

**Complexity:** Medium

### 4. Clone History & Management
**Value:** Reopen previous clones, clean up old ones.

**Implementation:**
- Persist clone registry to disk (JSON file)
- UI: dropdown of recent clones with "Delete" option
- Backend cleanup job to remove clones older than X days

**Complexity:** Low-Medium

## Code Quality & Developer Experience

### 5. ESLint + Prettier Setup
**Value:** Consistent code style, catch errors early.

**Implementation:**
```bash
npm install --save-dev eslint prettier eslint-config-prettier
```
- Add `.eslintrc.json` and `.prettierrc`
- Add npm scripts: `"lint": "eslint ."`, `"format": "prettier --write ."`
- Optional: pre-commit hook with husky

**Complexity:** Low

### 6. Modularize Frontend Code
**Value:** Easier maintenance, better testability.

**Implementation:**
- Split `app.js` into modules:
  - `state.js` - AppState management
  - `github-api.js` - GitHub integration
  - `clone-api.js` - Clone endpoints
  - `editor.js` - CodeMirror setup
  - `ui.js` - DOM manipulation
  - `plugins.js` - Plugin system
- Use ES6 modules or bundler (Vite/Rollup)

**Complexity:** Medium-High

### 7. Add Basic Tests
**Value:** Confidence in changes, prevent regressions.

**Implementation:**
```bash
npm install --save-dev jest supertest
```
- Test backend API endpoints (clone, tree, file)
- Test utility functions (diff, file tree builder)
- Add `"test": "jest"` script
- Optional: GitHub Actions CI

**Complexity:** Medium

## Security Improvements

### 8. Token Proxy Backend
**Value:** Don't store tokens in browser localStorage.

**Implementation:**
- Store GitHub token server-side (encrypted at rest)
- Backend proxies GitHub API calls
- Frontend sends session ID instead of token
- Use HTTP-only cookies for session

**Complexity:** High

### 9. Plugin Sandboxing
**Value:** Safer plugin execution, prevent malicious code.

**Implementation:**
- Replace `eval()` with Web Worker for plugins
- Plugins run in isolated context
- Message passing API between main thread and worker
- Whitelist allowed APIs

**Complexity:** High

### 10. Content Security Policy (CSP)
**Value:** Prevent XSS attacks.

**Implementation:**
- Add CSP headers via Helmet:
```js
helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"]
  }
})
```
- Remove inline scripts from `index.html`
- Move inline event handlers to `app.js`

**Complexity:** Medium

## Performance Optimizations

### 11. File Content Caching
**Value:** Faster file reopening, reduced backend calls.

**Implementation:**
- Backend: cache file content in memory (LRU cache)
- Add `Last-Modified` headers and 304 responses
- Frontend: IndexedDB for persistent cache
- Invalidate on file save/commit

**Complexity:** Medium

### 12. Lazy Load Large File Trees
**Value:** Handle repos with thousands of files.

**Implementation:**
- Backend: paginated tree endpoint `?offset=0&limit=100`
- UI: virtual scrolling for file tree (e.g., react-window)
- Load folders on-demand when expanded

**Complexity:** High

### 13. Debounce & Throttle User Actions
**Value:** Reduce unnecessary API calls and renders.

**Implementation:**
- Debounce file search input (300ms)
- Throttle collaboration broadcast (500ms)
- Debounce content search (500ms)
- Use lodash.debounce or native implementation

**Complexity:** Low

## UI/UX Enhancements

### 14. File Upload & Image Handling
**Value:** Add assets to projects without CLI.

**Implementation:**
- Drag-and-drop files into file tree
- Backend: `POST /api/clone/:id/upload` with multipart form
- Show image previews in editor for `.png`, `.jpg`, etc.
- Automatically commit uploaded files

**Complexity:** Medium

### 15. Keyboard Shortcuts Panel
**Value:** Improve discoverability of existing shortcuts.

**Implementation:**
- Modal showing all shortcuts (Cmd+K or ?)
- Categorize by context (editor, file tree, search)
- Allow customization (save to localStorage)

**Complexity:** Low

### 16. Dark/Light Mode Auto-detect
**Value:** Respect system preferences.

**Implementation:**
```js
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  AppState.uiTheme = 'dark';
}
```
- Listen for theme changes
- Add "Auto" option in theme selector

**Complexity:** Low

### 17. Mobile-Responsive Layout
**Value:** Use on tablets and large phones.

**Implementation:**
- Breakpoints for small screens (<768px)
- Collapsible sidebar with hamburger menu
- Touch-friendly buttons and hit areas
- Hide Copilot panel on mobile by default

**Complexity:** Medium

## Collaboration Features

### 18. User Presence Avatars
**Value:** See who's editing which file.

**Implementation:**
- Show avatar/initials in tab for files others have open
- Cursor positions (WebRTC + operational transforms)
- Lock files when someone is editing (optional)

**Complexity:** High

### 19. Real-time Cursor Sync
**Value:** Pair programming experience.

**Implementation:**
- Send cursor position on change
- Render remote cursors in CodeMirror with colors
- Use WebRTC data channel for low latency
- Show user name label next to cursor

**Complexity:** Very High

### 20. Session Persistence
**Value:** Resume collaboration after refresh.

**Implementation:**
- Store session ID in URL and localStorage
- Backend tracks active sessions (Redis/memory)
- Rejoin on page load if session still active
- Expire sessions after 24 hours

**Complexity:** Medium

## Monitoring & Observability

### 21. Error Tracking
**Value:** Know when things break in production.

**Implementation:**
- Integrate Sentry or similar
- Capture frontend errors with stack traces
- Backend error middleware logs to service
- User context (but not tokens!)

**Complexity:** Low

### 22. Analytics & Usage Metrics
**Value:** Understand how users interact with features.

**Implementation:**
- Track feature usage (clone count, file opens, etc.)
- Use privacy-friendly analytics (Plausible, Fathom)
- No personal data—just counts and paths
- Dashboard for insights

**Complexity:** Low-Medium

---

## Priority Recommendations

**Quick Wins (do first):**
1. ESLint + Prettier
2. Basic tests for backend API
3. Debounce user actions
4. Dark mode auto-detect
5. Keyboard shortcuts panel

**High Impact (do soon):**
1. Branch switching for clones
2. Git status & diff for clones
3. File upload & image handling
4. Modularize frontend code
5. Clone history & management

**Security (important):**
1. Content Security Policy
2. Plugin sandboxing
3. Token proxy backend (if handling sensitive data)

**Advanced (nice to have):**
1. Commit & push from clones
2. Real-time cursor sync
3. Lazy load large file trees
4. Mobile-responsive layout
5. Error tracking & analytics
