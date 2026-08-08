const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createApp } = require('../server');

async function withServer(t, setup = {}) {
  const server = createApp(setup).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('health and clone request validation are deterministic', async t => {
  const baseUrl = await withServer(t, {
    clonesDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ghp-api-test-')),
    allowedHosts: new Set(['github.com'])
  });
  const health = await fetch(`${baseUrl}/api/health`);
  assert.deepEqual(await health.json(), { status: 'ok' });
  const healthAlias = await fetch(`${baseUrl}/health`);
  assert.deepEqual(await healthAlias.json(), { status: 'ok' });
  const runtime = await fetch(`${baseUrl}/api/runtime`);
  assert.deepEqual(await runtime.json(), { localOnly: false });
  const blocked = await fetch(`${baseUrl}/api/clone`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'http://127.0.0.1/internal/repo.git' })
  });
  assert.equal(blocked.status, 400);
});

test('clone file API saves, reads, reports, and deletes without following symlinks', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghp-api-clone-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>before</h1>');
  fs.symlinkSync('/etc/hosts', path.join(root, 'escape'));
  const registry = new Map([['fixture', { id: 'fixture', dir: root }]]);
  const baseUrl = await withServer(t, { cloneRegistry: registry });

  const blocked = await fetch(`${baseUrl}/api/clone/fixture/file?path=escape`);
  assert.equal(blocked.status, 400);

  const saved = await fetch(`${baseUrl}/api/clone/fixture/file`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'index.html', content: '<h1>after</h1>' })
  });
  assert.equal(saved.status, 200);
  assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), '<h1>after</h1>');

  const read = await fetch(`${baseUrl}/api/clone/fixture/file?path=index.html`);
  assert.equal((await read.json()).content, '<h1>after</h1>');

  const encoded = await fetch(`${baseUrl}/api/clone/fixture/file?path=index.html&encoding=base64`);
  const encodedBody = await encoded.json();
  assert.equal(encodedBody.encoding, 'base64');
  assert.equal(Buffer.from(encodedBody.content, 'base64').toString('utf8'), '<h1>after</h1>');

  const deleted = await fetch(`${baseUrl}/api/clone/fixture/file?path=index.html`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.equal(fs.existsSync(path.join(root, 'index.html')), false);

  fs.mkdirSync(path.join(root, 'empty'));
  const deletedDirectory = await fetch(`${baseUrl}/api/clone/fixture/directory?path=empty`, { method: 'DELETE' });
  assert.equal(deletedDirectory.status, 200);
  assert.equal(fs.existsSync(path.join(root, 'empty')), false);
});

test('clone status and commit API persist a local Git commit', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghp-api-git-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: root });
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>before</h1>');
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'Initial'], { cwd: root });
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>after</h1>');
  const registry = new Map([['fixture', { id: 'fixture', dir: root }]]);
  const baseUrl = await withServer(t, { cloneRegistry: registry });

  const status = await fetch(`${baseUrl}/api/clone/fixture/status`);
  assert.equal((await status.json()).files[0].path, 'index.html');
  const commit = await fetch(`${baseUrl}/api/clone/fixture/commit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'Persist editor change', authorName: 'Editor User', authorEmail: 'editor@example.test' })
  });
  assert.equal(commit.status, 200);
  assert.match((await commit.json()).sha, /^[0-9a-f]{40}$/);
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '');
});
