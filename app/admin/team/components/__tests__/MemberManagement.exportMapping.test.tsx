/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/components/features/Identity/ProfileDetailCard", () => ({
  ProfileDetailCard: () => null,
}));

const members = [
  { id: "m1", alias: "Alpha", avatarId: "🐨", experienceLevel: "NOVICE", capabilities: [], isActive: true },
  { id: "m2", alias: "Bravo", avatarId: "🦊", experienceLevel: "NOVICE", capabilities: [], isActive: true },
];

vi.mock("@/lib/cache/useCache", () => ({
  useCache: () => ({ data: members, loading: false, error: null, refetch: vi.fn() }),
}));

const autoTableMock = vi.fn();
const saveMock = vi.fn();
const textMock = vi.fn();

vi.mock("jspdf", () => ({
  default: class JsPDFMock {
    text = textMock;
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    save = saveMock;
  },
}));

vi.mock("jspdf-autotable", () => ({
  default: (...args: any[]) => autoTableMock(...args),
}));

import { MemberManagement } from "../MemberManagement";

describe("MemberManagement – Export Mapping", () => {
  beforeEach(() => {
    autoTableMock.mockClear();
    saveMock.mockClear();
    textMock.mockClear();
  });

  it("does not include the member's avatar emoji in the exported pseudonym mapping table (jsPDF's default font can't render it)", async () => {
    render(<MemberManagement />);

    fireEvent.click(await screen.findByRole("button", { name: /export mapping/i }));

    await waitFor(() => expect(autoTableMock).toHaveBeenCalled());
    const [, tableCfg] = autoTableMock.mock.calls[0];
    expect(tableCfg.body[0]).not.toContain("🐨");
    expect(tableCfg.body[1]).not.toContain("🦊");
  });
});
