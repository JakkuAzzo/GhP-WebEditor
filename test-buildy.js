const assert = require('assert');
const http = require('http');
process.env.AUTH_REQUIRED = 'false';
const app = require('./server');
const { PLANS } = require('./plans');

function get(server, route) {
  return new Promise((resolve, reject) => {
    const request = http.get({ port: server.address().port, path: route }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
  });
}

(async () => {
  assert.equal(PLANS.find(plan => plan.slug === 'project-pass').oneTimePriceGbp, 5);
  assert.equal(PLANS.find(plan => plan.slug === 'client-studio').monthlyPriceGbp, 35);
  const server = app.listen(0);
  try {
    const health = await get(server, '/health');
    assert.equal(health.status, 200);
    assert.equal(JSON.parse(health.body).status, 'ok');
    const pricing = await get(server, '/pricing');
    assert.equal(pricing.status, 200);
    assert.match(pricing.body, /Project Pass/);
    const marketplace = await get(server, '/marketplace');
    assert.equal(marketplace.status, 200);
    assert.match(marketplace.body, /Buildy for GitHub Pages/);
    assert.match(marketplace.body, /support@bstudiob\.co\.uk/);
    const css = await get(server, '/buildy-public.css');
    assert.equal(css.status, 200);
  } finally { server.close(); }
  console.log('Buildy tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
