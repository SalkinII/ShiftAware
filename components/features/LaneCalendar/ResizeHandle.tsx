'use client';

import { useCallback, useRef } from 'react';

interface ResizeHandleProps {
  position: 'left' | 'right';
  onResize: (deltaMinutes: number) => void;
  onResizeEnd: () => void;
  pixelsPerMinute: number;
}

export function ResizeHandle({ position, onResize, onResizeEnd, pixelsPerMinute }: ResizeHandleProps) {
  const startX = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    startX.current = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX.current;
      const deltaMinutes = Math.round(deltaX / pixelsPerMinute);
      if (deltaMinutes !== 0) {
        onResize(position === 'left' ? -deltaMinutes : deltaMinutes);
        startX.current = moveEvent.clientX;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onResizeEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize, onResizeEnd, pixelsPerMinute, position]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`absolute top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-10 ${
        position === 'left' ? 'left-0' : 'right-0'
      }`}
    />
  );
}
