'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';

export function FestivalSettings() {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Event Configuration</h3>
        <p className="text-sm text-gray-500">
          Manage event dates, buffer days, and assignment settings
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Event Name" placeholder="e.g., Summer Festival 2026" />
          <Select label="Status">
            <option value="PLANNING">Planning</option>
            <option value="OPEN_FOR_PREFERENCES">Open for Preferences</option>
            <option value="ASSIGNING">Assigning</option>
            <option value="FINALIZED">Finalized</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Start Date" type="date" />
          <Input label="End Date" type="date" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Buffer Days Before" type="number" min="0" defaultValue="7" />
          <Input label="Buffer Days After" type="number" min="0" defaultValue="3" />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button>Save Event Settings</Button>
      </div>
    </div>
  );
}
