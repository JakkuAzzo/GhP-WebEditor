const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  assertExistingFile,
  listFilesRecursive,
  normalizeRepoPath,
  resolveWritableDirectory,
  resolveWritableFile,
  validateBranch,
  validateCloneUrl
} = require('../lib/clone-workspace');

test('clone URLs are restricted to HTTPS and explicitly allowed public hosts', () => {
  const hosts = new Set(['github.com']);
  assert.equal(validateCloneUrl('https://github.com/octocat/Hello-World.git', hosts), true);
  assert.equal(validateCloneUrl('http://github.com/octocat/Hello-World.git', hosts), false);
  assert.equal(validateCloneUrl('https://127.0.0.1/private/repo.git', hosts), false);
  assert.equal(validateCloneUrl('https://user:pass@github.com/org/repo.git', hosts), false);
  assert.equal(validateCloneUrl('git@github.com:org/repo.git', hosts), false);
});

test('branch and repository paths reject option and traversal forms', () => {
  assert.equal(validateBranch('feature/editor-v2'), true);
  assert.equal(validateBranch('--upload-pack=evil'), false);
  assert.equal(validateBranch('../main'), false);
  assert.equal(normalizeRepoPath('src/index.js'), 'src/index.js');
  for (const value of ['../secret', '/etc/passwd', '.git/config', 'src/../../secret', '-option']) {
    assert.throws(() => normalizeRepoPath(value));
  }
});

test('file helpers reject symlinks that escape a clone', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghp-path-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'safe.txt'), 'safe');
  fs.symlinkSync('/etc/hosts', path.join(root, 'escape'));
  assert.equal(assertExistingFile(root, 'safe.txt').stat.isFile(), true);
  assert.throws(() => assertExistingFile(root, 'escape'), /Symbolic links/);
  assert.throws(() => resolveWritableFile(root, 'escape'), /Symbolic links/);
  assert.equal(resolveWritableDirectory(root, 'new-dir').fullPath, path.join(root, 'new-dir'));
  assert.deepEqual(listFilesRecursive(root).map(item => item.path), ['safe.txt']);
});
