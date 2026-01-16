import { test, expect } from "@playwright/test";

/**
 * Example test to verify Playwright setup
 * This will be replaced with actual critical flow tests
 */
test("homepage loads", async ({ page }) => {
  await page.goto("/");

  // Check that the page loads
  await expect(page).toHaveTitle(/ShiftAware/i);

  // Check for login link or redirect
  const url = page.url();
  expect(url).toMatch(/login|dashboard/);
});

test("login page is accessible", async ({ page }) => {
  await page.goto("/login");

  // Check for password input
  const passwordInput = page.locator('input[type="password"]');
  await expect(passwordInput).toBeVisible();

  // Check for submit button
  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeVisible();
});
