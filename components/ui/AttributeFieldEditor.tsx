'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';

type AttributeType = 'BOOLEAN' | 'SELECT' | 'MULTISELECT' | 'TEXT';

interface AttributeFieldEditorProps {
  value: {
    name: string;
    label: string;
    type: AttributeType;
    options: string[];
    required: boolean;
  };
  onChange: (value: AttributeFieldEditorProps['value']) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function AttributeFieldEditor({
  value,
  onChange,
  onCancel,
  onSave,
}: AttributeFieldEditorProps) {
  const [newOption, setNewOption] = useState('');

  const handleAddOption = () => {
    if (newOption.trim() && !value.options.includes(newOption.trim())) {
      onChange({
        ...value,
        options: [...value.options, newOption.trim()],
      });
      setNewOption('');
    }
  };

  const handleRemoveOption = (optionToRemove: string) => {
    onChange({
      ...value,
      options: value.options.filter((opt) => opt !== optionToRemove),
    });
  };

  const showOptions = value.type === 'SELECT' || value.type === 'MULTISELECT';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attribute Name
          </label>
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="e.g., can_drive"
          />
          <p className="text-xs text-gray-500 mt-1">
            Internal name (lowercase, underscores)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Display Label
          </label>
          <Input
            value={value.label}
            onChange={(e) => onChange({ ...value, label: e.target.value })}
            placeholder="e.g., Can Drive"
          />
          <p className="text-xs text-gray-500 mt-1">Shown to users</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
          <select
            value={value.type}
            onChange={(e) =>
              onChange({ ...value, type: e.target.value as AttributeType, options: [] })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="BOOLEAN">Boolean (Yes/No)</option>
            <option value="SELECT">Single Select</option>
            <option value="MULTISELECT">Multi Select</option>
            <option value="TEXT">Text</option>
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value.required}
              onChange={(e) => onChange({ ...value, required: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-400"
            />
            <span className="text-sm font-medium text-gray-700">Required field</span>
          </label>
        </div>
      </div>

      {showOptions && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
          <div className="space-y-2">
            {value.options.map((option) => (
              <div
                key={option}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200"
              >
                <span className="flex-1 text-sm text-gray-900">{option}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveOption(option)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            ))}

            <div className="flex gap-2">
              <Input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="Add new option..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddOption();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddOption}
                disabled={!newOption.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t border-gray-200">
        <Button onClick={onSave} disabled={!value.name || !value.label}>
          Save Attribute
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
