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
    await this.submitButton.click();
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
