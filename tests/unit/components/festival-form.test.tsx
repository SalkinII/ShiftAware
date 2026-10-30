/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FestivalForm } from "@/app/admin/setup/components/FestivalForm";

const starlight = {
  id: "fest-1",
  name: "Starlight",
  startDate: "2026-06-20T00:00:00.000Z",
  endDate: "2026-06-24T00:00:00.000Z",
};

describe("FestivalForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the first-festival empty state", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }) as any;

    render(<FestivalForm selectedFestivalId={null} onSelect={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Create your first festival" })).toBeTruthy();
    expect(screen.getByLabelText(/festival name/i)).toBeTruthy();
  });

  it("lists existing festivals and reports the chosen one", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [starlight] }) }) as any;
    const onSelect = vi.fn();

    render(<FestivalForm selectedFestivalId={null} onSelect={onSelect} />);

    const select = await screen.findByRole("combobox");
    expect(screen.queryByRole("heading", { name: "Create your first festival" })).toBeNull();
    expect(screen.getByRole("option", { name: "Starlight" })).toBeTruthy();

    fireEvent.change(select, { target: { value: "fest-1" } });

    expect(onSelect).toHaveBeenCalledWith("fest-1");
  });

  it("shows the server's validation message", async () => {
    global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return { ok: false, status: 400, json: async () => ({ error: "End date must be after start date" }) };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    }) as any;

    render(<FestivalForm selectedFestivalId={null} onSelect={vi.fn()} />);
    await screen.findByRole("heading", { name: "Create your first festival" });

    fireEvent.change(screen.getByLabelText(/festival name/i), { target: { value: "Starlight" } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: "2026-06-24" } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: "2026-06-20" } });
    fireEvent.click(screen.getByRole("button", { name: /create festival/i }));

    expect(await screen.findByText("End date must be after start date")).toBeTruthy();
  });
});
