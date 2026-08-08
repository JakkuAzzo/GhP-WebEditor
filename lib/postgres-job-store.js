/**
 * Purpose: Postgres persistence contract for Buildy build jobs.
 * Dependencies: a node-postgres-compatible pool injected by the caller.
 * Constraints: SQL is parameterised; migrations/001_build_jobs.sql must be applied.
 */
const { createJob, normaliseInput, transitionJob } = require('./build-jobs');

function mapRow(row) {
  if (!row) return null;
  return { id: row.id, projectId: row.project_id, source: row.source, idempotencyKey: row.idempotency_key,
    status: row.status, attempts: row.attempts, createdAt: new Date(row.created_at).getTime(), updatedAt: new Date(row.updated_at).getTime(),
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null, finishedAt: row.finished_at ? new Date(row.finished_at).getTime() : null,
    error: row.error, artifact: row.artifact };
}

function createPostgresJobStore(pool) {
  if (!pool || typeof pool.query !== 'function') throw new TypeError('A Postgres pool is required');
  return {
    async create(input) {
      const data = normaliseInput(input); const job = createJob(data);
      const result = await pool.query(`INSERT INTO build_jobs (id, project_id, source, idempotency_key, status, attempts, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'queued', 0, to_timestamp($5 / 1000.0), to_timestamp($5 / 1000.0))
        ON CONFLICT (project_id, idempotency_key) DO UPDATE SET updated_at = build_jobs.updated_at RETURNING *`,
      [job.id, data.projectId, data.source, data.idempotencyKey, job.createdAt]);
      return mapRow(result.rows[0]);
    },
    async get(id) { const result = await pool.query('SELECT * FROM build_jobs WHERE id = $1', [id]); return mapRow(result.rows[0]); },
    async update(id, status, details = {}) {
      const current = await this.get(id); if (!current) return null; const next = transitionJob(current, status, details);
      const result = await pool.query(`UPDATE build_jobs SET status=$2, attempts=$3, updated_at=to_timestamp($4 / 1000.0), started_at=$5, finished_at=$6, error=$7, artifact=$8 WHERE id=$1 RETURNING *`,
        [id, next.status, next.attempts, next.updatedAt, next.startedAt ? new Date(next.startedAt) : null, next.finishedAt ? new Date(next.finishedAt) : null, next.error, next.artifact ? JSON.stringify(next.artifact) : null]);
      return mapRow(result.rows[0]);
    },
    async list({ projectId, limit = 50 } = {}) { const result = await pool.query(`SELECT * FROM build_jobs ${projectId ? 'WHERE project_id=$1' : ''} ORDER BY created_at DESC LIMIT $${projectId ? 2 : 1}`, projectId ? [projectId, Math.min(Number(limit) || 50, 100)] : [Math.min(Number(limit) || 50, 100)]); return result.rows.map(mapRow); },
    async claimNext() { const result = await pool.query(`UPDATE build_jobs SET status='running', attempts=attempts+1, started_at=COALESCE(started_at, now()), updated_at=now() WHERE id=(SELECT id FROM build_jobs WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`); return mapRow(result.rows[0]); }
  };
}
module.exports = { createPostgresJobStore, mapRow };
