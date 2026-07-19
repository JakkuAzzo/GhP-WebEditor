const { test, expect } = require('@playwright/test');

test('shows the product landing page under a GitHub Pages subpath', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/GhP WebEditor/);
  await expect(page.getByRole('heading', { name: 'Edit your site. Preview it. Open a review PR.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Download latest release/ })).toHaveAttribute('href', 'https://github.com/JakkuAzzo/GhP-WebEditor/releases/latest');
  await expect(page.getByRole('link', { name: 'Browse releases' })).toHaveAttribute('href', 'https://github.com/JakkuAzzo/GhP-WebEditor/releases');
  await expect(page.locator('script')).toHaveCount(0);
});

test('sends feedback only to the scoped project FormSubmit address', async ({ page }) => {
  await page.goto('./');
  const form = page.locator('#feedback form');
  await expect(form).toHaveAttribute('action', 'https://formsubmit.co/e0a3287540eff1fab6eab624eb29c561');
  await expect(form.locator('input[name="_subject"]')).toHaveAttribute('value', 'GhP WebEditor feedback');
  await expect(form.getByLabel('Name')).toBeVisible();
  await expect(form.getByLabel('Email')).toBeVisible();
  await expect(form.getByLabel('Message')).toBeVisible();
});

test('keeps the landing page usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.getByRole('link', { name: /Download latest release/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comments, ideas, and bugs' })).toBeVisible();
});
