const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');

async function withServer(t) {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('preview API serves temporary HTML with an isolated document policy', async t => {
  const baseUrl = await withServer(t);
  const created = await fetch(`${baseUrl}/api/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ html: '<h1>Preview</h1><script>document.body.dataset.ready="yes"</script>' })
  });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  const preview = await fetch(`${baseUrl}/api/preview/${id}`);
  assert.match(preview.headers.get('content-type'), /^text\/html/);
  assert.match(preview.headers.get('content-security-policy'), /script-src 'unsafe-inline'/);
  assert.match(preview.headers.get('content-security-policy'), /form-action 'none'/);
  assert.match(await preview.text(), /dataset\.ready/);

  const missing = await fetch(`${baseUrl}/api/preview/not-a-preview`);
  assert.equal(missing.status, 404);
});
