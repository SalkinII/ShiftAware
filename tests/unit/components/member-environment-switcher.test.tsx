/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemberEnvironmentSwitcher } from "@/components/layout/MemberEnvironmentSwitcher";

const fixtures = vi.hoisted(() => {
  const dates = { startDate: "2026-07-01T00:00:00.000Z", endDate: "2026-07-03T00:00:00.000Z" };
  return {
    bar: { id: "env-bar", name: "Bar", festivalId: "fest-1", status: "ACTIVE", _count: { shifts: 3 }, ...dates },
    stage: { id: "env-stage", name: "Stage", festivalId: "fest-1", status: "ACTIVE", _count: { shifts: 0 }, ...dates },
    gate: { id: "env-gate", name: "Gate", festivalId: "fest-1", status: "PLANNING", _count: { shifts: 0 }, ...dates },
    canDrive: { id: "def-1", name: "can_drive", label: "Can Drive", type: "BOOLEAN", options: [], required: true },
  };
});

const ctx = vi.hoisted(() => ({
  pathname: "/app/calendar",
  missingOk: true,
  missingEnvironments: [] as string[],
  setSelectedEnvironmentId: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({ usePathname: () => ctx.pathname }));
vi.mock("@/lib/hooks/useMemberContext", () => ({
  useMemberContext: () => ({ selectedMemberId: "m1" }),
}));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ctx.toast }));
vi.mock("@/lib/contexts/EnvironmentContext", () => ({
  useEnvironmentContext: () => ({
    environments: [fixtures.bar, fixtures.stage, fixtures.gate],
    selectedEnvironment: fixtures.bar,
    setSelectedEnvironmentId: ctx.setSelectedEnvironmentId,
  }),
}));

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

const fetchMock = vi.fn(async (url: string) => {
  if (url === "/api/members/m1") {
    return json({
      data: {
        environmentRegistrations: [
          { environment: { id: "env-bar" } },
          { environment: { id: "env-stage" } },
        ],
      },
    });
  }
  if (url === "/api/members/m1/joinable-environments") {
    return json({
      data: [
        { id: "env-gate", name: "Gate", festivalId: "fest-1", status: "PLANNING", missingQuestionCount: 1 },
      ],
    });
  }
  if (url === "/api/festivals") return json({ data: [{ id: "fest-1", name: "Starlight" }] });
  if (url === "/api/environments/env-gate/registrations") return json({ data: { id: "reg-1" } });
  if (url.endsWith("/members/m1/missing-attributes")) {
    const environmentId = url.split("/")[3];
    const missing = ctx.missingEnvironments.includes(environmentId) ? [fixtures.canDrive] : [];
    return ctx.missingOk ? json({ data: { missing, answers: [] } }) : json({}, false);
  }
  if (url === "/api/members/m1/attributes") return json({ data: {} });
  throw new Error(`unexpected fetch ${url}`);
});

// Lets the mocked member and festival requests resolve and render
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("MemberEnvironmentSwitcher", () => {
  beforeEach(() => {
    ctx.pathname = "/app/calendar";
    ctx.missingOk = true;
    ctx.missingEnvironments = [];
    ctx.setSelectedEnvironmentId.mockClear();
    ctx.toast.error.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("on admin pages lists every environment and offers no join", async () => {
    ctx.pathname = "/admin/setup";
    render(<MemberEnvironmentSwitcher />);
    await settle();

    fireEvent.click(screen.getByRole("button", { name: "Starlight › Bar" }));

    expect(screen.getByRole("button", { name: /○ Gate/ })).toBeTruthy();
    expect(screen.queryByText("Join Another")).toBeNull();
  });

  it("joining asks the questions the switcher advertised before switching in", async () => {
    ctx.missingEnvironments = ["env-gate"];
    render(<MemberEnvironmentSwitcher />);
    await settle();

    fireEvent.click(screen.getByRole("button", { name: "Starlight › Bar" }));
    fireEvent.click(screen.getByRole("button", { name: /\+ Gate/ }));

    expect(await screen.findByRole("heading", { name: "Complete Your Profile" })).toBeTruthy();
    expect(ctx.setSelectedEnvironmentId).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(ctx.setSelectedEnvironmentId).toHaveBeenCalledWith("env-gate"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/members/m1/attributes",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not switch in when the questions cannot be checked", async () => {
    ctx.missingOk = false;
    render(<MemberEnvironmentSwitcher />);
    await settle();

    fireEvent.click(screen.getByRole("button", { name: "Starlight › Bar" }));
    fireEvent.click(screen.getByRole("button", { name: /\+ Gate/ }));

    await waitFor(() => expect(ctx.toast.error).toHaveBeenCalled());
    expect(ctx.setSelectedEnvironmentId).not.toHaveBeenCalled();
  });

  it("switching to a joined environment with unanswered questions asks them first", async () => {
    ctx.missingEnvironments = ["env-stage"];
    render(<MemberEnvironmentSwitcher />);
    await settle();

    fireEvent.click(screen.getByRole("button", { name: "Starlight › Bar" }));
    fireEvent.click(screen.getByRole("button", { name: /Stage/ }));

    expect(await screen.findByRole("heading", { name: "Complete Your Profile" })).toBeTruthy();
    expect(ctx.setSelectedEnvironmentId).not.toHaveBeenCalled();
  });

  it("switching to a joined environment that needs nothing selects it at once", async () => {
    render(<MemberEnvironmentSwitcher />);
    await settle();

    fireEvent.click(screen.getByRole("button", { name: "Starlight › Bar" }));
    fireEvent.click(screen.getByRole("button", { name: /Stage/ }));

    await waitFor(() => expect(ctx.setSelectedEnvironmentId).toHaveBeenCalledWith("env-stage"));
    expect(screen.queryByRole("heading", { name: "Complete Your Profile" })).toBeNull();
  });
});
