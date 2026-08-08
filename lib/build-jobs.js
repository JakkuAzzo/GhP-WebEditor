/**
 * Purpose: define the small, durable-friendly state machine used by hosted builds.
 * Responsibilities: validate input, create idempotent records, and enforce legal transitions.
 * Constraints: this module owns state, not execution; workers must use these statuses.
 */
const crypto = require('crypto');
const STATUSES = Object.freeze(['queued', 'running', 'succeeded', 'failed', 'cancelled', 'expired']);
const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'expired']);
const TRANSITIONS = Object.freeze({
  queued: new Set(['running', 'cancelled', 'expired']), running: new Set(['succeeded', 'failed', 'cancelled', 'expired']),
  failed: new Set(['queued']),
  succeeded: new Set(), cancelled: new Set(), expired: new Set()
});
function normaliseInput(input = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('Job input must be an object');
  const projectId = String(input.projectId || '').trim();
  const source = String(input.source || '');
  const idempotencyKey = input.idempotencyKey == null ? null : String(input.idempotencyKey).trim();
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(projectId)) throw new TypeError('projectId is invalid');
  if (!['source', 'artifact'].includes(source)) throw new TypeError('source must be source or artifact');
  if (idempotencyKey !== null && !/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey)) throw new TypeError('idempotencyKey is invalid');
  return { projectId, source, idempotencyKey };
}
function createJob(input, now = Date.now()) {
  return { id: crypto.randomUUID(), ...normaliseInput(input), status: 'queued', attempts: 0, createdAt: now, updatedAt: now, startedAt: null, finishedAt: null, error: null, artifact: null };
}
function transitionJob(job, status, details = {}, now = Date.now()) {
  if (!job || !STATUSES.includes(status) || !TRANSITIONS[job.status].has(status)) throw new Error(`Cannot transition ${job?.status || 'unknown'} to ${status}`);
  const next = { ...job, status, updatedAt: now };
  if (status === 'running') { next.attempts = Number(job.attempts || 0) + 1; next.startedAt = job.startedAt || now; }
  if (TERMINAL.has(status)) next.finishedAt = now;
  if (details.error) next.error = String(details.error).slice(0, 1000);
  if (details.artifact) next.artifact = details.artifact;
  return next;
}
function createMemoryJobStore() {
  const jobs = new Map(); const keys = new Map();
  return {
    create(input) { const data = normaliseInput(input); const key = data.idempotencyKey ? `${data.projectId}:${data.idempotencyKey}` : null; if (key && keys.has(key)) return jobs.get(keys.get(key)); const job = createJob(data); jobs.set(job.id, job); if (key) keys.set(key, job.id); return job; },
    get(id) { return jobs.get(id) || null; },
    update(id, status, details) { const current = jobs.get(id); if (!current) return null; const next = transitionJob(current, status, details); jobs.set(id, next); return next; },
    list({ projectId, limit = 50 } = {}) { return [...jobs.values()].filter(job => !projectId || job.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt).slice(0, Math.min(Number(limit) || 50, 100)); },
    retry(id) { const current = jobs.get(id); if (!current) return null; const next = transitionJob(current, 'queued', { error: null }); jobs.set(id, next); return next; }
  };
}
module.exports = { STATUSES, TERMINAL, normaliseInput, createJob, transitionJob, createMemoryJobStore };
