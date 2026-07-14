import { test, expect } from '@playwright/test';

async function editorContent(page) {
  return page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.getValue());
}

test('signs in, lists only granted repositories, and saves through the server session', async ({ page }) => {
  let authenticated = false;
  let savedPayload;
  let createdPayload;
  let deletedPayload;
  await page.route('**/api/auth/github/status', route => route.fulfill({
    json: authenticated
      ? { configured: true, authenticated: true, user: { login: 'fixture-user', avatar_url: 'https://example.test/avatar.png' } }
      : { configured: true, authenticated: false, user: null }
  }));
  await page.route('**/api/auth/github/start', route => {
    authenticated = true;
    return route.fulfill({ status: 302, headers: { Location: '/' } });
  });
  await page.route('**/api/github/repositories', route => route.fulfill({ json: [{ full_name: 'fixture/site' }] }));
  await page.route('**/api/github/repos/fixture/site', route => route.fulfill({ json: { default_branch: 'main' } }));
  await page.route('**/api/github/repos/fixture/site/pages/status', route => route.fulfill({
    json: {
      configured: true,
      url: 'https://fixture.github.io/site/',
      source: { branch: 'main', path: '/' },
      build: { status: 'built', commit: 'deployed-sha' }
    }
  }));
  await page.route('**/api/github/repos/fixture/site/tree?*', route => route.fulfill({
    json: { truncated: false, tree: [{ path: 'index.html', type: 'blob', sha: 'old-sha' }] }
  }));
  await page.route('**/api/github/repos/fixture/site/contents/index.html?*', route => route.fulfill({
    json: { encoding: 'base64', content: btoa('<h1>GitHub source</h1>') }
  }));
  await page.route('**/api/github/repos/fixture/site/contents/index.html', route => {
    savedPayload = route.request().postDataJSON();
    return route.fulfill({ json: { content: { sha: 'new-sha' }, commit: { sha: 'saved-sha' } } });
  });
  await page.route('**/api/github/repos/fixture/site/contents/new-page.html', route => {
    if (route.request().method() === 'PUT') {
      createdPayload = route.request().postDataJSON();
      return route.fulfill({ json: { content: { sha: 'created-sha' }, commit: { sha: 'created-commit' } } });
    }
    deletedPayload = route.request().postDataJSON();
    return route.fulfill({ json: { commit: { sha: 'deleted-commit' } } });
  });

  await page.goto('/');
  await page.click('#githubConnectBtn');
  await expect(page.locator('#githubAuthModal')).toHaveClass(/active/);
  await page.click('#connectGithubSubmit');
  await expect(page.locator('#userName')).toHaveText('fixture-user');
  await expect(page.locator('#repoSelect option')).toContainText([
    'Select a repository...',
    'fixture/site',
    'Manage repository access…'
  ]);
  await page.selectOption('#repoSelect', 'fixture/site');
  await expect(page.locator('#fileTree')).toContainText('index.html');
  await expect(page.locator('#pagesStatus')).toContainText('fixture/site · main');
  await expect(page.locator('#pagesStatus a')).toHaveAttribute('href', 'https://fixture.github.io/site/');
  await page.getByText('index.html', { exact: true }).click();
  await expect.poll(() => editorContent(page)).toBe('<h1>GitHub source</h1>');
  await page.evaluate(() => document.querySelector('.CodeMirror').CodeMirror.setValue('<h1>Published edit</h1>'));
  await page.click('#saveFileBtn');
  await expect(page.locator('#fileStatus')).toHaveText('Saved');
  await expect(page.locator('#pagesStatus')).toContainText('awaiting deployment');
  expect(savedPayload.branch).toBe('main');
  expect(savedPayload.sha).toBe('old-sha');
  expect(Buffer.from(savedPayload.content, 'base64').toString('utf8')).toBe('<h1>Published edit</h1>');

  await page.click('#newFileBtn');
  await page.fill('#newFileName', 'new-page.html');
  await page.selectOption('#fileTemplate', 'html');
  await page.click('#createFileSubmit');
  await page.click('#saveFileBtn');
  await expect(page.locator('#fileStatus')).toHaveText('Saved');
  expect(createdPayload.branch).toBe('main');
  expect(createdPayload.sha).toBeUndefined();
  expect(Buffer.from(createdPayload.content, 'base64').toString('utf8')).toContain('<!DOCTYPE html>');

  page.once('dialog', dialog => dialog.accept());
  await page.click('#deleteFileBtn');
  await expect(page.locator('#fileTree')).not.toContainText('new-page.html');
  expect(deletedPayload).toEqual({
    message: 'Delete new-page.html',
    sha: 'created-sha',
    branch: 'main'
  });
  expect(await page.evaluate(() => localStorage.getItem('githubToken'))).toBeNull();
});
