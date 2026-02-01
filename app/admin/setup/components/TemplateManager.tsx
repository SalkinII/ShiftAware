'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { unwrapApiResponse } from '@/lib/api-errors';

interface ShiftTemplate {
  id: string;
  name: string;
  type: string;
  durationMinutes: number;
  startTime: string;
  priority: string;
  capacity: number;
  color?: string;
}

export function TemplateManager() {
  const toast = useToast();
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'MOBILE_TEAM_1',
    durationMinutes: 360,
    startTime: '08:00',
    priority: 'CORE',
    capacity: 2,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const res = await fetch('/api/shifts/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(unwrapApiResponse<ShiftTemplate[]>(data) || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleStartNew() {
    setEditingId('new');
    setFormData({
      name: '',
      type: 'MOBILE_TEAM_1',
      durationMinutes: 360,
      startTime: '08:00',
      priority: 'CORE',
      capacity: 2,
    });
  }

  function handleStartEdit(template: ShiftTemplate) {
    setEditingId(template.id);
    setFormData({
      name: template.name,
      type: template.type,
      durationMinutes: template.durationMinutes,
      startTime: template.startTime,
      priority: template.priority,
      capacity: template.capacity,
    });
  }

  function handleCancel() {
    setEditingId(null);
  }

  async function handleSave() {
    if (!formData.name) {
      toast.error('Template name is required');
      return;
    }

    const payload = {
      ...formData,
      requiredRoles: [{ role: 'TEAM_MEMBER', count: formData.capacity }],
    };

    try {
      const url = editingId === 'new'
        ? '/api/shifts/templates'
        : `/api/shifts/templates/${editingId}`;

      const method = editingId === 'new' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingId === 'new' ? 'Template created' : 'Template updated');
        loadTemplates();
        handleCancel();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to save template');
      }
    } catch (error) {
      toast.error('Failed to save template');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;

    try {
      const res = await fetch(`/api/shifts/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Template deleted');
        loadTemplates();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Failed to delete template');
      }
    } catch (error) {
      toast.error('Failed to delete template');
    }
  }

  if (loading) {
    return <div className="text-gray-500">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Shift Templates</h3>
          <p className="text-sm text-gray-500">
            Define reusable shift templates for drag-and-drop scheduling
          </p>
        </div>
        {!editingId && (
          <Button onClick={handleStartNew}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        )}
      </div>

      {editingId && (
        <Card className="p-6 bg-gray-50">
          <h4 className="text-md font-bold text-gray-900 mb-4">
            {editingId === 'new' ? 'Create Template' : 'Edit Template'}
          </h4>
          <div className="space-y-4">
            <Input
              label="Template Name"
              placeholder="e.g., Mobile Team 1 - Morning"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Shift Type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="MOBILE_TEAM_1">Mobile Team 1</option>
                <option value="MOBILE_TEAM_2">Mobile Team 2</option>
                <option value="STATIONARY">Stationary</option>
                <option value="EXECUTIVE">Executive</option>
              </Select>
              <Select
                label="Priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="CORE">Core</option>
                <option value="BUFFER">Buffer</option>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Start Time"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
              <Input
                label="Duration (hours)"
                type="number"
                min="1"
                max="24"
                value={formData.durationMinutes / 60}
                onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) * 60 || 60 })}
              />
              <Input
                label="Capacity"
                type="number"
                min="1"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={handleCancel}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {templates.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">No templates yet. Create one to get started.</p>
          </Card>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="font-bold text-gray-900">{template.name}</div>
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {template.startTime} ({template.durationMinutes / 60}h)
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {template.capacity} people
                  </span>
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                    {template.priority}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleStartEdit(template)} disabled={!!editingId}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)} disabled={!!editingId}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
