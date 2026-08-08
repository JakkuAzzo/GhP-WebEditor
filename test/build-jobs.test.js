const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryJobStore, transitionJob } = require('../lib/build-jobs');
const { mapRow } = require('../lib/postgres-job-store');

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
});

test('jobs API can queue, inspect, and cancel when explicitly enabled', async t => {
  const { createApp } = require('../server');
  const server = createApp({ jobsEnabled: true }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const created = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'demo', source: 'artifact' }) });
  assert.equal(created.status, 201);
  const job = await created.json();
  const cancelled = await fetch(`${base}/api/jobs/${job.id}/cancel`, { method: 'POST' });
  assert.equal((await cancelled.json()).status, 'cancelled');
});
