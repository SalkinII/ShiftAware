/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { ProfileDetailCard } from "@/components/features/Identity/ProfileDetailCard";

const member = {
  alias: "Wolf",
  avatarId: "🐺",
  experienceLevel: "SENIOR",
  capabilities: ["TEAM_MEMBER"],
};

describe("ProfileDetailCard", () => {
  it("renders alias and avatar", () => {
    render(<ProfileDetailCard member={member} onClose={() => {}} />);
    expect(screen.getByText("Wolf")).toBeTruthy();
    expect(screen.getByText("🐺")).toBeTruthy();
  });

  it("renders experience level badge", () => {
    render(<ProfileDetailCard member={member} onClose={() => {}} />);
    expect(screen.getByText("SENIOR")).toBeTruthy();
  });

  it("renders capability tags", () => {
    render(<ProfileDetailCard member={member} onClose={() => {}} />);
    expect(screen.getByText("TEAM MEMBER")).toBeTruthy();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<ProfileDetailCard member={member} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("profile-card-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<ProfileDetailCard member={member} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders nothing when member is null", () => {
    const { container } = render(
      <ProfileDetailCard member={null} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders without experienceLevel if not provided", () => {
    render(
      <ProfileDetailCard
        member={{ alias: "Fox", avatarId: "🦊" }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Fox")).toBeTruthy();
    expect(screen.queryByText("SENIOR")).toBeNull();
  });
});
