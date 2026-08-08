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
const { PLANS } = require('./plans');
const billingStore = require('./billing-store');

const app = express();
const PORT = Number(process.env.PORT || process.env.BUILDY_PORT || 3000);
const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== 'false';
// BUILDY_* is canonical; GHP_* remains supported for existing Railway deployments.
const SESSION_SECRET = process.env.BUILDY_SESSION_SECRET || process.env.GHP_SESSION_SECRET;
const GITHUB_CLIENT_ID = process.env.BUILDY_GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.BUILDY_GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL = process.env.BUILDY_GITHUB_CALLBACK_URL;
const GITHUB_WEBHOOK_SECRET = process.env.BUILDY_GITHUB_WEBHOOK_SECRET;
const STRIPE_WEBHOOK_SECRET = process.env.BUILDY_STRIPE_WEBHOOK_SECRET;
const PUBLIC_MODE = process.env.BUILDY_PUBLIC_MODE === 'true';
const TOKEN_ENCRYPTION_KEY = process.env.BUILDY_TOKEN_ENCRYPTION_KEY;
const CLONE_TTL_MS = 60 * 60 * 1000;
const CLONES_DIR = path.join(os.tmpdir(), 'buildy-github-pages-clones');
const cloneRegistry = new Map();

function configuredUsers() {
  try {
    const users = JSON.parse(process.env.BUILDY_USERS || process.env.GHP_USERS || '[]');
    return Array.isArray(users) ? users.filter(user => user && user.email && user.passwordHash) : [];
  } catch {
    return [];
  }
}

const USERS = configuredUsers();
if (!fs.existsSync(CLONES_DIR)) fs.mkdirSync(CLONES_DIR, { recursive: true });
if (AUTH_REQUIRED && !SESSION_SECRET) console.error('BUILDY_SESSION_SECRET is required while authentication is enabled.');
if (AUTH_REQUIRED && !TOKEN_ENCRYPTION_KEY) console.warn('BUILDY_TOKEN_ENCRYPTION_KEY is not set; GitHub tokens will not be persisted securely.');

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      // The public waitlist uses FormSubmit; keep every other default Helmet
      // directive intact while allowing only that specific form destination.
      formAction: ["'self'", 'https://formsubmit.co']
    }
  }
}));
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); }
}));
app.use(session({
  name: 'buildy.sid',
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
  res.json({
    status: 'ok',
    access: AUTH_REQUIRED ? (USERS.length ? 'configured' : 'not-configured') : 'open',
    config: {
      session: Boolean(SESSION_SECRET),
      users: USERS.length > 0,
      githubOAuth: Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET && GITHUB_CALLBACK_URL),
      tokenEncryption: Boolean(TOKEN_ENCRYPTION_KEY),
      marketplaceWebhook: Boolean(GITHUB_WEBHOOK_SECRET),
      stripeWebhook: Boolean(STRIPE_WEBHOOK_SECRET),
      billingStore: billingStore.configured(),
      publicMode: PUBLIC_MODE
    }
  });
});

app.get('/login', (req, res) => {
  if (!AUTH_REQUIRED || req.session.user) return res.redirect('/');
  return sendLoginPage(res);
});

// The product landing page is the public home of the Buildy subdomain. The editor
// itself remains protected and is exposed separately at /workspace.
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'buildy-landing.html')));
app.get('/marketplace', (_req, res) => res.redirect(301, '/'));
app.get('/landing.css', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.css')));
app.get('/landing-enhancements.css', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'landing-enhancements.css')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/lib/fontawesome', express.static(path.join(__dirname, 'public', 'lib', 'fontawesome')));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });
const githubAuthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api', apiLimiter);
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
    res.clearCookie('buildy.sid');
    res.clearCookie('ghp.sid');
    res.status(204).end();
  });
});

function safeEqual(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function encryptToken(value) {
  if (!TOKEN_ENCRYPTION_KEY) return value;
  const key = crypto.createHash('sha256').update(TOKEN_ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptToken(value) {
  if (!value || !TOKEN_ENCRYPTION_KEY || !String(value).startsWith('v1.')) return value;
  try {
    const [, ivText, tagText, ciphertextText] = String(value).split('.');
    const key = crypto.createHash('sha256').update(TOKEN_ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
  } catch { return null; }
}

app.get('/auth/github/start', githubAuthLimiter, (req, res) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_CALLBACK_URL) return res.status(503).send('GitHub App sign-in is not configured.');
  if (AUTH_REQUIRED && !TOKEN_ENCRYPTION_KEY) return res.status(503).send('Secure GitHub token storage is not configured.');
  const state = crypto.randomBytes(24).toString('hex');
  req.session.githubOAuthState = state;
  const params = new URLSearchParams({ client_id: GITHUB_CLIENT_ID, redirect_uri: GITHUB_CALLBACK_URL, state });
  return res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

app.get('/auth/github/callback', githubAuthLimiter, async (req, res) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !GITHUB_CALLBACK_URL) return res.status(503).send('GitHub App sign-in is not configured.');
  if (!req.query.code || !safeEqual(String(req.query.state || ''), String(req.session.githubOAuthState || ''))) {
    return res.status(400).send('Invalid GitHub sign-in state.');
  }
  delete req.session.githubOAuthState;
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code: req.query.code, redirect_uri: GITHUB_CALLBACK_URL })
    });
    const token = await tokenResponse.json();
    if (!token.access_token) return res.status(502).send('GitHub did not return an access token.');
    req.session.githubAccessToken = encryptToken(token.access_token);
    try {
      const profileResponse = await fetch('https://api.github.com/user', { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.access_token}`, 'User-Agent': 'Buildy' } });
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        req.session.githubAccountId = String(profile.id);
        req.session.githubLogin = profile.login;
      }
    } catch (error) { console.warn('Could not read GitHub profile:', error.message); }
    return res.redirect('/#github-app-connected');
  } catch (error) {
    console.error('GitHub App callback failed:', error.message);
    return res.status(502).send('GitHub sign-in failed.');
  }
});

app.post('/api/github/marketplace/webhook', async (req, res) => {
  if (!GITHUB_WEBHOOK_SECRET) return res.status(503).json({ error: 'Marketplace webhook is not configured.' });
  const signature = String(req.get('x-hub-signature-256') || '');
  const expected = `sha256=${crypto.createHmac('sha256', GITHUB_WEBHOOK_SECRET).update(req.rawBody || Buffer.from('')).digest('hex')}`;
  if (!safeEqual(signature, expected)) return res.status(401).json({ error: 'Invalid webhook signature.' });
  const event = req.get('x-github-event') || 'unknown';
  const deliveryId = req.get('x-github-delivery');
  if (!deliveryId) return res.status(400).json({ error: 'Missing GitHub delivery id.' });
  if (event !== 'marketplace_purchase') return res.status(204).end();
  if (!billingStore.configured()) return res.status(503).json({ error: 'Billing store is not configured.' });
  try {
    const payload = req.body || {};
    await billingStore.recordWebhook({ deliveryId, eventName: event, payload });
    const purchase = payload.marketplace_purchase || payload;
    const account = purchase.account || {};
    const plan = purchase.plan || {};
    const action = purchase.action;
    const state = action === 'cancelled' ? 'cancelled' : action === 'changed' ? 'active' : 'active';
    await billingStore.upsertSubscription({
      github_purchase_id: String(purchase.id || deliveryId),
      github_account_id: String(account.id || ''),
      github_login: account.login || null,
      github_plan_id: String(plan.id || ''),
      plan_name: plan.name || null,
      billing_cycle: purchase.billing_cycle || null,
      state,
      effective_date: purchase.effective_date || null,
      next_billing_date: purchase.next_billing_date || null,
      updated_at: new Date().toISOString()
    });
    console.log(`GitHub Marketplace purchase ${action || 'updated'} for ${account.login || 'unknown account'}`);
    return res.status(204).end();
  } catch (error) {
    console.error('Marketplace webhook persistence failed:', error.message);
    return res.status(500).json({ error: 'Marketplace event could not be persisted.' });
  }
});

function verifyStripeSignature(header, rawBody) {
  if (!STRIPE_WEBHOOK_SECRET || !header || !rawBody) return false;
  const parts = Object.fromEntries(String(header).split(',').map(part => part.split('=')));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300 || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(`${parts.t}.${rawBody}`).digest('hex');
  return safeEqual(parts.v1, expected);
}

app.post('/api/stripe/webhook', async (req, res) => {
  if (!STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'Stripe webhook is not configured.' });
  if (!verifyStripeSignature(req.get('stripe-signature'), req.rawBody)) return res.status(401).json({ error: 'Invalid Stripe signature.' });
  if (!billingStore.configured()) return res.status(503).json({ error: 'Billing store is not configured.' });
  const event = req.body || {};
  try {
    await billingStore.recordStripeEvent({ eventId: String(event.id || ''), eventName: String(event.type || 'unknown'), payload: event });
    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object || {};
      const accountRef = String(session.client_reference_id || session.metadata?.github_account_id || '');
      const planSlug = String(session.metadata?.plan_slug || 'project-pass');
      if (accountRef) {
        await billingStore.upsertEntitlement({
          entitlement_id: `stripe:${session.id}`,
          account_ref: accountRef,
          email: session.customer_details?.email || session.customer_email || null,
          plan_slug: planSlug,
          provider: 'stripe',
          provider_reference: String(session.payment_intent || session.id),
          state: 'active',
          expires_at: null,
          updated_at: new Date().toISOString()
        });
      }
    }
    return res.status(204).end();
  } catch (error) {
    console.error('Stripe webhook persistence failed:', error.message);
    return res.status(500).json({ error: 'Stripe event could not be persisted.' });
  }
});

// Public trust and conversion pages remain available before account sign-in.
for (const page of ['marketplace', 'pricing', 'privacy', 'terms', 'support', 'security', 'status', 'thanks']) {
  app.get(`/${page}`, (_req, res) => res.sendFile(path.join(__dirname, 'public', `${page}.html`)));
}
app.get('/buildy-public.css', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'buildy-public.css')));

function requireAccount(req, res, next) {
  if (!AUTH_REQUIRED) return next();
  if (PUBLIC_MODE) {
    if (req.session.githubAccessToken) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Connect GitHub to continue.' });
    return res.redirect('/auth/github/start');
  }
  if (!SESSION_SECRET || !USERS.length) return res.status(503).send('Private beta access has not been configured.');
  if (req.session.user) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'An account is required.' });
  return res.redirect('/login');
}

app.use(requireAccount);
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

app.get('/workspace', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/api/account', (req, res) => res.json({ user: req.session.user || null }));
app.get('/api/plans', (_req, res) => res.json({ plans: PLANS }));
app.get('/api/billing/me', async (req, res) => {
  if (!billingStore.configured()) return res.json({ configured: false, subscription: null });
  try {
    const githubAccountId = req.session.githubAccountId;
    if (!githubAccountId) return res.json({ configured: true, subscription: null });
    return res.json({ configured: true, subscription: await billingStore.subscriptionForAccount(githubAccountId), entitlements: await billingStore.entitlementsForAccount(githubAccountId) });
  } catch (error) { return res.status(502).json({ error: error.message }); }
});
app.get('/api/github/token', (req, res) => {
  if (!req.session.githubAccessToken) return res.status(404).json({ error: 'GitHub App is not connected.' });
  const token = decryptToken(req.session.githubAccessToken);
  if (!token) return res.status(500).json({ error: 'GitHub session token could not be decrypted.' });
  res.set('Cache-Control', 'no-store');
  return res.json({ token });
});

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

if (require.main === module) {
  const listener = app.listen(PORT, () => {
    const address = listener.address();
    const port = address && typeof address === 'object' ? address.port : PORT;
    console.log(`Buildy running at http://localhost:${port}`);
  });
}

module.exports = app;
