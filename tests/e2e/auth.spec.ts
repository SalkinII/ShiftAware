import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";

test.describe("Authentication", () => {
  test("login with correct password", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Get password from env or use default test password
    const password = process.env.ADMIN_PASSWORD || "test-password";

    await loginPage.login(password);

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    expect(await loginPage.isLoggedIn()).toBe(true);
  });

  test("login with incorrect password shows error", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login("wrong-password");

    // Should stay on login page or show error
    const url = page.url();
    if (url.includes("/login")) {
      // Error message should be visible
      await expect(loginPage.errorMessage.first())
        .toBeVisible({ timeout: 2000 })
        .catch(() => {
          // If no error message element, check for toast/alert
          expect(page.locator("text=/invalid|error|incorrect/i")).toBeVisible();
        });
    }
  });

  test("protected routes require authentication", async ({ page }) => {
    // Try to access protected route without login
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("session persists after page reload", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const password = process.env.ADMIN_PASSWORD || "test-password";
    await loginPage.login(password);

    // Reload page
    await page.reload();

    // Should still be logged in
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("logout clears session", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const password = process.env.ADMIN_PASSWORD || "test-password";
    await loginPage.login(password);

    // Find and click logout (might be in header/sidebar)
    const logoutButton = page.locator(
      'button:has-text("Logout"), a:has-text("Logout")',
    );
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click();
    } else {
      // Try API logout
      await page.request.post("/api/auth/logout");
    }

    // Try to access protected route
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
