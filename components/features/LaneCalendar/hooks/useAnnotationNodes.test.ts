/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnnotationNodes } from './useAnnotationNodes';
import type { LaneConfig } from '@/lib/types/lane';

describe('useAnnotationNodes', () => {
  const eventStart = new Date('2026-06-26T00:00:00Z');
  const lanes: LaneConfig[] = [
    {
      id: 'tpl-1',
      templateId: 'tpl-1',
      label: 'Morning Shift',
      color: '#0ea5e9',
      order: 1,
      type: 'MOBILE_TEAM',
    },
  ];

  it('generates annotation nodes for each shift', () => {
    const shifts = [
      {
        id: 'shift-1',
        type: 'MOBILE_TEAM',
        startTime: '2026-06-26T08:00:00Z',
        endTime: '2026-06-26T16:00:00Z',
        capacity: 5,
        templateId: 'tpl-1',
        assignments: [{ teamMember: { alias: 'John', avatarId: 'a1' } }],
      },
    ];

    const { result } = renderHook(() =>
      useAnnotationNodes(shifts as any, lanes, eventStart, 0.5),
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('annotation-shift-1');
    expect(result.current[0].data.shiftName).toBe('Morning Shift');
    expect(result.current[0].data.timeLabel).toMatch(/^\d{2}:\d{2} - \d{2}:\d{2}$/);
    expect(result.current[0].data.assignmentCount).toBe(1);
  });
});
