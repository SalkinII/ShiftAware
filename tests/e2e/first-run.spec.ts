import { test, expect } from "@playwright/test";
import { LoginPage } from "./pages/LoginPage";

// Synthetic names only. Precondition: an empty, unseeded local database.
//   npx prisma migrate reset --force --skip-seed
//   npx prisma migrate deploy        -> must print "No pending migrations"
// This mirrors production, where migrate deploy runs on an empty database.

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "test-password";
const MEMBER_PASSWORD = process.env.MEMBER_PASSWORD || ADMIN_PASSWORD;

test("first run: admin builds a festival, a member joins and answers, admin sees them", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const loginAdmin = new LoginPage(admin);
  await loginAdmin.goto();
  await loginAdmin.login(ADMIN_PASSWORD);

  // 1. Admin opens setup on an empty database
  await admin.goto("/admin/setup");
  await expect(admin.getByRole("heading", { name: "Create your first festival" })).toBeVisible();

  // 2. Create the festival; it becomes the selected festival
  await admin.getByLabel("Festival name", { exact: true }).fill("Test Meadow");
  await admin.getByLabel("Start date", { exact: true }).fill("2026-07-01");
  await admin.getByLabel("End date", { exact: true }).fill("2026-07-03");
  await admin.getByRole("button", { name: "Create festival" }).click();
  await expect(admin.getByRole("combobox")).not.toHaveValue("");

  // 3. Create the environment "Bar" inside it
  await admin.getByRole("button", { name: "+ New Environment" }).click();
  await admin.getByLabel("Environment Name", { exact: true }).fill("Bar");
  await admin.getByLabel("Start Date", { exact: true }).fill("2026-07-01");
  await admin.getByLabel("End Date", { exact: true }).fill("2026-07-03");
  await admin.getByRole("button", { name: "Create Environment" }).click();

  const environments = await (await admin.request.get("/api/environments")).json();
  const bar = environments.data.find((e: { name: string }) => e.name === "Bar");
  expect(bar).toBeTruthy();

  // 4. Add can_drive to the library and require it for Bar
  await admin.goto(`/admin/environments/${bar.id}/attributes`);
  await admin.getByLabel("Name", { exact: true }).fill("can_drive");
  await admin.getByLabel("Label", { exact: true }).fill("Can Drive");
  await admin.getByLabel("Type", { exact: true }).selectOption("BOOLEAN");
  await admin.getByRole("button", { name: "Add to library" }).click();
  await admin.getByRole("checkbox", { name: /can_drive/ }).check();
  await admin.getByLabel("can_drive required").selectOption("required");

  // 5. A member creates a profile, joins Bar and answers the one question
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  const loginMember = new LoginPage(member);
  await loginMember.goto();
  await loginMember.login(MEMBER_PASSWORD);

  await member.goto("/app/identity");
  await member.getByRole("button", { name: "Create New Profile" }).click();
  await member.getByLabel("Display Name (Alias)").fill("Lynx");
  await member.getByRole("button", { name: "Create Profile" }).click();

  await member.getByRole("heading", { name: "Bar", exact: true }).click();
  await expect(member.getByRole("heading", { name: "Complete Your Profile" })).toBeVisible();
  await expect(member.locator("label", { hasText: "Can Drive" })).toHaveCount(1);
  await member.getByRole("checkbox").check();
  await member.getByRole("button", { name: "Continue" }).click();
  await expect(member).toHaveURL(/\/app\/calendar/);

  // 6. Admin sees Lynx in the team list
  await admin.goto("/admin/team");
  await expect(admin.getByText("Lynx").first()).toBeVisible();

  await memberContext.close();
  await adminContext.close();
});
