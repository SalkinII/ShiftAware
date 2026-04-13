/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (d: any) => (d?.data !== undefined ? d.data : d),
}));
vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, className, variant }: any) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/ui/Input", () => ({
  Input: ({ placeholder, value, onChange, className }: any) => (
    <input placeholder={placeholder} value={value} onChange={onChange} className={className} />
  ),
}));
vi.mock("@/components/features/Identity/ProfileDetailCard", () => ({
  ProfileDetailCard: () => null,
}));
vi.mock("@/app/(routes)/app/identity/components/CreateProfileForm", () => ({
  CreateProfileForm: () => null,
}));

vi.spyOn(globalThis, "fetch").mockResolvedValue({
  ok: true,
  json: async () => ({ data: [] }),
} as any);

import { MemberListByEvent } from "../MemberListByEvent";

describe("MemberListByEvent – mobile layout", () => {
  it("button group has flex-wrap so buttons reflow on narrow screens", async () => {
    render(<MemberListByEvent eventId="evt-1" eventName="Test Event" />);
    const createBtn = await screen.findByRole("button", { name: /Create New Member/i });
    const buttonGroup = createBtn.parentElement!;
    expect(buttonGroup.className).toContain("flex-wrap");
  });

  it("header has flex-wrap so button group can drop below the title", async () => {
    render(<MemberListByEvent eventId="evt-1" eventName="Test Event" />);
    const createBtn = await screen.findByRole("button", { name: /Create New Member/i });
    const header = createBtn.parentElement!.parentElement!;
    expect(header.className).toContain("flex-wrap");
  });
});
