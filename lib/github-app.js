const crypto = require('crypto');
const { normalizeRepoPath, validateBranch } = require('./clone-workspace');

const SESSION_TTL_MS = 8 * 60 * 60_000;
const STATE_TTL_MS = 10 * 60_000;
const MAX_SESSION_ENTRIES = 100;

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const separator = value.indexOf('=');
    if (separator < 1) return ['', ''];
    try {
      return [value.slice(0, separator), decodeURIComponent(value.slice(separator + 1))];
    } catch {
      return [value.slice(0, separator), ''];
    }
  }).filter(([name]) => name));
}

function validGitHubName(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_.-]+$/.test(value);
}

function encodeGitHubContentPath(value) {
  return normalizeRepoPath(value).split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function pruneMap(map, ttl, now = Date.now()) {
  for (const [key, value] of map) {
    const createdAt = typeof value === 'number' ? value : value.createdAt;
    if (!createdAt || now - createdAt > ttl) map.delete(key);
  }
  while (map.size >= MAX_SESSION_ENTRIES) map.delete(map.keys().next().value);
}

function callbackUrl(req, configuredUrl) {
  if (configuredUrl) {
    const parsed = new URL(configuredUrl);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname))) {
      throw new Error('GitHub callback URL must use HTTPS, except on loopback');
    }
    return parsed.toString();
  }
  return `http://127.0.0.1:${req.socket.localPort}/api/auth/github/callback`;
}

function validBase64(value) {
  return typeof value === 'string'
    && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function cleanMutation(body, deleting = false) {
  if (!body || typeof body !== 'object'
    || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 200
    || !validateBranch(body.branch)) {
    throw new Error('Invalid GitHub commit request');
  }
  if (deleting && (typeof body.sha !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(body.sha))) {
    throw new Error('A valid file revision is required');
  }
  if (!deleting && !validBase64(body.content)) throw new Error('File content must be base64 encoded');
  if (body.sha != null && (typeof body.sha !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(body.sha))) {
    throw new Error('Invalid file revision');
  }
  const result = { message: body.message.trim(), branch: body.branch || 'main' };
  if (!deleting) result.content = body.content;
  if (body.sha) result.sha = body.sha;
  return result;
}

function registerGitHubRoutes(app, options = {}) {
  const authStates = options.authStates || new Map();
  const githubSessions = options.githubSessions || new Map();
  const githubFetch = options.githubFetch || global.fetch;
  const config = options.githubConfig || {};

  function configured() {
    return Boolean(config.clientId && config.clientSecret && config.slug);
  }

  function getSession(req) {
    const id = parseCookies(req.headers.cookie).ghp_session;
    const session = id && githubSessions.get(id);
    if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
      if (id) githubSessions.delete(id);
      return null;
    }
    return session;
  }

  async function api(session, endpoint, requestOptions = {}) {
    return githubFetch(`https://api.github.com${endpoint}`, {
      ...requestOptions,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...requestOptions.headers
      }
    });
  }

  async function pages(session, endpoint, key) {
    const items = [];
    for (let page = 1; page <= 10; page += 1) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await api(session, `${endpoint}${separator}per_page=100&page=${page}`);
      if (!response.ok) throw new Error(`Unable to list GitHub ${key}`);
      const batch = (await response.json())[key] || [];
      items.push(...batch);
      if (batch.length < 100) break;
    }
    return items;
  }

  async function loadAllowedRepositories(session, force = false) {
    if (!force && session.repositories && Date.now() - session.repositoriesAt < 60_000) return session.repositories;
    const installations = await pages(session, '/user/installations', 'installations');
    const repositories = [];
    for (const installation of installations) {
      repositories.push(...await pages(session, `/user/installations/${installation.id}/repositories`, 'repositories'));
    }
    session.repositories = repositories;
    session.repositoriesAt = Date.now();
    session.allowedRepositories = new Set(repositories.map(repo => repo.full_name.toLowerCase()));
    return repositories;
  }

  async function requireRepository(req, res) {
    const session = getSession(req);
    if (!session) {
      res.status(401).json({ error: 'GitHub login required' });
      return null;
    }
    const { owner, repo } = req.params;
    if (!validGitHubName(owner) || !validGitHubName(repo)) {
      res.status(400).json({ error: 'Invalid repository name' });
      return null;
    }
    try {
      await loadAllowedRepositories(session);
      if (!session.allowedRepositories.has(`${owner}/${repo}`.toLowerCase())) {
        res.status(403).json({ error: 'Repository was not granted to this GitHub App installation' });
        return null;
      }
      return session;
    } catch (error) {
      res.status(502).json({ error: error.message });
      return null;
    }
  }

  async function send(response, res) {
    const body = await response.text();
    res.status(response.status).type('json');
    return res.send(body || '{}');
  }

  const route = handler => async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/auth/github/status', (req, res) => {
    const session = getSession(req);
    return res.json({ configured: configured(), authenticated: Boolean(session), user: session?.user || null });
  });

  app.get('/api/auth/github/start', (req, res) => {
    if (!configured()) return res.status(503).send('GitHub App authentication is not configured');
    const state = crypto.randomBytes(24).toString('base64url');
    pruneMap(authStates, STATE_TTL_MS);
    authStates.set(state, Date.now());
    let callback;
    try {
      callback = callbackUrl(req, config.callbackUrl);
    } catch (error) {
      return res.status(500).send(error.message);
    }
    res.cookie('ghp_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: callback.startsWith('https:'), maxAge: STATE_TTL_MS, path: '/' });
    const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: callback, state });
    return res.redirect(`https://github.com/login/oauth/authorize?${query}`);
  });

  app.get('/api/auth/github/callback', route(async (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const stateCreatedAt = authStates.get(req.query.state);
    authStates.delete(req.query.state);
    if (!req.query.code || !stateCreatedAt || cookies.ghp_oauth_state !== req.query.state
      || Date.now() - stateCreatedAt > STATE_TTL_MS) {
      return res.status(400).send('Invalid or expired GitHub login');
    }
    try {
      const callback = callbackUrl(req, config.callbackUrl);
      const tokenResponse = await githubFetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code: req.query.code, redirect_uri: callback })
      });
      const token = await tokenResponse.json();
      if (!tokenResponse.ok || !token.access_token) throw new Error('GitHub rejected the authorization code');
      const provisional = { accessToken: token.access_token, createdAt: Date.now() };
      const userResponse = await api(provisional, '/user');
      if (!userResponse.ok) throw new Error('Unable to load the authorized GitHub account');
      provisional.user = await userResponse.json();
      const sessionId = crypto.randomBytes(32).toString('base64url');
      pruneMap(githubSessions, SESSION_TTL_MS);
      githubSessions.set(sessionId, provisional);
      res.clearCookie('ghp_oauth_state', { path: '/' });
      res.cookie('ghp_session', sessionId, { httpOnly: true, sameSite: 'lax', secure: callback.startsWith('https:'), maxAge: SESSION_TTL_MS, path: '/' });
      return res.redirect('/?github=connected');
    } catch (error) {
      console.error('GitHub App callback failed:', error.message);
      return res.status(502).send('GitHub login failed');
    }
  }));

  app.get('/api/auth/github/install', (req, res) => {
    if (!configured()) return res.status(503).send('GitHub App authentication is not configured');
    return res.redirect(`https://github.com/apps/${encodeURIComponent(config.slug)}/installations/new`);
  });
  app.get('/api/auth/github/setup', (_req, res) => res.redirect('/?github=installed'));
  app.post('/api/auth/github/logout', (req, res) => {
    const id = parseCookies(req.headers.cookie).ghp_session;
    if (id) githubSessions.delete(id);
    res.clearCookie('ghp_session', { path: '/' });
    return res.status(204).end();
  });

  app.get('/api/github/repositories', route(async (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'GitHub login required' });
    try {
      const repositories = await loadAllowedRepositories(session, true);
      return res.json(repositories.map(repo => ({ full_name: repo.full_name, default_branch: repo.default_branch, permissions: repo.permissions })));
    } catch (error) {
      return res.status(502).json({ error: error.message, installUrl: '/api/auth/github/install' });
    }
  }));

  app.get('/api/github/repos/:owner/:repo', route(async (req, res) => {
    const session = await requireRepository(req, res);
    if (session) return send(await api(session, `/repos/${req.params.owner}/${req.params.repo}`), res);
  }));

  app.get('/api/github/repos/:owner/:repo/pages/status', route(async (req, res) => {
    const session = await requireRepository(req, res);
    if (!session) return;
    const prefix = `/repos/${req.params.owner}/${req.params.repo}/pages`;
    const siteResponse = await api(session, prefix);
    if (siteResponse.status === 404) return res.json({ configured: false });
    if (!siteResponse.ok) return send(siteResponse, res);
    const site = await siteResponse.json();
    const buildResponse = await api(session, `${prefix}/builds/latest`);
    const build = buildResponse.ok ? await buildResponse.json() : null;
    return res.json({
      configured: true,
      url: site.html_url,
      buildType: site.build_type,
      source: site.source ? { branch: site.source.branch, path: site.source.path } : null,
      build: build ? { status: build.status, commit: build.commit, error: build.error?.message || null, updatedAt: build.updated_at } : null
    });
  }));

  app.get('/api/github/repos/:owner/:repo/tree', route(async (req, res) => {
    const session = await requireRepository(req, res);
    if (!session) return;
    if (!validateBranch(req.query.branch)) return res.status(400).json({ error: 'Invalid branch' });
    const branch = encodeURIComponent(String(req.query.branch || 'main'));
    return send(await api(session, `/repos/${req.params.owner}/${req.params.repo}/git/trees/${branch}?recursive=1`), res);
  }));

  app.get('/api/github/repos/:owner/:repo/contents/*', route(async (req, res) => {
    const session = await requireRepository(req, res);
    if (!session) return;
    if (!validateBranch(req.query.ref)) return res.status(400).json({ error: 'Invalid branch' });
    try {
      const filePath = encodeGitHubContentPath(req.params[0]);
      const ref = new URLSearchParams({ ref: String(req.query.ref || 'main') });
      return send(await api(session, `/repos/${req.params.owner}/${req.params.repo}/contents/${filePath}?${ref}`), res);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }));

  for (const [method, deleting] of [['put', false], ['delete', true]]) {
    app[method]('/api/github/repos/:owner/:repo/contents/*', route(async (req, res) => {
      const session = await requireRepository(req, res);
      if (!session) return;
      try {
        const filePath = encodeGitHubContentPath(req.params[0]);
        const payload = cleanMutation(req.body, deleting);
        return send(await api(session, `/repos/${req.params.owner}/${req.params.repo}/contents/${filePath}`, {
          method: method.toUpperCase(), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        }), res);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }));
  }

  app.post('/api/github/repos/:owner/:repo/batch', route(async (req, res) => {
    const session = await requireRepository(req, res);
    if (!session) return;
    const body = req.body || {};
    if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 200
      || !validateBranch(body.branch) || !Array.isArray(body.changes) || !body.changes.length || body.changes.length > 500) {
      return res.status(400).json({ error: 'Invalid batch publish request' });
    }
    try {
      const branch = body.branch || 'main';
      const changes = body.changes.map(change => {
        if (!change || typeof change.path !== 'string' || !validBase64(change.content)) throw new Error('Batch files must contain base64 content');
        return { path: encodeGitHubContentPath(change.path), mode: '100644', type: 'blob', content: change.content };
      });
      const prefix = `/repos/${req.params.owner}/${req.params.repo}`;
      const refResponse = await api(session, `${prefix}/git/ref/heads/${encodeURIComponent(branch)}`);
      if (!refResponse.ok) return send(refResponse, res);
      const ref = await refResponse.json();
      const commitResponse = await api(session, `${prefix}/git/commits/${encodeURIComponent(ref.object.sha)}`);
      if (!commitResponse.ok) return send(commitResponse, res);
      const baseCommit = await commitResponse.json();
      const treeEntries = [];
      for (const change of changes) {
        const blobResponse = await api(session, `${prefix}/git/blobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: change.content, encoding: 'base64' }) });
        if (!blobResponse.ok) return send(blobResponse, res);
        const blob = await blobResponse.json();
        treeEntries.push({ path: change.path, mode: change.mode, type: change.type, sha: blob.sha });
      }
      const treeResponse = await api(session, `${prefix}/git/trees`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }) });
      if (!treeResponse.ok) return send(treeResponse, res);
      const tree = await treeResponse.json();
      const newCommitResponse = await api(session, `${prefix}/git/commits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: body.message.trim(), tree: tree.sha, parents: [ref.object.sha] }) });
      if (!newCommitResponse.ok) return send(newCommitResponse, res);
      const newCommit = await newCommitResponse.json();
      if (body.review === true) {
        const reviewBranch = `ghp-review/${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const createRefResponse = await api(session, `${prefix}/git/refs`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ref: `refs/heads/${reviewBranch}`, sha: newCommit.sha })
        });
        if (!createRefResponse.ok) return send(createRefResponse, res);
        const pullResponse = await api(session, `${prefix}/pulls`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: body.message.trim(), head: reviewBranch, base: branch, body: 'Created with GitHub Pages Web Editor for review before publishing.' })
        });
        if (!pullResponse.ok) return send(pullResponse, res);
        return res.status(201).json({ status: 'review_created', sha: newCommit.sha, branch: reviewBranch, pullRequest: await pullResponse.json() });
      }
      const updateResponse = await api(session, `${prefix}/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sha: newCommit.sha, force: false }) });
      return send(updateResponse, res);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }));

  app.get('/api/github/repos/:owner/:repo/commits', route(async (req, res) => {
    const session = await requireRepository(req, res);
    if (!session) return;
    const perPage = Math.min(100, Math.max(1, Number.parseInt(req.query.per_page, 10) || 20));
    const query = new URLSearchParams({ per_page: String(perPage) });
    try {
      if (req.query.path) query.set('path', normalizeRepoPath(String(req.query.path)));
      if (req.query.sha) {
        if (!validateBranch(req.query.sha)) throw new Error('Invalid revision');
        query.set('sha', String(req.query.sha));
      }
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    return send(await api(session, `/repos/${req.params.owner}/${req.params.repo}/commits?${query}`), res);
  }));
}

module.exports = { cleanMutation, parseCookies, registerGitHubRoutes };
