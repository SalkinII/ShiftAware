'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function TemplateManager() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Shift Templates</h3>
          <p className="text-sm text-gray-500">
            Define reusable shift templates with durations, roles, and capacity
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {showForm && (
        <Card className="p-6 bg-gray-50">
          <h4 className="text-md font-bold text-gray-900 mb-4">Create Template</h4>
          <p className="text-sm text-gray-500">Template creation form will go here</p>
        </Card>
      )}

      <div className="space-y-3">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-gray-900">Mobile Team 1 - Morning</div>
            <div className="text-sm text-gray-500">6 hours • 2 capacity • CORE priority</div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-gray-900">Stationary - Day Shift</div>
            <div className="text-sm text-gray-500">8 hours • 3 capacity • CORE priority</div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
