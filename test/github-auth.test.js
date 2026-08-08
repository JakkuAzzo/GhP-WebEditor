const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { cleanMutation } = require('../lib/github-app');

async function startServer(t, githubFetch) {
  const server = createApp({
    githubConfig: { clientId: 'client-id', clientSecret: 'client-secret', slug: 'fixture-editor' },
    githubFetch
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

function cookieValue(setCookie, name) {
  return setCookie.split(',').map(value => value.trim()).find(value => value.startsWith(`${name}=`)).split(';')[0];
}

test('GitHub App login limits proxy access to repositories selected during installation', async t => {
  const calls = [];
  const githubFetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === 'https://github.com/login/oauth/access_token') {
      return Response.json({ access_token: 'server-only-token' });
    }
    if (url.endsWith('/user')) return Response.json({ login: 'fixture-user', avatar_url: 'avatar' });
    if (url.includes('/user/installations?')) return Response.json({ installations: [{ id: 42 }] });
    if (url.includes('/user/installations/42/repositories')) {
      return Response.json({ repositories: [{ full_name: 'fixture/site', default_branch: 'main' }] });
    }
    if (url.endsWith('/repos/fixture/site/pages/builds/latest')) {
      return Response.json({ status: 'built', commit: 'deployed-sha', error: { message: null }, updated_at: '2026-07-14T12:00:00Z' });
    }
    if (url.endsWith('/repos/fixture/site/pages')) {
      return Response.json({ html_url: 'https://fixture.github.io/site/', build_type: 'legacy', source: { branch: 'main', path: '/' } });
    }
    if (url.endsWith('/repos/fixture/site')) return Response.json({ default_branch: 'main' });
    return Response.json({ message: 'unexpected' }, { status: 404 });
  };
  const baseUrl = await startServer(t, githubFetch);

  const start = await fetch(`${baseUrl}/api/auth/github/start`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const authorize = new URL(start.headers.get('location'));
  assert.equal(authorize.hostname, 'github.com');
  assert.equal(authorize.searchParams.get('redirect_uri'), `${baseUrl}/api/auth/github/callback`);
  const approvedCallbackPath = await fetch(`${baseUrl}/auth/github/callback?code=invalid&state=invalid`, { redirect: 'manual' });
  assert.equal(approvedCallbackPath.status, 400);
  const state = authorize.searchParams.get('state');
  const stateCookie = cookieValue(start.headers.get('set-cookie'), 'ghp_oauth_state');

  const callback = await fetch(`${baseUrl}/api/auth/github/callback?code=fixture-code&state=${state}`, {
    redirect: 'manual',
    headers: { cookie: stateCookie }
  });
  assert.equal(callback.status, 302);
  const sessionCookie = cookieValue(callback.headers.get('set-cookie'), 'ghp_session');

  const repositories = await fetch(`${baseUrl}/api/github/repositories`, { headers: { cookie: sessionCookie } });
  assert.deepEqual(await repositories.json(), [{ full_name: 'fixture/site', default_branch: 'main' }]);
  const allowed = await fetch(`${baseUrl}/api/github/repos/fixture/site`, { headers: { cookie: sessionCookie } });
  assert.equal(allowed.status, 200);
  const blocked = await fetch(`${baseUrl}/api/github/repos/fixture/other`, { headers: { cookie: sessionCookie } });
  assert.equal(blocked.status, 403);
  const invalidPath = await fetch(`${baseUrl}/api/github/repos/fixture/site/contents/-option`, { headers: { cookie: sessionCookie } });
  assert.equal(invalidPath.status, 400);
  const invalidMutation = await fetch(`${baseUrl}/api/github/repos/fixture/site/contents/index.html`, {
    method: 'PUT',
    headers: { cookie: sessionCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'Unsafe branch', content: 'dGVzdA==', branch: '../main' })
  });
  assert.equal(invalidMutation.status, 400);
  const pages = await fetch(`${baseUrl}/api/github/repos/fixture/site/pages/status`, { headers: { cookie: sessionCookie } });
  assert.deepEqual(await pages.json(), {
    configured: true,
    url: 'https://fixture.github.io/site/',
    buildType: 'legacy',
    source: { branch: 'main', path: '/' },
    build: { status: 'built', commit: 'deployed-sha', error: null, updatedAt: '2026-07-14T12:00:00Z' }
  });
  assert.equal(calls.some(call => call.url.endsWith('/repos/fixture/other')), false);
  assert.equal(calls.some(call => call.options.headers?.Authorization === 'Bearer server-only-token'), true);
});

test('GitHub mutations are allowlisted and reject malformed content, revisions, and branches', () => {
  assert.deepEqual(cleanMutation({
    message: ' Create page ',
    content: 'PGgxPkhlbGxvPC9oMT4=',
    branch: 'main',
    committer: { name: 'injected' }
  }), {
    message: 'Create page',
    content: 'PGgxPkhlbGxvPC9oMT4=',
    branch: 'main'
  });
  assert.throws(() => cleanMutation({ message: 'Bad', content: 'not base64!', branch: 'main' }), /base64/);
  assert.throws(() => cleanMutation({ message: 'Bad', content: '', branch: '../main' }), /Invalid GitHub/);
  assert.throws(() => cleanMutation({ message: 'Delete', branch: 'main' }, true), /revision/);
});

test('GitHub upstream failures return a generic error without leaking internal details', async t => {
  const githubSessions = new Map([['fixture-session', {
    accessToken: 'server-only-token',
    createdAt: Date.now(),
    repositoriesAt: Date.now(),
    repositories: [{ full_name: 'fixture/site' }],
    allowedRepositories: new Set(['fixture/site'])
  }]]);
  const server = createApp({
    githubConfig: { clientId: 'client-id', clientSecret: 'client-secret', slug: 'fixture-editor' },
    githubSessions,
    githubFetch: async () => { throw new Error('private upstream detail'); }
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/github/repos/fixture/site`, {
    headers: { cookie: 'ghp_session=fixture-session' }
  });
  assert.equal(response.status, 500);
  const body = await response.text();
  assert.equal(body, '{"error":"Internal server error"}');
  assert.doesNotMatch(body, /private upstream detail|server-only-token/);
});

test('batch publish creates blobs, one tree, one commit, and updates the branch', async t => {
  const calls = [];
  const githubSessions = new Map([['fixture-session', {
    accessToken: 'server-only-token', createdAt: Date.now(), repositoriesAt: Date.now(),
    repositories: [{ full_name: 'fixture/site' }], allowedRepositories: new Set(['fixture/site'])
  }]]);
  const githubFetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/git/ref/heads/main')) return Response.json({ object: { sha: 'head-sha' } });
    if (url.endsWith('/git/commits/head-sha')) return Response.json({ tree: { sha: 'base-tree' } });
    if (url.endsWith('/git/blobs')) return Response.json({ sha: 'blob-sha' });
    if (url.endsWith('/git/trees')) return Response.json({ sha: 'new-tree' });
    if (url.endsWith('/git/commits')) return Response.json({ sha: 'new-commit' });
    if (url.endsWith('/git/refs/heads/main')) return Response.json({ ref: 'refs/heads/main' });
    return Response.json({ message: 'unexpected' }, { status: 404 });
  };
  const server = createApp({ githubConfig: { clientId: 'client-id', clientSecret: 'client-secret', slug: 'fixture-editor' }, githubSessions, githubFetch }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/github/repos/fixture/site/batch`, {
    method: 'POST', headers: { cookie: 'ghp_session=fixture-session', 'content-type': 'application/json' },
    body: JSON.stringify({ branch: 'main', message: 'Publish archive', changes: [{ path: 'index.html', content: Buffer.from('<h1>ok</h1>').toString('base64') }] })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ref, 'refs/heads/main');
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 3);
  assert.equal(calls.at(-1).options.method, 'PATCH');
});

test('batch review creates a new branch and pull request instead of updating the base branch', async t => {
  const calls = [];
  const githubSessions = new Map([['fixture-session', {
    accessToken: 'server-only-token', createdAt: Date.now(), repositoriesAt: Date.now(),
    repositories: [{ full_name: 'fixture/site' }], allowedRepositories: new Set(['fixture/site'])
  }]]);
  const githubFetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/git/ref/heads/main')) return Response.json({ object: { sha: 'head-sha' } });
    if (url.endsWith('/git/commits/head-sha')) return Response.json({ tree: { sha: 'base-tree' } });
    if (url.endsWith('/git/blobs')) return Response.json({ sha: 'blob-sha' });
    if (url.endsWith('/git/trees')) return Response.json({ sha: 'new-tree' });
    if (url.endsWith('/git/commits')) return Response.json({ sha: 'new-commit' });
    if (url.endsWith('/git/refs')) return Response.json({ ref: 'refs/heads/ghp-review/test' }, { status: 201 });
    if (url.endsWith('/pulls')) return Response.json({ html_url: 'https://github.com/fixture/site/pull/1' }, { status: 201 });
    return Response.json({ message: 'unexpected' }, { status: 404 });
  };
  const server = createApp({ githubConfig: { clientId: 'client-id', clientSecret: 'client-secret', slug: 'fixture-editor' }, githubSessions, githubFetch }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/github/repos/fixture/site/batch`, {
    method: 'POST', headers: { cookie: 'ghp_session=fixture-session', 'content-type': 'application/json' },
    body: JSON.stringify({ branch: 'main', message: 'Review changes', review: true, changes: [{ path: 'index.html', content: Buffer.from('<h1>ok</h1>').toString('base64') }] })
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.pullRequest.html_url, 'https://github.com/fixture/site/pull/1');
  assert.equal(calls.some(call => call.url.endsWith('/git/refs/heads/main') && call.options.method === 'PATCH'), false);
  assert.equal(calls.some(call => call.url.endsWith('/pulls') && call.options.method === 'POST'), true);
});
