/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, className, variant, disabled }: any) => (
    <button onClick={onClick} className={className} disabled={disabled}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock("@/components/ui/Skeleton", () => ({ SkeletonList: () => null }));
vi.mock("@/components/ui/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (r: any) => r?.data ?? r,
}));

const mockLog = {
  id: "log-1",
  userId: null,
  user: null,
  action: "UPDATE",
  entityType: "CONFIG",
  entityId: "cmmgdgjac000ajez886p2vgps",
  before: {},
  after: {},
  reason: null,
  ipAddress: "::ffff:127.0.0.1",
  createdAt: new Date().toISOString(),
};

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: { logs: [mockLog], total: 1, hasMore: false } }),
});

import AuditLogPage from "../page";

describe("AuditLogPage – mobile card layout", () => {
  it("card body stacks with flex-col on mobile (sm:flex-row)", async () => {
    render(<AuditLogPage />);
    await waitFor(() => screen.getByText(/cmmgdgjac000ajez886p2vgps/));

    const entityText = screen.getByText(/cmmgdgjac000ajez886p2vgps/);
    // entity text → p → left block → card body flex container
    const cardBody = entityText.parentElement!.parentElement!;
    expect(cardBody.className).toContain("flex-col");
    expect(cardBody.className).toContain("sm:flex-row");
  });

  it("entity ID paragraph has break-all so long CUIDs wrap", async () => {
    render(<AuditLogPage />);
    await waitFor(() => screen.getByText(/cmmgdgjac000ajez886p2vgps/));

    const entityText = screen.getByText(/cmmgdgjac000ajez886p2vgps/);
    const paragraph =
      entityText instanceof HTMLElement && entityText.tagName === "P"
        ? entityText
        : entityText.parentElement!;
    expect(paragraph.className).toContain("break-all");
  });
});
