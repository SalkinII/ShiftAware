'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';

interface AttributeDefinition {
  id: string;
  name: string;
  label: string;
  type: 'BOOLEAN' | 'SELECT' | 'MULTISELECT' | 'TEXT';
  options: string[];
  required: boolean;
}

export function AttributeDefinitions() {
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([
    {
      id: '1',
      name: 'can_drive',
      label: 'Can Drive',
      type: 'BOOLEAN',
      options: [],
      required: false,
    },
    {
      id: '2',
      name: 'experience_level',
      label: 'Experience Level',
      type: 'SELECT',
      options: ['Junior', 'Intermediate', 'Senior'],
      required: true,
    },
  ]);

  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Dynamic Attributes</h3>
          <p className="text-sm text-gray-500">
            Define custom attributes for team members. These can be used for filtering and
            assignment logic.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Attribute
        </Button>
      </div>

      {showForm && (
        <Card className="p-6 bg-gray-50 space-y-4">
          <h4 className="text-md font-bold text-gray-900">New Attribute</h4>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Attribute Name" placeholder="e.g., can_drive" />
            <Input label="Display Label" placeholder="e.g., Can Drive" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type">
              <option value="BOOLEAN">Boolean (Yes/No)</option>
              <option value="SELECT">Single Select</option>
              <option value="MULTISELECT">Multi Select</option>
              <option value="TEXT">Text</option>
            </Select>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                <span className="text-sm font-medium text-gray-700">Required</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button size="sm">Create Attribute</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {attributes.map((attr) => (
          <Card key={attr.id} className="p-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">{attr.label}</span>
                {attr.required && (
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded font-bold">
                    REQUIRED
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {attr.name} • {attr.type}
                {attr.options.length > 0 && ` • Options: ${attr.options.join(', ')}`}
              </div>
            </div>
            <Button variant="ghost" size="sm">
              <Trash2 className="w-4 h-4 text-error-600" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
