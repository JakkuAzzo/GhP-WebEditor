/**
 * Purpose: verify GitHub and Stripe webhook authenticity before parsing events.
 * Constraints: compare raw request bytes, use constant-time equality, and reject
 * malformed signatures; callers must not verify parsed/re-serialized JSON.
 */
const crypto = require('crypto');
function safeEqual(left, right) {
  const a = Buffer.from(String(left || '')); const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function verifyGitHubSignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return safeEqual(expected, signature);
}
function verifyStripeSignature(rawBody, header, secret, toleranceSeconds = 300, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!rawBody || !header || !secret) return false;
  const parts = Object.fromEntries(String(header).split(',').map(part => part.split('=').map(value => value.trim())).filter(pair => pair.length === 2));
  const timestamp = Number(parts.t); if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return safeEqual(expected, parts.v1);
}
module.exports = { verifyGitHubSignature, verifyStripeSignature };
