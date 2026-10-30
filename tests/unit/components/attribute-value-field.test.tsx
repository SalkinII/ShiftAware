// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  AttributeValueField,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/components/features/Identity/AttributeValueField";

// The UTC display bug only shows when local time differs from UTC, so pin a zone with an offset.
const originalTimezone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "Europe/Berlin";
});

afterAll(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

describe("datetime-local conversion", () => {
  it("displays a UTC ISO timestamp in local time, not sliced UTC", () => {
    // 2026-06-20T18:00:00.000Z is 20:00 in CEST (UTC+2)
    const utcIso = "2026-06-20T18:00:00.000Z";
    const local = toDatetimeLocalValue(utcIso);
    const asDate = new Date(utcIso);
    const expectedLocal = new Date(
      asDate.getTime() - asDate.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 16);
    expect(local).toBe(expectedLocal);
  });

  it("round-trips a local datetime-local value back to the same UTC instant", () => {
    const utcIso = "2026-06-20T18:00:00.000Z";
    const local = toDatetimeLocalValue(utcIso);
    const backToUtc = fromDatetimeLocalValue(local);
    expect(backToUtc).toBe(utcIso);
  });

  it("shows 18:00Z as 20:00 in Berlin summer time", () => {
    expect(toDatetimeLocalValue("2026-06-20T18:00:00.000Z")).toBe("2026-06-20T20:00");
  });
});

describe("TIME_CONSTRAINT editor", () => {
  const attr = { name: "availability", label: "Availability", type: "TIME_CONSTRAINT" as const };
  const availability = {
    arriveAfter: "2026-06-20T18:00:00.000Z",
    leaveBefore: "2026-06-20T22:00:00.000Z",
  };
  const blackout = { date: "2026-06-20", startHour: 22, endHour: 6 };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows availability in local time and emits UTC after an edit", () => {
    const onChange = vi.fn();
    const value = JSON.stringify({ availabilityWindows: [availability], dailyBlackouts: [] });
    const { container } = render(<AttributeValueField attr={attr} value={value} onChange={onChange} />);
    const arriveAfter = container.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;

    expect(arriveAfter).toHaveValue("2026-06-20T20:00");

    fireEvent.change(arriveAfter, { target: { value: "2026-06-20T21:30" } });

    const emitted = JSON.parse(onChange.mock.calls[0][0]);
    expect(emitted.availabilityWindows[0].arriveAfter).toBe("2026-06-20T19:30:00.000Z");
  });

  it("marks an edit as saved, then clears the mark after 1.2 seconds", () => {
    vi.useFakeTimers();
    const value = JSON.stringify({ availabilityWindows: [availability], dailyBlackouts: [] });
    const { container } = render(<AttributeValueField attr={attr} value={value} onChange={vi.fn()} />);
    const arriveAfter = container.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;

    fireEvent.change(arriveAfter, { target: { value: "2026-06-20T21:30" } });
    expect(screen.getByRole("status")).toHaveTextContent("✓ Saved");

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("marks only the edited row when an availability row and a blackout row share an index", () => {
    const value = JSON.stringify({ availabilityWindows: [availability], dailyBlackouts: [blackout] });
    const { container } = render(<AttributeValueField attr={attr} value={value} onChange={vi.fn()} />);
    const arriveAfter = container.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;

    fireEvent.change(arriveAfter, { target: { value: "2026-06-20T21:30" } });

    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
