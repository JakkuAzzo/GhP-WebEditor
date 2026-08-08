const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
process.env.AUTH_REQUIRED = 'false';
const app = require('./server');
const { PLANS } = require('./plans');

function get(server, route) {
  return new Promise((resolve, reject) => {
    const request = http.get({ port: server.address().port, path: route }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body, headers: response.headers }));
    });
    request.on('error', reject);
  });
}

(async () => {
  for (const asset of [
    'public/assets/buildy-icon-v5.png',
    'public/assets/buildy-wordmark-v3-dark.png',
    'public/assets/demos/portfolio/max-udovichenko.png'
  ]) assert.ok(fs.existsSync(path.join(__dirname, asset)), `Missing release asset: ${asset}`);
  assert.equal(PLANS.find(plan => plan.slug === 'project-pass').oneTimePriceGbp, 5);
  assert.equal(PLANS.find(plan => plan.slug === 'client-studio').monthlyPriceGbp, 35);
  const server = app.listen(0);
  try {
    const health = await get(server, '/health');
    assert.equal(health.status, 200);
    assert.equal(JSON.parse(health.body).status, 'ok');
    assert.equal(JSON.parse(health.body).config.publicMode, false);
    const pricing = await get(server, '/pricing');
    assert.equal(pricing.status, 200);
    assert.match(pricing.body, /Project Pass/);
    const landing = await get(server, '/');
    assert.equal(landing.status, 200);
    assert.match(landing.body, /Buildy by BStudioB/);
    assert.match(landing.headers['content-security-policy'], /formsubmit\.co/);
    assert.match(landing.body, /name="consent"/);
    assert.match(landing.body, /name="_next"/);
    const apiPlans = await get(server, '/api/plans');
    assert.equal(apiPlans.status, 200);
    const thanks = await get(server, '/thanks');
    assert.equal(thanks.status, 200);
    const marketplace = await get(server, '/marketplace');
    assert.equal(marketplace.status, 301);
    assert.equal(marketplace.body, 'Moved Permanently. Redirecting to /');
    const css = await get(server, '/buildy-public.css');
    assert.equal(css.status, 200);
  } finally { server.close(); }
  console.log('Buildy tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
