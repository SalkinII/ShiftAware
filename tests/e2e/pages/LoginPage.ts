import { Page, Locator } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator(
      '[role="alert"], .error, [class*="error"]',
    );
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(password: string) {
    await this.passwordInput.fill(password);

    // Wait for navigation after clicking submit
    // Use Promise.all to wait for both the click and navigation
    await Promise.all([
      this.page.waitForURL(/\/dashboard/, { timeout: 15000 }),
      this.submitButton.click(),
    ]).catch(async (error) => {
      // If navigation fails, check if we're still on login page (error case)
      const currentUrl = this.page.url();
      if (currentUrl.includes("/login")) {
        // Check for error message
        const errorVisible = await this.errorMessage
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        if (errorVisible) {
          throw new Error("Login failed - check password");
        }
      }
      throw error;
    });

    // Ensure dashboard is actually loaded (not just URL change)
    await this.page
      .waitForLoadState("domcontentloaded", { timeout: 10000 })
      .catch(() => {
        // If domcontentloaded times out, continue anyway
      });
  }

  async isLoggedIn(): Promise<boolean> {
    // Check if redirected away from login page
    const url = this.page.url();
    return (
      !url.includes("/login") &&
      (url.includes("/dashboard") || url.includes("/admin"))
    );
  }
}
