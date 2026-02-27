// Coordinate system
export const PIXELS_PER_HOUR = 200;
export const LANE_HEIGHT = 480;
export const SHIFT_NODE_HEIGHT = 460;
export const SHIFT_NODE_PADDING = 10;

// Snap grid
export const SNAP_INTERVAL_MINUTES = 15;
export const SNAP_PIXELS = PIXELS_PER_HOUR / 4; // 50px per 15 min

// Viewport
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const DEFAULT_ZOOM = 0.5;

// Semantic zoom thresholds
export const ZOOM_MINIMAL = 0.3; // Below: colored bar only
export const ZOOM_COMPACT = 0.7; // Below: bar + name. Above: full detail

// Time ruler
export const TICK_HEIGHT_HOUR = 12;
export const TICK_HEIGHT_30MIN = 8;
export const TICK_HEIGHT_15MIN = 6;

// Day separator
export const DAY_SEPARATOR_WIDTH = 4;

// Layout panel dimensions
export const LANE_LABEL_WIDTH = 72; // px — left lane labels strip width
export const RULER_HEIGHT = 48; // px — top time ruler height (28 ticks + 20 day bar)

// Time ruler label widths (px) — used for skip-label collision avoidance
export const MIN_HOUR_LABEL_WIDTH = 40; // "14:00" at 9px font ≈ 35px + padding
export const MIN_DATE_LABEL_WIDTH = 130; // "Fri 07.03.2026" ≈ 120px + padding

// Node z-indices (render order)
export const Z_HOUR_GRID = 0;
export const Z_LANE_ZONE = 0;
export const Z_DAY_SEPARATOR = 1;
export const Z_SHIFT_BLOCK = 2;
