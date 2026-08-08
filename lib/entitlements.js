/**
 * Purpose: canonical server-side decision rules for paid Buildy access.
 * Constraints: webhook handlers must persist normalized records before calling
 * this module; unknown providers and plans fail closed.
 */
const PROVIDERS = new Set(['stripe', 'github_marketplace']);
function hasAccess(entitlement, now = Date.now()) {
  if (!entitlement || !PROVIDERS.has(entitlement.provider) || entitlement.status !== 'active') return false;
  if (!entitlement.accountId || !entitlement.plan) return false;
  if (entitlement.currentPeriodEnd == null) return true;
  const expiry = entitlement.currentPeriodEnd instanceof Date ? entitlement.currentPeriodEnd.getTime() : Number(entitlement.currentPeriodEnd);
  return Number.isFinite(expiry) && expiry > now;
}
function requireAccess(entitlement, now = Date.now()) { if (!hasAccess(entitlement, now)) throw new Error('An active Buildy entitlement is required'); return entitlement; }
module.exports = { hasAccess, requireAccess, PROVIDERS };
