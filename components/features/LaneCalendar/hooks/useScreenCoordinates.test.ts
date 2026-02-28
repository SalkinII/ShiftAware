// components/features/LaneCalendar/hooks/useScreenCoordinates.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useViewport } from "@xyflow/react";
import { useScreenCoordinates } from "./useScreenCoordinates";

// Mock React Flow's useViewport hook
vi.mock("@xyflow/react", () => ({
  useViewport: vi.fn(),
}));

describe("useScreenCoordinates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should convert flow X coordinate to screen X at default zoom", () => {
    vi.mocked(useViewport).mockReturnValue({
      zoom: 1.0,
      x: 0,
      y: 0,
    } as any);

    const { flowToScreenX } = useScreenCoordinates();
    // flowX = 100, zoom = 1, viewportX = 0 → screenX = 100 * 1 + 0 = 100
    expect(flowToScreenX(100)).toBe(100);
  });

  it("should convert flow X coordinate to screen X with zoom applied", () => {
    vi.mocked(useViewport).mockReturnValue({
      zoom: 0.5,
      x: 0,
      y: 0,
    } as any);

    const { flowToScreenX } = useScreenCoordinates();
    // flowX = 100, zoom = 0.5, viewportX = 0 → screenX = 100 * 0.5 + 0 = 50
    expect(flowToScreenX(100)).toBe(50);
  });

  it("should convert flow X coordinate to screen X with viewport pan applied", () => {
    vi.mocked(useViewport).mockReturnValue({
      zoom: 1.0,
      x: 50,
      y: 0,
    } as any);

    const { flowToScreenX } = useScreenCoordinates();
    // flowX = 100, zoom = 1, viewportX = 50 → screenX = 100 * 1 + 50 = 150
    expect(flowToScreenX(100)).toBe(150);
  });

  it("should convert flow X coordinate with both zoom and pan", () => {
    vi.mocked(useViewport).mockReturnValue({
      zoom: 0.5,
      x: 25,
      y: 0,
    } as any);

    const { flowToScreenX } = useScreenCoordinates();
    // flowX = 100, zoom = 0.5, viewportX = 25 → screenX = 100 * 0.5 + 25 = 75
    expect(flowToScreenX(100)).toBe(75);
  });

  it("should return zoom level", () => {
    vi.mocked(useViewport).mockReturnValue({
      zoom: 0.5,
      x: 0,
      y: 0,
    } as any);

    const { zoom } = useScreenCoordinates();
    expect(zoom).toBe(0.5);
  });
});
