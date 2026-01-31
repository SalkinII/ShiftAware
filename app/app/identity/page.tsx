'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MemberList } from './components/MemberList';
import { CreateProfileForm } from './components/CreateProfileForm';

export default function IdentityPage() {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleSelectMember = (memberId: string) => {
    // Store selected identity in localStorage or session
    localStorage.setItem('selectedMemberId', memberId);
    router.push('/app/calendar');
  };

  const handleCreateProfile = (profileData: any) => {
    // In a real app, this would create the profile via API
    console.log('Creating profile:', profileData);
    router.push('/app/calendar');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Your Identity</h1>
          <p className="text-gray-500">
            Choose your profile to view your shifts and preferences
          </p>
        </div>

        {!showCreateForm ? (
          <div className="space-y-4">
            <MemberList onSelectMember={handleSelectMember} />

            <Card className="p-6 text-center border-2 border-dashed border-gray-300 hover:border-primary-400 transition-colors">
              <Button
                variant="ghost"
                onClick={() => setShowCreateForm(true)}
                className="w-full"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Profile
              </Button>
            </Card>
          </div>
        ) : (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Create New Profile</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
            <CreateProfileForm onSubmit={handleCreateProfile} />
          </Card>
        )}
      </div>
    </div>
  );
}
