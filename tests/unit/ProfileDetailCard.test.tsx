/**
 * @vitest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { ProfileDetailCard } from "@/components/features/Identity/ProfileDetailCard";
import { ToastProvider } from "@/components/ui/Toast";

const member = {
  alias: "Wolf",
  avatarId: "🐺",
  experienceLevel: "SENIOR",
  capabilities: ["TEAM_MEMBER"],
};

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("ProfileDetailCard", () => {
  it("renders alias and avatar", () => {
    renderWithToast(<ProfileDetailCard member={member} onClose={() => {}} />);
    expect(screen.getByText("Wolf")).toBeTruthy();
    expect(screen.getByText("🐺")).toBeTruthy();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    renderWithToast(<ProfileDetailCard member={member} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("profile-card-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    renderWithToast(<ProfileDetailCard member={member} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders nothing when member is null", () => {
    const { container } = renderWithToast(
      <ProfileDetailCard member={null} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders minimal member (alias and avatar only)", () => {
    renderWithToast(
      <ProfileDetailCard
        member={{ alias: "Fox", avatarId: "🦊" }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Fox")).toBeTruthy();
    expect(screen.getByText("🦊")).toBeTruthy();
  });
});
