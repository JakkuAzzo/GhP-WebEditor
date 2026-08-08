const crypto = require('crypto');

// Supabase is optional during local development. Paid access is never granted when it is absent.
const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function configured() { return Boolean(baseUrl && serviceKey); }
function headers() {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
}
async function request(table, options = {}) {
  if (!configured()) throw new Error('Billing store is not configured');
  const response = await fetch(`${baseUrl}/rest/v1/${table}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Billing store request failed (${response.status})`);
  return response.status === 204 ? null : response.json();
}
async function recordWebhook({ deliveryId, eventName, payload }) {
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const rows = await request('webhook_events', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ delivery_id: deliveryId, event_name: eventName, payload_hash: payloadHash, processing_status: 'received' })
  });
  return rows;
}
async function recordStripeEvent({ eventId, eventName, payload }) {
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return request('stripe_events', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ event_id: eventId, event_name: eventName, payload_hash: payloadHash, processing_status: 'received' })
  });
}
async function upsertEntitlement(entitlement) {
  return request('entitlements', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(entitlement)
  });
}
async function upsertSubscription(subscription) {
  return request('subscriptions', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(subscription)
  });
}
async function subscriptionForAccount(githubAccountId) {
  const rows = await request(`subscriptions?github_account_id=eq.${encodeURIComponent(githubAccountId)}&state=not.eq.cancelled&order=updated_at.desc&limit=1`, { method: 'GET' });
  return rows && rows[0] ? rows[0] : null;
}
async function entitlementsForAccount(githubAccountId) {
  const rows = await request(`entitlements?account_ref=eq.${encodeURIComponent(githubAccountId)}&state=eq.active&order=updated_at.desc`, { method: 'GET' });
  return rows || [];
}
module.exports = { configured, recordWebhook, recordStripeEvent, upsertSubscription, upsertEntitlement, subscriptionForAccount, entitlementsForAccount };
