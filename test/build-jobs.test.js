const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryJobStore, transitionJob } = require('../lib/build-jobs');

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
