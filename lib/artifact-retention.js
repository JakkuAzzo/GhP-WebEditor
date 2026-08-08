/**
 * Purpose: keep generated Buildy artifacts bounded and disposable.
 * Constraints: metadata-only; deletion must use object storage and never source repositories.
 */
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;
function expiryFor(createdAt, retentionMs = DEFAULT_RETENTION_MS) {
  const created = Number(createdAt); const retention = Number(retentionMs);
  if (!Number.isFinite(created) || created <= 0) throw new TypeError('createdAt must be a timestamp');
  if (!Number.isFinite(retention) || retention < 60_000 || retention > 30 * 24 * 60 * 60 * 1000) throw new TypeError('retention is outside allowed bounds');
  return created + retention;
}
function isExpired(createdAt, now = Date.now(), retentionMs = DEFAULT_RETENTION_MS) { return now >= expiryFor(createdAt, retentionMs); }
module.exports = { DEFAULT_RETENTION_MS, expiryFor, isExpired };
