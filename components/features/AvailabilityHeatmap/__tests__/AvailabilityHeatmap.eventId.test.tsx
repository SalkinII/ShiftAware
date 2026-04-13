/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Capture what useCache is called with so we can inspect the cache key
let capturedCacheKey = "";
vi.mock("@/lib/cache/useCache", () => ({
  useCache: (opts: { key: string; fetchFn: () => Promise<any> }) => {
    capturedCacheKey = opts.key;
    return { data: null, loading: true, error: null, refetch: vi.fn() };
  },
}));

import { AvailabilityHeatmap } from "../AvailabilityHeatmap";

describe("AvailabilityHeatmap – eventId prop", () => {
  it("includes eventId in cache key and fetch URL when prop is provided", () => {
    render(<AvailabilityHeatmap eventId="evt-42" />);
    expect(capturedCacheKey).toContain("eventId=evt-42");
  });

  it("cache key does not contain eventId when prop is omitted", () => {
    render(<AvailabilityHeatmap />);
    expect(capturedCacheKey).not.toContain("eventId");
  });
});
