const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryJobStore, transitionJob } = require('../lib/build-jobs');
const { mapRow } = require('../lib/postgres-job-store');
const { loadConfig } = require('../lib/config');
const { expiryFor, isExpired } = require('../lib/artifact-retention');
const { hasAccess, requireAccess } = require('../lib/entitlements');
const { verifyGitHubSignature, verifyStripeSignature } = require('../lib/webhook-signatures');

test('webhook signatures verify raw payloads and reject stale Stripe events', () => {
  const crypto = require('node:crypto'); const raw = '{"id":"evt"}'; const secret = 'secret';
  const github = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
  assert.equal(verifyGitHubSignature(raw, github, secret), true);
  const timestamp = 1_700_000_000; const stripe = crypto.createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  assert.equal(verifyStripeSignature(raw, `t=${timestamp},v1=${stripe}`, secret, 300, timestamp), true);
  assert.equal(verifyStripeSignature(raw, `t=${timestamp - 1000},v1=${stripe}`, secret, 300, timestamp), false);
});

test('entitlements fail closed and honour expiry', () => {
  const entitlement = { accountId: 'acct', provider: 'stripe', plan: 'project-pass', status: 'active', currentPeriodEnd: 2_000 };
  assert.equal(hasAccess(entitlement, 1_999), true);
  assert.equal(hasAccess(entitlement, 2_000), false);
  assert.throws(() => requireAccess({ ...entitlement, status: 'cancelled' }), /active Buildy entitlement/);
});

test('artifact retention is bounded and deterministic', () => {
  const created = 1_000_000;
  assert.equal(expiryFor(created, 60_000), 1_060_000);
  assert.equal(isExpired(created, 1_060_000, 60_000), true);
  assert.throws(() => expiryFor(created, 30_000), /outside allowed bounds/);
});

test('production configuration prefers Buildy-owned variable names', () => {
  const config = loadConfig({ NODE_ENV: 'production', BUILDY_GITHUB_CLIENT_ID: 'new', GITHUB_APP_CLIENT_ID: 'old', BUILDY_PUBLIC_MODE: 'true' });
  assert.equal(config.publicMode, true);
  assert.equal(config.github.clientId, 'new');
});

test('Postgres rows map to the public job shape', () => {
  const job = mapRow({ id: 'j1', project_id: 'demo', source: 'artifact', idempotency_key: 'k', status: 'queued', attempts: 0,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:01.000Z', started_at: null, finished_at: null, error: null, artifact: null });
  assert.deepEqual(job, { id: 'j1', projectId: 'demo', source: 'artifact', idempotencyKey: 'k', status: 'queued', attempts: 0,
    createdAt: 1767225600000, updatedAt: 1767225601000, startedAt: null, finishedAt: null, error: null, artifact: null });
});

test('job store is idempotent and enforces terminal transitions', () => {
  const store = createMemoryJobStore();
  const first = store.create({ projectId: 'demo', source: 'source', idempotencyKey: 'save-1' });
  assert.equal(store.create({ projectId: 'demo', source: 'source', idempotencyKey: 'save-1' }).id, first.id);
  const running = store.update(first.id, 'running');
  assert.equal(running.attempts, 1);
  const done = store.update(first.id, 'succeeded', { artifact: { path: 'dist.zip', size: 12 } });
  assert.equal(done.status, 'succeeded');
  assert.throws(() => transitionJob(done, 'running'), /Cannot transition/);
  const retryable = store.create({ projectId: 'demo-retry', source: 'source' });
  store.update(retryable.id, 'running'); store.update(retryable.id, 'failed', { error: 'worker' });
  assert.equal(store.retry(retryable.id).status, 'queued');
});

test('jobs API can queue, inspect, and cancel when explicitly enabled', async t => {
  const { createApp } = require('../server');
  const server = createApp({ jobsEnabled: true, jobApiToken: 'test-token' }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const unauthorized = await fetch(`${base}/api/jobs`);
  assert.equal(unauthorized.status, 401);
  const created = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' }, body: JSON.stringify({ projectId: 'demo', source: 'artifact' }) });
  assert.equal(created.status, 201);
  const job = await created.json();
  const cancelled = await fetch(`${base}/api/jobs/${job.id}/cancel`, { method: 'POST', headers: { authorization: 'Bearer test-token' } });
  assert.equal((await cancelled.json()).status, 'cancelled');
  const artifact = await fetch(`${base}/api/jobs/${job.id}/artifact`, { headers: { authorization: 'Bearer test-token' } });
  assert.equal(artifact.status, 409);
});
