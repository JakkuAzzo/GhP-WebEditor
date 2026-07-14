const { test, expect } = require('@playwright/test');

async function editorContent(page) {
  return page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
}

test('runs under a project subpath and edits only token-authorized GitHub repositories', async ({ page }) => {
  const token = 'fixture-static-token';
  const githubCalls = [];
  let savedPayload;
  let createdPayload;
  let deletedPayload;

  await page.route('https://api.github.com/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    githubCalls.push({ pathname: url.pathname, authorization: request.headers().authorization });
    if (url.pathname === '/user') {
      return route.fulfill({ json: { login: 'static-user', avatar_url: 'https://example.test/avatar.png' } });
    }
    if (url.pathname === '/user/repos') {
      return route.fulfill({ json: [{ full_name: 'fixture/site', default_branch: 'main', permissions: { push: true } }] });
    }
    if (url.pathname === '/repos/fixture/site') return route.fulfill({ json: { default_branch: 'main' } });
    if (url.pathname === '/repos/fixture/site/git/trees/main') {
      return route.fulfill({ json: { truncated: false, tree: [
        { path: 'index.html', type: 'blob', sha: 'old-sha' },
        { path: 'docs', type: 'tree', sha: 'docs-sha' },
        { path: 'docs/about us.html', type: 'blob', sha: 'about-sha' }
      ] } });
    }
    if (url.pathname === '/repos/fixture/site/contents/index.html' && request.method() === 'GET') {
      return route.fulfill({ json: { encoding: 'base64', content: btoa('<h1>Static GitHub source</h1>') } });
    }
    if (url.pathname === '/repos/fixture/site/contents/index.html' && request.method() === 'PUT') {
      savedPayload = request.postDataJSON();
      return route.fulfill({ json: { content: { sha: 'new-sha' }, commit: { sha: 'saved-sha' } } });
    }
    if (url.pathname === '/repos/fixture/site/contents/docs/about%20us.html' && request.method() === 'GET') {
      return route.fulfill({ json: { encoding: 'base64', content: btoa('<h1>Encoded path</h1>') } });
    }
    if (url.pathname === '/repos/fixture/site/contents/new-page.html' && request.method() === 'PUT') {
      createdPayload = request.postDataJSON();
      return route.fulfill({ json: { content: { sha: 'created-sha' }, commit: { sha: 'created-commit' } } });
    }
    if (url.pathname === '/repos/fixture/site/contents/new-page.html' && request.method() === 'DELETE') {
      deletedPayload = request.postDataJSON();
      return route.fulfill({ json: { commit: { sha: 'deleted-commit' } } });
    }
    if (url.pathname === '/repos/fixture/site/pages/builds/latest') {
      return route.fulfill({ json: { status: 'built', commit: 'deployed-sha', updated_at: '2026-07-14T12:00:00Z' } });
    }
    if (url.pathname === '/repos/fixture/site/pages') {
      return route.fulfill({ json: { html_url: 'https://fixture.github.io/site/', build_type: 'legacy', source: { branch: 'main', path: '/' } } });
    }
    return route.fulfill({ status: 404, json: { message: `Unexpected ${request.method()} ${url.pathname}` } });
  });

  const sameOriginApiRequests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) sameOriginApiRequests.push(request.url());
  });

  await page.goto('./');
  await expect(page).toHaveTitle('GitHub Pages Web Editor');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-runtime', 'github-pages');
  await expect(page.locator('#openCloneModalBtn')).toBeDisabled();
  await page.click('#githubConnectBtn');
  await expect(page.locator('#staticGithubCredentials')).toBeVisible();
  await page.fill('#staticGithubToken', token);
  await page.click('#connectGithubSubmit');
  await expect(page.locator('#userName')).toHaveText('static-user');
  await expect(page.locator('#repoSelect option')).toContainText(['fixture/site']);

  await page.selectOption('#repoSelect', 'fixture/site');
  await expect(page.locator('#fileTree')).toContainText('index.html');
  await page.getByText('index.html', { exact: true }).click();
  await expect.poll(() => editorContent(page)).toBe('<h1>Static GitHub source</h1>');
  await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.setValue('<h1>Static published edit</h1>'));
  await page.click('#saveFileBtn');
  await expect(page.locator('#fileStatus')).toHaveText('Saved');

  expect(savedPayload).toMatchObject({ branch: 'main', sha: 'old-sha' });
  expect(Buffer.from(savedPayload.content, 'base64').toString('utf8')).toBe('<h1>Static published edit</h1>');

  await page.click('#newFileBtn');
  await page.fill('#newFileName', 'new-page.html');
  await page.selectOption('#fileTemplate', 'html');
  await page.click('#createFileSubmit');
  await page.click('#saveFileBtn');
  await expect(page.locator('#fileStatus')).toHaveText('Saved');
  expect(createdPayload.branch).toBe('main');
  expect(createdPayload.sha).toBeUndefined();
  page.once('dialog', dialog => dialog.accept());
  await page.click('#deleteFileBtn');
  await expect(page.locator('#fileTree')).not.toContainText('new-page.html');
  expect(deletedPayload).toEqual({ message: 'Delete new-page.html', sha: 'created-sha', branch: 'main' });

  await page.getByText('docs', { exact: true }).click();
  await page.getByText('about us.html', { exact: true }).click();
  await expect.poll(() => editorContent(page)).toBe('<h1>Encoded path</h1>');

  expect(githubCalls.every(call => call.authorization === `Bearer ${token}`)).toBe(true);
  expect(sameOriginApiRequests).toEqual([]);
  expect(await page.evaluate(secret => {
    const persisted = JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage }
    });
    return {
      containsToken: persisted.includes(secret),
      githubToken: localStorage.getItem('githubToken'),
      sessionGithubToken: sessionStorage.getItem('githubToken')
    };
  }, token)).toEqual({ containsToken: false, githubToken: null, sessionGithubToken: null });

  await page.reload();
  await expect(page.locator('#githubConnectBtn')).toBeVisible();
  await expect(page.locator('#userInfo')).toBeHidden();
});

test('renders a self-contained site preview without a server preview endpoint', async ({ page }) => {
  const consoleErrors = [];
  const sameOriginApiRequests = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) sameOriginApiRequests.push(request.url());
  });

  await page.goto('./');
  await page.click('#newFileBtn');
  await page.fill('#newFileName', 'index.html');
  await page.selectOption('#fileTemplate', 'html');
  await page.click('#createFileSubmit');
  await page.click('#previewBtn');

  await expect(page.locator('.editor-stack')).toHaveClass(/preview-open/);
  const preview = page.frameLocator('#previewFrame');
  await expect(preview.locator('h1')).toHaveText('Welcome!');
  await expect(preview.locator('.hero')).toHaveCSS('background-image', /linear-gradient/);
  expect(sameOriginApiRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
