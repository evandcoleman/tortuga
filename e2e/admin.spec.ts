import { test, expect } from '@playwright/test';

test('login screen renders', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByPlaceholder('Email')).toBeVisible();
});
