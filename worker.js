/**
 * Buildy worker entrypoint. The web process never executes hosted builds directly.
 * Set BUILDY_WORKER_MODULE to a module exporting { store, execute(job) } before use.
 */
const path = require('path');
const intervalMs = Math.max(250, Number(process.env.BUILDY_WORKER_POLL_MS) || 2000);
const modulePath = process.env.BUILDY_WORKER_MODULE;
if (!modulePath) {
  console.error('BUILDY_WORKER_MODULE is required; refusing to run without an isolated executor');
  process.exitCode = 1;
} else {
  const runtime = require(path.resolve(modulePath));
  if (!runtime.store?.claimNext || typeof runtime.execute !== 'function') throw new Error('Worker module must export store.claimNext and execute(job)');
  let stopping = false;
  process.on('SIGTERM', () => { stopping = true; }); process.on('SIGINT', () => { stopping = true; });
  (async function loop() {
    while (!stopping) {
      const job = await runtime.store.claimNext();
      if (!job) { await new Promise(resolve => setTimeout(resolve, intervalMs)); continue; }
      try { const artifact = await runtime.execute(job); await runtime.store.update(job.id, 'succeeded', { artifact }); }
      catch (error) { await runtime.store.update(job.id, 'failed', { error: error.message }); }
    }
  }()).catch(error => { console.error('Buildy worker stopped:', error); process.exitCode = 1; });
}
