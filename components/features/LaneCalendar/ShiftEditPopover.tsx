'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Popover } from '@/components/ui/Popover';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Trash2 } from 'lucide-react';

interface ShiftEditPopoverProps {
  shift: {
    id: string;
    startTime: string;
    endTime: string;
    capacity: number;
  };
  onSave: (updates: { startTime?: Date; endTime?: Date; capacity?: number }) => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export function ShiftEditPopover({ shift, onSave, onDelete, children }: ShiftEditPopoverProps) {
  const [startTime, setStartTime] = useState(format(new Date(shift.startTime), 'HH:mm'));
  const [endTime, setEndTime] = useState(format(new Date(shift.endTime), 'HH:mm'));
  const [capacity, setCapacity] = useState(shift.capacity);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const newStart = new Date(shift.startTime);
    newStart.setHours(startH, startM, 0, 0);

    const newEnd = new Date(shift.endTime);
    newEnd.setHours(endH, endM, 0, 0);

    onSave({ startTime: newStart, endTime: newEnd, capacity });
    setOpen(false);
  };

  const handleDelete = () => {
    onDelete();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      content={
        <div className="w-64 p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Start Time
            </label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              End Time
            </label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Capacity
            </label>
            <Input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      }
    >
      {children}
    </Popover>
  );
}
