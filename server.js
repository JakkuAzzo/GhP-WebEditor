/**
 * Purpose: compose and serve the editor's local/server runtime.
 *
 * Responsibilities:
 * - Serve first-party editor assets and dependency bundles.
 * - Expose bounded preview, clone, local Git, and optional GitHub App routes.
 * - Keep registries and security-sensitive sessions process-local.
 *
 * Constraints: route handlers must use the validators in lib/clone-workspace.js;
 * preview content is untrusted; public hosted use requires authentication and
 * operational controls that are intentionally absent from the local v1 server.
 * Relationships: main.js owns Electron startup; public/app.js is the browser client.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const helmet = require('helmet');
const simpleGit = require('simple-git');
const {
  assertExistingDirectory,
  assertExistingFile,
  listFilesRecursive,
  parseAllowedHosts,
  resolveWritableDirectory,
  resolveWritableFile,
  validateBranch,
  validateCloneUrl
} = require('./lib/clone-workspace');
const { registerGitHubRoutes } = require('./lib/github-app');
const { createMemoryJobStore } = require('./lib/build-jobs');
const { loadConfig } = require('./lib/config');
const { verifyGitHubSignature, verifyStripeSignature } = require('./lib/webhook-signatures');

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const DEFAULT_CLONES_DIR = path.join(os.tmpdir(), 'buildy-clones');

function bufferedStatic(root, options = {}) {
  const resolvedRoot = path.resolve(root);
  return async (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    try {
      const requested = decodeURIComponent(req.path);
      const relative = requested === '/' && options.index ? options.index : requested.replace(/^\/+/, '');
      if (!relative || relative.includes('\0')) return next();
      const fullPath = path.resolve(resolvedRoot, relative);
      const boundary = `${resolvedRoot}${path.sep}`;
      if (!fullPath.startsWith(boundary)) return next();
      const data = await fs.promises.readFile(fullPath);
      // Express treats a Buffer as generic binary unless a concrete MIME type is
      // already present. Pass only the extension so index.html is rendered rather
      // than offered as a download by Chromium.
      res.type(path.extname(fullPath));
      res.set('Cache-Control', 'no-cache');
      if (req.method === 'HEAD') return res.status(200).end();
      return res.send(data);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EISDIR') return next();
      return next(error);
    }
  };
}

function createApp(options = {}) {
  const app = express();
  const config = loadConfig(options.env || process.env);
  const clonesDir = options.clonesDir || DEFAULT_CLONES_DIR;
  const cloneRegistry = options.cloneRegistry || new Map();
  const previewRegistry = options.previewRegistry || new Map();
  const authStates = options.authStates || new Map();
  const githubSessions = options.githubSessions || new Map();
  const githubFetch = options.githubFetch || global.fetch;
  const jobStore = options.jobStore || createMemoryJobStore();
  const githubConfig = options.githubConfig || config.github;
  const localOnly = options.localOnly ?? (process.env.BUILDY_LOCAL_ONLY ?? process.env.GHP_LOCAL_ONLY) === 'true';
  const jobsEnabled = options.jobsEnabled ?? config.jobsEnabled;
  const jobApiToken = options.jobApiToken ?? config.jobApiToken;
  const entitlementResolver = options.entitlementResolver || null;
  const jobRate = new Map();
  function authorizeJob(req, res) {
    if (localOnly) return true;
    const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!jobApiToken || supplied !== jobApiToken) { res.status(401).json({ error: 'Authenticated build access required' }); return false; }
    const now = Date.now(); const key = req.ip || req.socket.remoteAddress || 'unknown';
    const recent = (jobRate.get(key) || []).filter(timestamp => now - timestamp < 60_000);
    if (recent.length >= 60) { res.status(429).json({ error: 'Build job rate limit exceeded' }); return false; }
    recent.push(now); jobRate.set(key, recent); return true;
  }
  const allowedHosts = options.allowedHosts || parseAllowedHosts();
  const cloneRepository = options.cloneRepository || (async (url, dir, cloneOptions) => {
    const git = simpleGit({ timeout: { block: Number(process.env.CLONE_TIMEOUT_MS) || 120_000 } });
    await git.clone(url, dir, cloneOptions);
  });

  fs.mkdirSync(clonesDir, { recursive: true });
  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://copilot-proxy.githubusercontent.com'],
        frameSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    }
  }));
  const webhookBody = express.raw({ type: 'application/json', limit: '1mb' });
  app.post('/api/github/marketplace/webhook', webhookBody, (req, res) => {
    if (!config.github.webhookSecret) return res.status(503).json({ error: 'GitHub webhook is not configured' });
    const signature = req.headers['x-hub-signature-256'];
    if (!verifyGitHubSignature(req.body, signature, config.github.webhookSecret)) return res.status(401).json({ error: 'Invalid webhook signature' });
    let event; try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid webhook JSON' }); }
    return res.status(202).json({ accepted: true, event: event.action || 'unknown' });
  });
  app.post('/api/stripe/webhook', webhookBody, (req, res) => {
    if (!config.stripeWebhookSecret) return res.status(503).json({ error: 'Stripe webhook is not configured' });
    const signature = req.headers['stripe-signature'];
    if (!verifyStripeSignature(req.body, signature, config.stripeWebhookSecret)) return res.status(401).json({ error: 'Invalid webhook signature' });
    let event; try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid webhook JSON' }); }
    return res.status(202).json({ accepted: true, event: event.type || 'unknown' });
  });
  app.use(express.json({ limit: `${MAX_FILE_SIZE}b` }));
  app.use('/lib/codemirror', bufferedStatic(path.join(__dirname, 'node_modules', 'codemirror')));
  app.use('/lib/marked', bufferedStatic(path.join(__dirname, 'node_modules', 'marked')));
  app.use('/lib/dompurify', bufferedStatic(path.join(__dirname, 'node_modules', 'dompurify', 'dist')));
  app.use('/lib/fontawesome/fontawesome-free', bufferedStatic(path.join(__dirname, 'node_modules', '@fortawesome', 'fontawesome-free')));
  app.use('/lib/fflate', bufferedStatic(path.join(__dirname, 'node_modules', 'fflate')));
  app.use(bufferedStatic(path.join(__dirname, 'public'), { index: 'index.html' }));

  function getClone(req, res) {
    const entry = cloneRegistry.get(req.params.id);
    if (!entry) res.status(404).json({ error: 'Clone not found' });
    return entry;
  }

  app.get(['/health', '/api/health'], (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/runtime', (_req, res) => res.json({ localOnly }));
  app.get('/api/jobs', (req, res) => {
    if (!jobsEnabled) return res.status(404).json({ error: 'Build jobs are not enabled' });
    if (!authorizeJob(req, res)) return;
    return res.json({ jobs: jobStore.list({ projectId: req.query.projectId, limit: req.query.limit }) });
  });
  app.post('/api/jobs', (req, res) => {
    if (!jobsEnabled) return res.status(404).json({ error: 'Build jobs are not enabled' });
    if (!authorizeJob(req, res)) return;
    try {
      const job = jobStore.create(req.body || {});
      return res.status(201).json(job);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });
  app.get('/api/jobs/:id', (req, res) => {
    if (!jobsEnabled) return res.status(404).json({ error: 'Build jobs are not enabled' });
    if (!authorizeJob(req, res)) return;
    const job = jobStore.get(req.params.id);
    return job ? res.json(job) : res.status(404).json({ error: 'Job not found' });
  });
  app.post('/api/jobs/:id/cancel', (req, res) => {
    if (!jobsEnabled) return res.status(404).json({ error: 'Build jobs are not enabled' });
    if (!authorizeJob(req, res)) return;
    try {
      const job = jobStore.update(req.params.id, 'cancelled');
      return job ? res.json(job) : res.status(404).json({ error: 'Job not found' });
    } catch (error) {
      return res.status(409).json({ error: error.message });
    }
  });
  app.get('/api/jobs/:id/artifact', (req, res) => {
    if (!jobsEnabled) return res.status(404).json({ error: 'Build jobs are not enabled' });
    if (!authorizeJob(req, res)) return;
    const job = jobStore.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'succeeded' || !job.artifact) return res.status(409).json({ error: 'Artifact is not available' });
    if (config.publicMode) {
      if (!entitlementResolver) return res.status(503).json({ error: 'Entitlement service is not configured' });
      if (!entitlementResolver(req, job)) return res.status(403).json({ error: 'Active entitlement required' });
    }
    // The local contract exposes metadata only. A production download must be
    // backed by an entitlement-checked, expiring object-storage URL.
    if (!job.artifact.downloadUrl) return res.status(501).json({ error: 'Artifact storage is not configured' });
    return res.redirect(302, job.artifact.downloadUrl);
  });
  registerGitHubRoutes(app, { authStates, githubSessions, githubFetch, githubConfig });

  app.post('/api/preview', (req, res) => {
    const html = req.body?.html;
    if (typeof html !== 'string' || Buffer.byteLength(html) > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'Preview must be HTML no larger than 2MB' });
    }
    const now = Date.now();
    for (const [key, value] of previewRegistry) {
      if (now - value.createdAt > 5 * 60_000) previewRegistry.delete(key);
    }
    while (previewRegistry.size >= 20) previewRegistry.delete(previewRegistry.keys().next().value);
    const id = crypto.randomUUID();
    previewRegistry.set(id, { html, createdAt: now });
    return res.status(201).json({ id });
  });

  app.get('/api/preview/:id', (req, res) => {
    const preview = previewRegistry.get(req.params.id);
    if (!preview) return res.status(404).send('Preview not found');
    res.set('Content-Security-Policy', [
      "default-src 'none'",
      "script-src 'unsafe-inline' data: https:",
      "style-src 'unsafe-inline' https:",
      "img-src data: blob: https:",
      "font-src data: https:",
      "connect-src https:",
      "media-src blob: https:",
      "frame-src https:",
      "base-uri 'none'",
      "form-action 'none'"
    ].join('; '));
    return res.type('html').send(preview.html);
  });

  app.post('/api/clone', async (req, res) => {
    const { url, shallow = true, branch } = req.body || {};
    if (!validateCloneUrl(url, allowedHosts) || !validateBranch(branch) || typeof shallow !== 'boolean') {
      return res.status(400).json({ error: 'Invalid clone request' });
    }
    const id = crypto.randomUUID();
    const dir = path.join(clonesDir, id);
    const cloneOptions = [];
    if (shallow) cloneOptions.push('--depth', '1');
    if (branch) cloneOptions.push('--branch', branch);
    try {
      await cloneRepository(url, dir, cloneOptions);
      cloneRegistry.set(id, { id, dir, url, branch: branch || null, createdAt: Date.now() });
      return res.json({ id, url, branch: branch || null, status: 'cloned' });
    } catch (error) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.error('Clone failed:', error.message);
      return res.status(502).json({ error: 'Clone failed' });
    }
  });

  app.get('/api/clone/:id/tree', (req, res) => {
    const entry = getClone(req, res);
    if (!entry) return;
    try {
      return res.json({ id: entry.id, files: listFilesRecursive(entry.dir) });
    } catch (error) {
      console.error('List tree failed:', error.message);
      return res.status(422).json({ error: 'Unable to list repository tree' });
    }
  });

  app.get('/api/clone/:id/file', (req, res) => {
    const entry = getClone(req, res);
    if (!entry) return;
    try {
      const { normalized, fullPath, stat } = assertExistingFile(entry.dir, req.query.path);
      if (stat.size > MAX_FILE_SIZE) {
        return res.json({ path: normalized, encoding: 'base64', size: stat.size, content: null, tooLarge: true });
      }
      const data = fs.readFileSync(fullPath);
      if (req.query.encoding === 'base64') {
        return res.json({ path: normalized, content: data.toString('base64'), encoding: 'base64', size: stat.size });
      }
      return res.json({ path: normalized, content: data.toString('utf8'), encoding: 'utf8', size: stat.size });
    } catch (error) {
      const status = error.code === 'ENOENT' ? 404 : 400;
      return res.status(status).json({ error: status === 404 ? 'File not found' : error.message });
    }
  });

  app.put('/api/clone/:id/file', (req, res) => {
    const entry = getClone(req, res);
    if (!entry) return;
    const { path: requestedPath, content } = req.body || {};
    if (typeof content !== 'string' || Buffer.byteLength(content) > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'Content must be UTF-8 text no larger than 2MB' });
    }
    try {
      const { normalized, fullPath } = resolveWritableFile(entry.dir, requestedPath);
      fs.writeFileSync(fullPath, content, { encoding: 'utf8', flag: 'w' });
      return res.json({ path: normalized, size: Buffer.byteLength(content), status: 'saved' });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/clone/:id/directory', (req, res) => {
    const entry = getClone(req, res);
    if (!entry) return;
    try {
      const { normalized, fullPath } = resolveWritableDirectory(entry.dir, req.body?.path);
      fs.mkdirSync(fullPath);
      return res.json({ path: normalized, status: 'created' });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/clone/:id/file', (req, res) => {
    const entry = getClone(req, res);
    if (!entry) return;
    try {
      const { normalized, fullPath } = assertExistingFile(entry.dir, req.query.path);
      fs.unlinkSync(fullPath);
      return res.json({ path: normalized, status: 'deleted' });
    } catch (error) {
      const status = error.code === 'ENOENT' ? 404 : 400;
      return res.status(status).json({ error: status === 404 ? 'File not found' : error.message });
    }
  });

  app.delete('/api/clone/:id/directory', (req, res) => {
    const entry = getClone(req, res);
    if (!entry) return;
    try {
      const { normalized, fullPath } = assertExistingDirectory(entry.dir, req.query.path);
      fs.rmdirSync(fullPath);
      return res.json({ path: normalized, status: 'deleted' });
    } catch (error) {
      const status = error.code === 'ENOENT' ? 404 : 400;
      return res.status(status).json({ error: status === 404 ? 'Directory not found' : error.message });
    }
  });

  app.get('/api/clone/:id/status', async (req, res) => {
    const entry = getClone(req, res);
    if (!entry) return;
    try {
      const status = await simpleGit(entry.dir).status();
      return res.json({
        current: status.current,
        tracking: status.tracking,
        files: status.files.map(file => ({ path: file.path, index: file.index, working_dir: file.working_dir }))
      });
    } catch (error) {
      console.error('Status failed:', error.message);
      return res.status(500).json({ error: 'Unable to read repository status' });
    }
  });

  app.post('/api/clone/:id/commit', async (req, res) => {
    const entry = getClone(req, res);
    if (!entry) return;
    const { message, authorName, authorEmail } = req.body || {};
    if (typeof message !== 'string' || !message.trim() || message.length > 200
      || typeof authorName !== 'string' || !authorName.trim() || /[\r\n]/.test(authorName)
      || typeof authorEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail)) {
      return res.status(400).json({ error: 'A valid message, author name, and author email are required' });
    }
    try {
      const git = simpleGit(entry.dir);
      await git.raw(['add', '--all', '--']);
      const result = await git.raw([
        '-c', `user.name=${authorName}`,
        '-c', `user.email=${authorEmail}`,
        'commit', '-m', message.trim(), '--'
      ]);
      const sha = await git.revparse(['HEAD']);
      return res.json({ status: 'committed', sha: sha.trim(), summary: result.trim() });
    } catch (error) {
      console.error('Commit failed:', error.message);
      return res.status(409).json({ error: 'Commit failed; verify that the workspace has changes' });
    }
  });

  app.use((error, _req, res, next) => {
    console.error('Request failed:', error.message);
    if (res.headersSent) return next(error);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

function startServer(port = Number(process.env.PORT) || 3000, host = process.env.HOST || '0.0.0.0') {
  const app = createApp();
  const server = app.listen(port, host, () => {
    const address = server.address();
    console.log(`GitHub Pages Web Editor running at http://${host}:${address.port}`);
  });
  return server;
}

if (require.main === module) startServer();

module.exports = { createApp, startServer };
