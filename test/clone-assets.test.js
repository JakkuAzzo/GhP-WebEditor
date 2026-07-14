const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

test('clone file API returns binary-safe base64 assets', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghp-asset-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from([0, 255, 1, 254, 2]);
  fs.writeFileSync(path.join(root, 'asset.bin'), bytes);
  const app = createApp({ cloneRegistry: new Map([['fixture', { id: 'fixture', dir: root }]]) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/clone/fixture/file?path=asset.bin&encoding=base64`);
  const body = await response.json();
  assert.equal(body.encoding, 'base64');
  assert.deepEqual(Buffer.from(body.content, 'base64'), bytes);
});
