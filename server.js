const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const helmet = require('helmet');
const simpleGit = require('simple-git');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic security headers
app.use(helmet());

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory registry of cloned repos
const CLONES_DIR = path.join(os.tmpdir(), 'ghp-webeditor-clones');
if (!fs.existsSync(CLONES_DIR)) fs.mkdirSync(CLONES_DIR, { recursive: true });
const cloneRegistry = new Map(); // id -> { dir, url, createdAt }

function isValidGitUrl(url) {
  try {
    // Allow https://, git+https://, and git@ (ssh) minimal validation
    if (/^git@[^:]+:.+/.test(url)) return true;
    const u = new URL(url.replace(/^git\+/, ''));
    return ['https:', 'http:'].includes(u.protocol) && !!u.hostname && /\/.+/.test(u.pathname);
  } catch (e) {
    return false;
  }
}

function listFilesRecursive(baseDir) {
  const results = [];
  function walk(current, rel = '') {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      const relPath = path.join(rel, entry.name);
      // Skip VCS/internal folders
      if (entry.name === '.git') continue;
      if (entry.isDirectory()) {
        results.push({ path: relPath, type: 'dir' });
        walk(full, relPath);
      } else if (entry.isFile()) {
        results.push({ path: relPath, type: 'file', size: fs.statSync(full).size });
      }
    }
  }
  walk(baseDir);
  return results;
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST /api/clone { url: string, shallow?: boolean, branch?: string }
app.post('/api/clone', async (req, res) => {
  try {
    const { url, shallow = true, branch } = req.body || {};
    if (!url || !isValidGitUrl(url)) {
      return res.status(400).json({ error: 'Invalid or missing repo URL' });
    }
    const id = crypto.randomUUID();
    const dir = path.join(CLONES_DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    const git = simpleGit({ baseDir: dir });
    const cloneOptions = [];
    if (shallow) cloneOptions.push('--depth', '1');
    if (branch) cloneOptions.push('--branch', branch);

    // Clone INTO the created directory (".") to avoid nesting
    await git.clone(url, '.', cloneOptions);

    cloneRegistry.set(id, { id, dir, url, branch: branch || null, createdAt: Date.now() });
    return res.json({ id, url, branch: branch || null, status: 'cloned' });
  } catch (error) {
    console.error('Clone failed:', error);
    return res.status(500).json({ error: 'Clone failed', detail: String(error.message || error) });
  }
});

// GET /api/clone/:id/tree
app.get('/api/clone/:id/tree', (req, res) => {
  const { id } = req.params;
  const entry = cloneRegistry.get(id);
  if (!entry) return res.status(404).json({ error: 'Clone not found' });
  try {
    const files = listFilesRecursive(entry.dir);
    return res.json({ id, files });
  } catch (error) {
    console.error('List tree failed:', error);
    return res.status(500).json({ error: 'Failed to list tree' });
  }
});

// GET /api/clone/:id/file?path=...
app.get('/api/clone/:id/file', (req, res) => {
  const { id } = req.params;
  const relPath = req.query.path;
  const entry = cloneRegistry.get(id);
  if (!entry) return res.status(404).json({ error: 'Clone not found' });
  if (!relPath || relPath.includes('..')) return res.status(400).json({ error: 'Invalid path' });
  const full = path.join(entry.dir, relPath);
  // Block access to VCS internals
  if (relPath === '.git' || relPath.startsWith('.git/')) return res.status(403).json({ error: 'Forbidden' });
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
  const stat = fs.statSync(full);
  if (stat.isDirectory()) return res.status(400).json({ error: 'Path is a directory' });
  const maxSize = 2 * 1024 * 1024; // 2MB limit for inline content
  if (stat.size > maxSize) {
    return res.json({ path: relPath, encoding: 'base64', size: stat.size, content: null, tooLarge: true });
  }
  const buf = fs.readFileSync(full);
  // naive text detection: try utf8 decode
  let content = buf.toString('utf8');
  return res.json({ path: relPath, content, encoding: 'utf8', size: stat.size });
});

app.listen(PORT, () => {
  console.log(`GitHub Pages Web Editor running at http://localhost:${PORT}`);
  console.log('Open your browser to start editing!');
});
