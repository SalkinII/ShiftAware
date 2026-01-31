'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AttributeFieldEditor } from '@/components/ui/AttributeFieldEditor';

interface AttributeDefinition {
  id: string;
  name: string;
  label: string;
  type: 'BOOLEAN' | 'SELECT' | 'MULTISELECT' | 'TEXT';
  options: string[];
  required: boolean;
}

const emptyAttribute: Omit<AttributeDefinition, 'id'> = {
  name: '',
  label: '',
  type: 'BOOLEAN',
  options: [],
  required: false,
};

export function AttributeDefinitions() {
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [formData, setFormData] = useState<Omit<AttributeDefinition, 'id'>>(emptyAttribute);

  // TODO: Load attributes from API
  useEffect(() => {
    // Simulated API load - replace with actual API call
    setAttributes([
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
        name: 'shift_preference',
        label: 'Shift Preference',
        type: 'SELECT',
        options: ['Morning', 'Afternoon', 'Evening', 'Night'],
        required: false,
      },
    ]);
    setLoading(false);
  }, []);

  const handleStartEdit = (attr: AttributeDefinition) => {
    setEditingId(attr.id);
    setFormData({
      name: attr.name,
      label: attr.label,
      type: attr.type,
      options: [...attr.options],
      required: attr.required,
    });
  };

  const handleStartNew = () => {
    setEditingId('new');
    setFormData(emptyAttribute);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData(emptyAttribute);
  };

  const handleSave = () => {
    if (editingId === 'new') {
      // TODO: Create attribute via API
      const newAttr: AttributeDefinition = {
        id: Date.now().toString(),
        ...formData,
      };
      setAttributes([...attributes, newAttr]);
    } else if (editingId) {
      // TODO: Update attribute via API
      setAttributes(
        attributes.map((attr) =>
          attr.id === editingId ? { id: attr.id, ...formData } : attr
        )
      );
    }
    handleCancel();
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this attribute? This will remove it from all team members.')) {
      // TODO: Delete attribute via API
      setAttributes(attributes.filter((attr) => attr.id !== id));
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading attributes...</div>;
  }

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
        {!editingId && (
          <Button onClick={handleStartNew}>
            <Plus className="w-4 h-4 mr-2" />
            Add Attribute
          </Button>
        )}
      </div>

      {editingId && (
        <Card className="p-6 bg-gray-50">
          <h4 className="text-md font-bold text-gray-900 mb-4">
            {editingId === 'new' ? 'New Attribute' : 'Edit Attribute'}
          </h4>
          <AttributeFieldEditor
            value={formData}
            onChange={setFormData}
            onCancel={handleCancel}
            onSave={handleSave}
          />
        </Card>
      )}

      <div className="space-y-3">
        {attributes.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">
              No custom attributes defined yet. Click "Add Attribute" to create one.
            </p>
          </Card>
        ) : (
          attributes.map((attr) => (
            <Card key={attr.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900">{attr.label}</span>
                  {attr.required && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded font-bold">
                      REQUIRED
                    </span>
                  )}
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                    {attr.type}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{attr.name}</code>
                  {attr.options.length > 0 && (
                    <span className="ml-2">• {attr.options.join(', ')}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStartEdit(attr)}
                  disabled={!!editingId}
                >
                  <Edit className="w-4 h-4 text-primary-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(attr.id)}
                  disabled={!!editingId}
                >
                  <Trash2 className="w-4 h-4 text-error-600" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
