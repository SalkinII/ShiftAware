'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface CreateProfileFormProps {
  onSubmit: (profileData: ProfileData) => void;
}

interface ProfileData {
  alias: string;
  experienceLevel: string;
  capabilities: string[];
  attributes: Record<string, any>;
}

const EXPERIENCE_LEVELS = [
  { value: 'NEWBIE', label: 'Newbie' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'EXPERIENCED', label: 'Experienced' },
  { value: 'VETERAN', label: 'Veteran' },
];

const CAPABILITIES = [
  { value: 'SHIFT_LEAD', label: 'Shift Lead' },
  { value: 'DRIVER', label: 'Driver' },
  { value: 'FIRST_AID', label: 'First Aid' },
];

export function CreateProfileForm({ onSubmit }: CreateProfileFormProps) {
  const [formData, setFormData] = useState<ProfileData>({
    alias: '',
    experienceLevel: 'NEWBIE',
    capabilities: [],
    attributes: {},
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const toggleCapability = (capability: string) => {
    setFormData((prev) => ({
      ...prev,
      capabilities: prev.capabilities.includes(capability)
        ? prev.capabilities.filter((c) => c !== capability)
        : [...prev.capabilities, capability],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="alias" className="block text-sm font-medium text-gray-700 mb-2">
          Display Name (Alias)
        </label>
        <Input
          id="alias"
          type="text"
          value={formData.alias}
          onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
          placeholder="Enter your preferred name"
          required
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          This is how you'll appear in the shift calendar
        </p>
      </div>

      <div>
        <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-700 mb-2">
          Experience Level
        </label>
        <select
          id="experienceLevel"
          value={formData.experienceLevel}
          onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {EXPERIENCE_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Capabilities
        </label>
        <div className="space-y-2">
          {CAPABILITIES.map((capability) => (
            <label
              key={capability.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={formData.capabilities.includes(capability.value)}
                onChange={() => toggleCapability(capability.value)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">{capability.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <Button type="submit" variant="primary" className="w-full">
          Create Profile
        </Button>
      </div>
    </form>
  );
}
