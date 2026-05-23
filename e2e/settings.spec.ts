import { test, expect } from '@playwright/test';

// The admin (settings) routes are auth-gated. With the default session auth mode
// an unauthenticated request to /settings redirects to the login screen. This
// mirrors e2e/admin.spec.ts; the authenticated edit/save flow is exercised via
// the in-app server-action tests and manual verification.
test('settings route is protected by auth', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByPlaceholder('Email')).toBeVisible();
});
