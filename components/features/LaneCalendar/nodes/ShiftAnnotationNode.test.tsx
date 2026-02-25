/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShiftAnnotationNode } from './ShiftAnnotationNode';
import type { NodeProps } from '@xyflow/react';

describe('ShiftAnnotationNode', () => {
  it('renders time, name, and assignment count', () => {
    const mockData = {
      timeLabel: '08:00 - 16:00',
      shiftName: 'Morning Shift',
      assignmentCount: 3,
      capacity: 5,
      assignedMembers: [
        { alias: 'John', avatarId: 'avatar1' },
        { alias: 'Mary', avatarId: 'avatar2' }
      ],
      desirabilityScore: 4.2,
      color: '#0ea5e9',
      parentShiftId: 'shift-1'
    };

    const props: Partial<NodeProps> = {
      id: 'annotation-1',
      data: mockData,
      position: { x: 0, y: 0 },
      type: 'shiftAnnotation'
    };

    render(<ShiftAnnotationNode {...(props as NodeProps)} />);

    expect(screen.getByText('08:00 - 16:00')).toBeInTheDocument();
    expect(screen.getByText('Morning Shift')).toBeInTheDocument();
    expect(screen.getByText(/3\/5/)).toBeInTheDocument();
    expect(screen.getByText(/John/)).toBeInTheDocument();
  });
});
