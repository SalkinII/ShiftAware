/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TemplateManager } from "@/app/admin/setup/components/TemplateManager";

vi.mock("@/lib/contexts/EnvironmentContext", () => ({
  useEnvironmentContext: () => ({
    selectedEnvironmentId: "env-1",
    selectedEnvironment: { id: "env-1", name: "Bar" },
  }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/api-errors", () => ({
  unwrapApiResponse: (data: { data?: unknown } | undefined) => (data?.data !== undefined ? data.data : data),
}));

vi.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));
vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));
vi.mock("@/components/ui/Input", () => ({
  Input: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string | number;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
  }) => (
    <div>
      <label>{label}</label>
      <input aria-label={label} value={value} onChange={onChange} />
    </div>
  ),
}));

describe("TemplateManager festival library", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }) as unknown as typeof fetch;
  });

  it("loads the template library of the festival it is shown for", async () => {
    render(<TemplateManager festivalId="fest-1" />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/shifts/templates?festivalId=fest-1"),
    );
  });

  it("without a festival it requests no library and offers no new template", async () => {
    render(<TemplateManager festivalId={null} />);

    expect(await screen.findByText("Select a festival to see its template library")).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalledWith("/api/shifts/templates");
    expect(screen.queryByRole("button", { name: /new template/i })).toBeNull();
  });

  it("no longer offers event-specific templates", async () => {
    render(<TemplateManager festivalId="fest-1" />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/shifts/templates?festivalId=fest-1"),
    );
    expect(screen.queryByText(/event-specific/i)).toBeNull();
  });
});
