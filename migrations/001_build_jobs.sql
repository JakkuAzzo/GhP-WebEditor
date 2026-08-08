-- Buildy hosted build queue. Apply with a migration runner before enabling jobs.
CREATE TABLE IF NOT EXISTS build_jobs (
  id uuid PRIMARY KEY,
  project_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('source', 'artifact')),
  idempotency_key text,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'expired')),
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  artifact jsonb,
  UNIQUE (project_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS build_jobs_queue_idx ON build_jobs (status, created_at);
