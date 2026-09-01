/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (d: any) => (d?.data !== undefined ? d.data : d),
}));
vi.mock("@/components/features/Identity/ProfileDetailCard", () => ({
  ProfileDetailCard: () => null,
}));
vi.mock("@/app/(routes)/app/identity/components/CreateProfileForm", () => ({
  CreateProfileForm: () => null,
}));

const members = [
  { id: "m1", alias: "Alice", avatarId: "🐨", eventRegistrations: [{ status: "REGISTERED" }] },
];

vi.spyOn(globalThis, "fetch").mockResolvedValue({
  ok: true,
  json: async () => ({ data: members }),
} as any);

import { MemberListByEvent } from "../MemberListByEvent";

describe("MemberListByEvent – remove member confirmation", () => {
  it("opens a ConfirmDialog instead of window.confirm when removing a member", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    render(<MemberListByEvent eventId="evt-1" eventName="Test Event" />);

    const removeBtn = await screen.findByRole("button", { name: /remove member/i });
    fireEvent.click(removeBtn);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/remove this member from the event/i)).toBeInTheDocument();
  });
});
