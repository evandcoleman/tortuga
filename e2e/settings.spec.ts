import { test, expect } from '@playwright/test';

// The admin (settings) routes are auth-gated. With the default session auth mode
// an unauthenticated request to /settings redirects to the login screen. This
// the authenticated edit/save flow is exercised via the form-parse unit tests,
// the context hot-reload tests, and manual browser verification.
test('settings route is protected by auth', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByLabel('Email')).toBeVisible();
});
