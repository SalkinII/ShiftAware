// Coordinate system
export const PIXELS_PER_HOUR = 200;
export const LANE_HEIGHT = 120;
export const SHIFT_NODE_HEIGHT = 100;
export const SHIFT_NODE_PADDING = 10;

// Snap grid
export const SNAP_INTERVAL_MINUTES = 15;
export const SNAP_PIXELS = PIXELS_PER_HOUR / 4; // 50px per 15 min

// Viewport
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const DEFAULT_ZOOM = 0.5;

// Semantic zoom thresholds
export const ZOOM_MINIMAL = 0.3;   // Below: colored bar only
export const ZOOM_COMPACT = 0.7;   // Below: bar + name. Above: full detail

// Time ruler
export const TICK_HEIGHT_HOUR = 12;
export const TICK_HEIGHT_30MIN = 8;
export const TICK_HEIGHT_15MIN = 6;

// Day separator
export const DAY_SEPARATOR_WIDTH = 2;

// Node z-indices
export const Z_LANE_ZONE = 0;
export const Z_DAY_SEPARATOR = 1;
export const Z_SHIFT_BLOCK = 2;
