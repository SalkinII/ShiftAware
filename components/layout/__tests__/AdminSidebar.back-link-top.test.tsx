/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/shifts/schedule",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { AdminSidebar } from "../AdminSidebar";

describe("AdminSidebar – back link position", () => {
  it("renders 'Back to User View' before the Administration label", () => {
    render(<AdminSidebar />);
    const backLink = screen.getByText("Back to User View");
    const adminLabel = screen.getByText("Administration");
    // DOCUMENT_POSITION_FOLLOWING means adminLabel follows backLink in DOM
    expect(
      backLink.compareDocumentPosition(adminLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
