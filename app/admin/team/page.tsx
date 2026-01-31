'use client';

import { useState } from 'react';
import { Users, Zap } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

type TabType = 'members' | 'allocation';

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<TabType>('members');

  const tabs = [
    { id: 'members' as TabType, label: 'Team Members', icon: Users },
    { id: 'allocation' as TabType, label: 'Allocation & Distribution', icon: Zap },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Team Management</h1>
        <p className="text-gray-500 font-medium">
          Manage team members and configure shift allocation settings
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 pb-4 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="py-6">
        {activeTab === 'members' && (
          <Card className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Team Members</h2>
            <p className="text-gray-500">
              Team member management (from /admin/team/manage) will be displayed here.
              Add, edit, and manage team member profiles and attributes.
            </p>
          </Card>
        )}

        {activeTab === 'allocation' && (
          <Card className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Allocation & Distribution Settings
            </h2>
            <p className="text-gray-500 mb-6">
              Configure shift allocation algorithm settings, distribution weights, and
              fairness parameters. Run the allocation algorithm and publish assignments.
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-bold text-gray-900 mb-2">Distribution Weights</h3>
                <div className="text-sm text-gray-500">
                  Adjust how much the algorithm prioritizes fairness vs. preferences
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-bold text-gray-900 mb-2">Allocation Status</h3>
                <div className="text-sm text-gray-500">
                  View current allocation status and publish assignments to team members
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
