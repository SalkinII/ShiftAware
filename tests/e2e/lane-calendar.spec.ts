import { test, expect } from "@playwright/test";

test.describe("LaneCalendarView", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="password"]', process.env.ADMIN_PASSWORD || "admin");
    await page.click('button[type="submit"]');
    await page.waitForURL("/admin/**");
  });

  test("should display lanes for all shift types", async ({ page }) => {
    await page.goto("/admin/shifts/schedule");
    await page.click('button[title="Calendar view"]');

    await expect(page.getByText("Mobile Team")).toBeVisible();
    await expect(page.getByText("Mobile Team 2")).toBeVisible();
    await expect(page.getByText("Stationary")).toBeVisible();
    await expect(page.getByText("SUPER")).toBeVisible();
    await expect(page.getByText("Extended Service")).toBeVisible();
  });

  test("should highlight drop zone when dragging template over lane", async ({ page }) => {
    await page.goto("/admin/shifts/schedule");
    await page.click('button[title="Calendar view"]');

    const template = page.locator('[data-testid^="template-"]').first();

    if (await template.isVisible()) {
      const templateBox = await template.boundingBox();
      if (templateBox) {
        await page.mouse.move(
          templateBox.x + templateBox.width / 2,
          templateBox.y + templateBox.height / 2
        );
        await page.mouse.down();

        const dropZone = page.locator('[data-testid^="lane-drop-"]').first();
        const dropBox = await dropZone.boundingBox();

        if (dropBox) {
          await page.mouse.move(
            dropBox.x + dropBox.width / 2,
            dropBox.y + dropBox.height / 2
          );

          await expect(dropZone).toHaveClass(/ring-2/);
        }

        await page.mouse.up();
      }
    }
  });
});
