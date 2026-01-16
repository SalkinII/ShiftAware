import { Page, Locator } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;
  readonly eventsList: Locator;
  readonly runAlgorithmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.eventsList = page.locator(
      '[data-testid="events-list"], .events-list, [class*="event"]',
    );
    this.runAlgorithmButton = page.locator(
      'button:has-text("Run Algorithm"), button:has-text("Run Assignment")',
    );
  }

  async goto() {
    await this.page.goto("/dashboard");
  }

  async selectEvent(eventName: string) {
    await this.page.locator(`text=${eventName}`).click();
  }

  async runAlgorithm() {
    await this.runAlgorithmButton.click();
  }
}
