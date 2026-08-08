/**
 * Purpose: run an explicitly allowlisted project build in a disposable workspace.
 * Constraints: local/staging only until hosted execution has a container/VM boundary,
 * quotas, and a separate worker. Dependencies are never installed by this helper.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const MAX_LOG = 200_000;
const ALLOWED = new Set(['npm run build', 'pnpm build', 'yarn build']);
function assertSafeWorkspace(root) { const resolved = path.resolve(root); if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) throw new Error('Workspace does not exist'); return resolved; }
function runProjectBuild({ workspace, command = 'npm run build', timeoutMs = 120_000 } = {}) {
  const cwd = assertSafeWorkspace(workspace); if (!ALLOWED.has(command)) return Promise.reject(new Error('Build command is not allowlisted'));
  const [bin, ...args] = command.split(' ');
  return new Promise((resolve, reject) => { const child = spawn(bin, args, { cwd, env: { ...process.env, CI: 'true' }, shell: false }); let output = ''; const append = chunk => { output = (output + chunk.toString()).slice(-MAX_LOG); }; child.stdout.on('data', append); child.stderr.on('data', append); const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Build timed out')); }, timeoutMs); child.on('error', error => { clearTimeout(timer); reject(error); }); child.on('close', code => { clearTimeout(timer); resolve({ ok: code === 0, exitCode: code, output }); }); });
}
module.exports = { ALLOWED_BUILD_COMMANDS: ALLOWED, runProjectBuild };
