const fs = require('fs');
const path = require('path');

const DEFAULT_ALLOWED_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org'];

function parseAllowedHosts(value = process.env.CLONE_ALLOWED_HOSTS) {
  return new Set((value ? value.split(',') : DEFAULT_ALLOWED_HOSTS).map(host => host.trim().toLowerCase()).filter(Boolean));
}

function validateCloneUrl(value, allowedHosts = parseAllowedHosts()) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    if (!allowedHosts.has(url.hostname.toLowerCase())) return false;
    return url.pathname.split('/').filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

function validateBranch(branch) {
  if (branch == null || branch === '') return true;
  return typeof branch === 'string'
    && branch.length <= 255
    && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch)
    && !branch.includes('..')
    && !branch.includes('//')
    && !branch.includes('@{')
    && !branch.endsWith('/')
    && !branch.endsWith('.lock');
}

function normalizeRepoPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\0') || value.includes('\\')) {
    throw new Error('Invalid path');
  }
  if (path.posix.isAbsolute(value) || /^[A-Za-z]:/.test(value)) throw new Error('Invalid path');
  const normalized = path.posix.normalize(value);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) throw new Error('Invalid path');
  if (normalized === '.git' || normalized.startsWith('.git/')) throw new Error('Forbidden path');
  if (normalized.split('/').some(segment => segment.startsWith('-'))) throw new Error('Invalid path');
  return normalized;
}

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function resolveCandidate(root, relativePath) {
  const normalized = normalizeRepoPath(relativePath);
  const candidate = path.resolve(root, ...normalized.split('/'));
  if (!isWithin(path.resolve(root), candidate)) throw new Error('Invalid path');
  return { normalized, candidate };
}

function assertExistingFile(root, relativePath) {
  const { normalized, candidate } = resolveCandidate(root, relativePath);
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink()) throw new Error('Symbolic links are not supported');
  if (!stat.isFile()) throw new Error('Path is not a file');
  const realRoot = fs.realpathSync(root);
  const realFile = fs.realpathSync(candidate);
  if (!isWithin(realRoot, realFile)) throw new Error('Invalid path');
  return { normalized, fullPath: realFile, stat };
}

function assertExistingDirectory(root, relativePath) {
  const { normalized, candidate } = resolveCandidate(root, relativePath);
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink()) throw new Error('Symbolic links are not supported');
  if (!stat.isDirectory()) throw new Error('Path is not a directory');
  const realRoot = fs.realpathSync(root);
  const realDirectory = fs.realpathSync(candidate);
  if (!isWithin(realRoot, realDirectory)) throw new Error('Invalid path');
  return { normalized, fullPath: realDirectory, stat };
}

function resolveWritableFile(root, relativePath) {
  const { normalized, candidate } = resolveCandidate(root, relativePath);
  const parent = path.dirname(candidate);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error('Invalid parent directory');
  const realRoot = fs.realpathSync(root);
  const realParent = fs.realpathSync(parent);
  if (realParent !== realRoot && !isWithin(realRoot, realParent)) throw new Error('Invalid parent directory');
  if (fs.existsSync(candidate) && fs.lstatSync(candidate).isSymbolicLink()) {
    throw new Error('Symbolic links are not supported');
  }
  return { normalized, fullPath: candidate };
}

function resolveWritableDirectory(root, relativePath) {
  const { normalized, candidate } = resolveCandidate(root, relativePath);
  const parent = path.dirname(candidate);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error('Invalid parent directory');
  const realRoot = fs.realpathSync(root);
  const realParent = fs.realpathSync(parent);
  if (realParent !== realRoot && !isWithin(realRoot, realParent)) throw new Error('Invalid parent directory');
  if (fs.existsSync(candidate)) throw new Error('Path already exists');
  return { normalized, fullPath: candidate };
}

function listFilesRecursive(baseDir, maxEntries = 10_000) {
  const results = [];
  function walk(current, rel = '') {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.isSymbolicLink()) continue;
      if (results.length >= maxEntries) throw new Error('Repository contains too many entries');
      const full = path.join(current, entry.name);
      const relPath = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) {
        results.push({ path: relPath, type: 'dir' });
        walk(full, relPath);
      } else if (entry.isFile()) {
        results.push({ path: relPath, type: 'file', size: fs.statSync(full).size });
      }
    }
  }
  walk(baseDir);
  return results;
}

module.exports = {
  assertExistingDirectory,
  assertExistingFile,
  listFilesRecursive,
  normalizeRepoPath,
  parseAllowedHosts,
  resolveWritableFile,
  resolveWritableDirectory,
  validateBranch,
  validateCloneUrl
};
