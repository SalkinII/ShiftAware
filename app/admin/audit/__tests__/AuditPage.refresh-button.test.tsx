/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Stub the Button component to expose the variant as a data attribute
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, variant, onClick, className, disabled }: any) => (
    <button
      data-variant={variant}
      onClick={onClick}
      className={className}
      disabled={disabled}
    >
      {children}
    </button>
  ),
}));
vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock("@/components/ui/Skeleton", () => ({
  SkeletonList: () => null,
}));
vi.mock("@/components/ui/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (r: any) => r?.data ?? r,
}));

// Prevent fetch from being called during initial mount
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: { logs: [], total: 0, hasMore: false } }),
});

import AuditLogPage from "../page";

describe("AuditLogPage – Refresh button", () => {
  it("Refresh button has variant='secondary', not 'primary'", () => {
    render(<AuditLogPage />);
    const refreshBtn = screen.getByRole("button", { name: /Refresh/i });
    expect(refreshBtn.getAttribute("data-variant")).toBe("secondary");
    expect(refreshBtn.getAttribute("data-variant")).not.toBe("primary");
  });
});
