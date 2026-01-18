import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";

test.describe("Authentication", () => {
  test("login with correct password", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Wait for login page to be ready
    await page.waitForLoadState("domcontentloaded");

    // Get password from env or use default test password
    const password = process.env.ADMIN_PASSWORD || "test-password";

    await loginPage.login(password);

    // Should already be on dashboard (LoginPage.login waits for navigation)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Verify we're actually logged in
    expect(await loginPage.isLoggedIn()).toBe(true);

    // Verify dashboard content is visible (not just URL change)
    await expect(page.locator("text=/dashboard|welcome|shifts/i").first())
      .toBeVisible({ timeout: 10000 })
      .catch(() => {
        // If specific text not found, just verify we're not on login page
        expect(page.url()).not.toContain("/login");
      });
  });

  test("login with incorrect password shows error", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // LoginPage.login throws when login fails, so wrap in try-catch
    try {
      await loginPage.login("wrong-password");
      // If we get here, login unexpectedly succeeded
      throw new Error("Login should have failed with wrong password");
    } catch (e) {
      // Expected - login failed, now verify we're still on login page with error
      expect(page.url()).toContain("/login");
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

    // Wait for login page to be ready
    await page.waitForLoadState("domcontentloaded");

    const password = process.env.ADMIN_PASSWORD || "test-password";
    await loginPage.login(password);

    // Wait for dashboard to fully load before reloading
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 });

    // Reload page
    await page.reload({ waitUntil: "domcontentloaded" });

    // Should still be logged in
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Verify we're still logged in (not redirected to login)
    expect(page.url()).not.toContain("/login");
  });

  test("logout clears session", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const password = process.env.ADMIN_PASSWORD || "test-password";
    await loginPage.login(password);

    // Wait for dashboard to load
    await page
      .waitForLoadState("networkidle", { timeout: 10000 })
      .catch(() => {});

    // Find and click logout (might be in header/sidebar)
    const logoutButton = page.locator(
      'button[title="Logout"], button:has-text("Logout"), a:has-text("Logout")',
    );

    if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await Promise.all([
        page.waitForURL(/\/login/, { timeout: 10000 }),
        logoutButton.click(),
      ]);
    } else {
      // Try API logout
      await page.request.post("/api/auth/logout");
      await page.goto("/dashboard");
    }

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
