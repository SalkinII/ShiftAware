"use client";

import { useViewport } from "@xyflow/react";

/**
 * Encapsulates ALL viewport→screen coordinate transformations.
 * Use this for Panel-based overlays and screen-space positioned elements.
 *
 * Flow coordinates: The logical coordinate system within React Flow
 * Screen coordinates: Actual pixel positions on the viewport
 *
 * Formula: screenX = (flowX * zoom) + viewportX
 */
export function useScreenCoordinates() {
  const { zoom, x: viewportX, y: viewportY } = useViewport();

  return {
    /**
     * Convert a flow-space X coordinate to screen-space X coordinate.
     * Use for positioning Panel overlays horizontally.
     */
    flowToScreenX: (flowX: number): number => flowX * zoom + viewportX,

    /**
     * Convert a flow-space Y coordinate to screen-space Y coordinate.
     * Use for positioning Panel overlays vertically (rarely needed).
     */
    flowToScreenY: (flowY: number): number => flowY * zoom + viewportY,

    /**
     * The current zoom level. Use for scaling visual elements.
     * E.g., border width = Math.ceil(1 / zoom) for constant visual thickness
     */
    zoom,

    /**
     * Viewport pan offset (X). Rarely needed directly.
     */
    viewportX,

    /**
     * Viewport pan offset (Y). Rarely needed directly.
     */
    viewportY,
  };
}
