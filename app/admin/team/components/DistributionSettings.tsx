'use client';

import { useState } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface AttributeRule {
  id: string;
  shiftType: string;
  attribute: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS';
  value: string;
}

interface DistributionConfig {
  fairnessWeight: number; // 0-100
  preferenceWeight: number; // 0-100
  maxShiftsPerPerson: number;
  minRestHours: number;
  attributeRules: AttributeRule[];
}

export function DistributionSettings() {
  const [config, setConfig] = useState<DistributionConfig>({
    fairnessWeight: 50,
    preferenceWeight: 30,
    maxShiftsPerPerson: 12,
    minRestHours: 8,
    attributeRules: [
      {
        id: '1',
        shiftType: 'EXECUTIVE',
        attribute: 'experience_level',
        operator: 'EQUALS',
        value: 'Senior',
      },
    ],
  });

  const [showAddRule, setShowAddRule] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleWeightChange = (key: 'fairnessWeight' | 'preferenceWeight', value: number) => {
    setConfig({ ...config, [key]: value });
  };

  const handleAddRule = () => {
    const newRule: AttributeRule = {
      id: Date.now().toString(),
      shiftType: 'EXECUTIVE',
      attribute: 'experience_level',
      operator: 'EQUALS',
      value: '',
    };
    setConfig({
      ...config,
      attributeRules: [...config.attributeRules, newRule],
    });
    setShowAddRule(false);
  };

  const handleDeleteRule = (id: string) => {
    setConfig({
      ...config,
      attributeRules: config.attributeRules.filter((rule) => rule.id !== id),
    });
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    // TODO: Call algorithm preview API
    setTimeout(() => {
      alert('Preview would show algorithm results here');
      setPreviewLoading(false);
    }, 1000);
  };

  const handleSave = () => {
    // TODO: Save config via API
    alert('Distribution settings saved');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Distribution Logic</h3>
        <p className="text-sm text-gray-500">
          Configure how the algorithm assigns team members to shifts
        </p>
      </div>

      {/* Weights Section */}
      <Card className="p-6">
        <h4 className="text-md font-bold text-gray-900 mb-4 flex items-center gap-2">
          Algorithm Weights
          <Info className="w-4 h-4 text-gray-400" />
        </h4>

        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Fairness Weight
              </label>
              <span className="text-sm font-bold text-primary-600">
                {config.fairnessWeight}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.fairnessWeight}
              onChange={(e) => handleWeightChange('fairnessWeight', Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              How much to prioritize equal distribution of shifts among team members
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Preference Weight
              </label>
              <span className="text-sm font-bold text-primary-600">
                {config.preferenceWeight}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.preferenceWeight}
              onChange={(e) => handleWeightChange('preferenceWeight', Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              How much to prioritize team member preferences for specific shifts
            </p>
          </div>
        </div>
      </Card>

      {/* Constraints Section */}
      <Card className="p-6">
        <h4 className="text-md font-bold text-gray-900 mb-4">Constraints</h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Shifts per Person
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={config.maxShiftsPerPerson}
              onChange={(e) =>
                setConfig({ ...config, maxShiftsPerPerson: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Rest Hours
            </label>
            <input
              type="number"
              min="0"
              max="24"
              value={config.minRestHours}
              onChange={(e) =>
                setConfig({ ...config, minRestHours: Number(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </Card>

      {/* Attribute Rules Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-bold text-gray-900">Attribute Rules</h4>
          <Button size="sm" onClick={handleAddRule}>
            <Plus className="w-4 h-4 mr-1" />
            Add Rule
          </Button>
        </div>

        <div className="space-y-3">
          {config.attributeRules.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No attribute rules defined. Click "Add Rule" to create one.
            </p>
          ) : (
            config.attributeRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-200"
              >
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <select
                    value={rule.shiftType}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="EXECUTIVE">Executive</option>
                    <option value="MOBILE_TEAM_1">Mobile Team 1</option>
                    <option value="MOBILE_TEAM_2">Mobile Team 2</option>
                    <option value="STATIONARY">Stationary</option>
                  </select>

                  <select
                    value={rule.attribute}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="experience_level">Experience Level</option>
                    <option value="can_drive">Can Drive</option>
                  </select>

                  <select
                    value={rule.operator}
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="EQUALS">Equals</option>
                    <option value="NOT_EQUALS">Not Equals</option>
                    <option value="CONTAINS">Contains</option>
                  </select>

                  <input
                    type="text"
                    value={rule.value}
                    placeholder="Value..."
                    className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteRule(rule.id)}
                >
                  <Trash2 className="w-4 h-4 text-error-600" />
                </Button>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Example: "EXECUTIVE requires experience_level = Senior" ensures only senior members
          are assigned to executive shifts.
        </p>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} variant="primary">
          Save Configuration
        </Button>
        <Button onClick={handlePreview} variant="secondary" disabled={previewLoading}>
          {previewLoading ? 'Previewing...' : 'Preview Results'}
        </Button>
      </div>
    </div>
  );
}
