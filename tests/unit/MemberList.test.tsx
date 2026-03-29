/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { MemberList } from "@/app/(routes)/app/identity/components/MemberList";

// Intercept the /api/members fetch
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        {
          id: "m1",
          alias: "Wolf",
          avatarId: "🐺",
          experienceLevel: "INTERMEDIATE",
          capabilities: [],
          isActive: true,
        },
      ],
    }),
  });
});

describe("MemberList", () => {
  it("renders member alias", async () => {
    render(<MemberList onSelectMember={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Wolf")).toBeTruthy());
  });

  it("does NOT render raw experienceLevel values", async () => {
    render(<MemberList onSelectMember={vi.fn()} />);
    await waitFor(() => screen.getByText("Wolf")); // wait for data
    expect(screen.queryByText(/JUNIOR/i)).toBeNull();
    expect(screen.queryByText(/INTERMEDIATE/i)).toBeNull();
    expect(screen.queryByText(/SENIOR/i)).toBeNull();
  });

  it("does not show LEAD badge for SHIFT_LEAD capability", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "m2",
            alias: "Eagle",
            avatarId: "🦅",
            experienceLevel: "SENIOR",
            capabilities: ["SHIFT_LEAD"],
            isActive: true,
          },
        ],
      }),
    });
    render(<MemberList onSelectMember={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Eagle")).toBeTruthy());
    expect(screen.queryByText("LEAD")).toBeNull();
  });
});
