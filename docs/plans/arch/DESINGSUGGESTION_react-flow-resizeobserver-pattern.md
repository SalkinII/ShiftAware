# React Flow: Dynamic Content Fitting with ResizeObserver

## Pattern Summary

Use `ResizeObserver` inside custom React Flow nodes to measure available content width and dynamically control how many child elements (chips, tags, attributes) are rendered horizontally. This is the most robust approach because it works independently of zoom level and responds to node resizing automatically.

## Core Implementation

```jsx
import { memo, useRef, useState, useEffect, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';

const CHIP_MIN_WIDTH = 100; // px per item including internal padding
const CHIP_GAP = 8;         // gap between items in px

function LaneNode({ id, data }) {
  const containerRef = useRef(null);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      setContentWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visibleCount = useMemo(() => {
    if (!contentWidth) return data.attributes.length; // show all until measured
    return Math.max(1, Math.floor(contentWidth / (CHIP_MIN_WIDTH + CHIP_GAP)));
  }, [contentWidth, data.attributes.length]);

  const visible = data.attributes.slice(0, visibleCount);
  const overflow = data.attributes.length - visibleCount;

  return (
    <div
      ref={containerRef}
      style={{ minWidth: 300 }}
      className="bg-white border border-gray-200 rounded-lg shadow-sm p-4"
    >
      <div className="text-xs font-semibold text-gray-500 mb-2">
        {data.label}
      </div>

      <div className="flex gap-2 overflow-hidden">
        {visible.map((attr) => (
          <span
            key={attr.id}
            className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs truncate"
            style={{ minWidth: CHIP_MIN_WIDTH, maxWidth: CHIP_MIN_WIDTH }}
          >
            {attr.label}
          </span>
        ))}
        {overflow > 0 && (
          <span className="px-2 py-1 text-gray-400 text-xs whitespace-nowrap">
            +{overflow}
          </span>
        ))}
      </div>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(LaneNode);
```

## Registration

```jsx
const nodeTypes = useMemo(() => ({ lane: LaneNode }), []);

<ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} />
```

## Node Data Shape

```js
{
  id: 'lane-1',
  type: 'lane',
  position: { x: 0, y: 0 },
  data: {
    label: 'Mobile Team A',
    attributes: [
      { id: 'a1', label: 'Setup' },
      { id: 'a2', label: 'Teardown' },
      { id: 'a3', label: 'Monitoring' },
      // ...
    ],
  },
}
```

## Key Design Decisions

### Why `contentRect.width`

`ResizeObserver` provides both `contentRect` and `borderBoxSize`. Use `contentRect.width` because it excludes padding — giving you the exact space available for laying out children.

### Why `memo`

React Flow re-renders nodes on drag, selection, and viewport changes. Wrapping with `memo` ensures the component only re-renders when `data` or `id` change. The `ResizeObserver` operates independently via its own callback, avoiding render loops.

### Initial Frame Behavior

`contentWidth` starts at `0`, so the fallback shows all attributes on the first frame. The observer fires immediately after mount and corrects the count. If a flash is visible, either:

- Default to a conservative `visibleCount` (e.g., `3`)
- Set `visibility: hidden` on the flex container until `contentWidth > 0`

### Works With `NodeResizer`

If using `@xyflow/react`'s `NodeResizer` or `NodeResizeControl`, the observer automatically picks up user-driven resizes with no extra wiring.

## Optional: Zoom-Adaptive Density

Combine with `useStore` to change rendering mode at different zoom levels:

```jsx
import { useStore } from '@xyflow/react';

const zoom = useStore((s) => s.transform[2]);
const mode = zoom < 0.5 ? 'dots' : zoom < 1 ? 'compact' : 'full';
```

- **dots**: colored circles only (minimal paint at low zoom)
- **compact**: truncated labels, smaller chips
- **full**: full labels with overflow indicator

## Optional: `useStore` Alternative for Node Width

If you need the node's measured width from outside the node component:

```jsx
const nodeWidth = useStore((state) => {
  const node = state.nodeLookup.get(id);
  return node?.measured?.width ?? 600;
});
```

Use narrow selectors (return only primitives) to avoid unnecessary re-renders.

## Constraints and Tuning

| Parameter        | Default | Notes                                      |
| ---------------- | ------- | ------------------------------------------ |
| `CHIP_MIN_WIDTH` | 100px   | Adjust based on label length distribution  |
| `CHIP_GAP`       | 8px     | Must match Tailwind `gap-2` (0.5rem = 8px) |
| `minWidth`       | 300px   | Minimum node width to prevent collapse     |

For variable-width chips, measure each chip individually using a hidden render pass or predefined width estimates per label length.
