const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const helmet = require('helmet');
const simpleGit = require('simple-git');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== 'false';
const SESSION_SECRET = process.env.GHP_SESSION_SECRET;
const CLONE_TTL_MS = 60 * 60 * 1000;
const CLONES_DIR = path.join(os.tmpdir(), 'ghp-webeditor-clones');
const cloneRegistry = new Map();

function configuredUsers() {
  try {
    const users = JSON.parse(process.env.GHP_USERS || '[]');
    return Array.isArray(users) ? users.filter(user => user && user.email && user.passwordHash) : [];
  } catch {
    return [];
  }
}

const USERS = configuredUsers();
if (!fs.existsSync(CLONES_DIR)) fs.mkdirSync(CLONES_DIR, { recursive: true });
if (AUTH_REQUIRED && !SESSION_SECRET) console.error('GHP_SESSION_SECRET is required while authentication is enabled.');

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(session({
  name: 'ghp.sid',
  secret: SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));

function isValidGitUrl(url) {
  try {
    if (/^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(url)) return true;
    const parsed = new URL(url.replace(/^git\+/, ''));
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com' &&
      /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/.test(parsed.pathname) &&
      !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

function listFilesRecursive(baseDir) {
  const results = [];
  function walk(current, rel = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const relPath = path.join(rel, entry.name);
      if (entry.name === '.git' || entry.isSymbolicLink()) continue;
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

function sendLoginPage(res) {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', access: AUTH_REQUIRED ? (USERS.length ? 'configured' : 'not-configured') : 'open' });
});

app.get('/login', (req, res) => {
  if (!AUTH_REQUIRED || req.session.user) return res.redirect('/');
  return sendLoginPage(res);
});

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false });
app.post('/login', loginLimiter, async (req, res) => {
  if (!AUTH_REQUIRED) return res.status(404).end();
  if (!SESSION_SECRET || !USERS.length) return res.status(503).json({ error: 'Private beta access is not configured yet.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = USERS.find(candidate => candidate.email.toLowerCase() === email);
  const valid = user && await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Email or password is incorrect.' });
  req.session.regenerate(error => {
    if (error) return res.status(500).json({ error: 'Could not start a session.' });
    req.session.user = { email: user.email, role: user.role || 'member' };
    return res.json({ ok: true, user: req.session.user });
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('ghp.sid');
    res.status(204).end();
  });
});

function requireAccount(req, res, next) {
  if (!AUTH_REQUIRED) return next();
  if (!SESSION_SECRET || !USERS.length) return res.status(503).send('Private beta access has not been configured.');
  if (req.session.user) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'An account is required.' });
  return res.redirect('/login');
}

app.use(requireAccount);
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

app.get('/api/account', (req, res) => res.json({ user: req.session.user || null }));

app.post('/api/clone', async (req, res) => {
  try {
    const { url, shallow = true, branch } = req.body || {};
    if (!url || !isValidGitUrl(url)) return res.status(400).json({ error: 'Only standard GitHub repository URLs are supported.' });
    const id = crypto.randomUUID();
    const dir = path.join(CLONES_DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    const cloneOptions = ['--config', 'protocol.file.allow=never'];
    if (shallow) cloneOptions.push('--depth', '1');
    if (branch) cloneOptions.push('--branch', branch);
    await simpleGit({ baseDir: dir }).clone(url, '.', cloneOptions);
    cloneRegistry.set(id, { id, dir, url, branch: branch || null, createdAt: Date.now() });
    return res.json({ id, url, branch: branch || null, status: 'cloned' });
  } catch (error) {
    console.error('Clone failed:', error);
    return res.status(500).json({ error: 'Clone failed' });
  }
});

app.get('/api/clone/:id/tree', (req, res) => {
  const entry = cloneRegistry.get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Clone not found' });
  try {
    return res.json({ id: entry.id, files: listFilesRecursive(entry.dir) });
  } catch (error) {
    console.error('List tree failed:', error);
    return res.status(500).json({ error: 'Failed to list tree' });
  }
});

app.get('/api/clone/:id/file', (req, res) => {
  const entry = cloneRegistry.get(req.params.id);
  const relPath = req.query.path;
  if (!entry) return res.status(404).json({ error: 'Clone not found' });
  if (!relPath || path.isAbsolute(relPath)) return res.status(400).json({ error: 'Invalid path' });
  const full = path.resolve(entry.dir, relPath);
  if (!full.startsWith(`${entry.dir}${path.sep}`) || relPath === '.git' || relPath.startsWith('.git/')) return res.status(403).json({ error: 'Forbidden' });
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) return res.status(403).json({ error: 'Symbolic links are not supported' });
  if (stat.isDirectory()) return res.status(400).json({ error: 'Path is a directory' });
  if (stat.size > 2 * 1024 * 1024) return res.json({ path: relPath, encoding: 'base64', size: stat.size, content: null, tooLarge: true });
  return res.json({ path: relPath, content: fs.readFileSync(full, 'utf8'), encoding: 'utf8', size: stat.size });
});

setInterval(() => {
  const expiry = Date.now() - CLONE_TTL_MS;
  for (const [id, entry] of cloneRegistry.entries()) {
    if (entry.createdAt < expiry) {
      fs.rm(entry.dir, { recursive: true, force: true }, () => {});
      cloneRegistry.delete(id);
    }
  }
}, 15 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`GhP WebEditor running at http://localhost:${PORT}`);
});
