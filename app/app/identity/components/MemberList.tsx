'use client';

import { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: string;
  capabilities: string[];
  isActive: boolean;
}

interface MemberListProps {
  onSelectMember: (memberId: string) => void;
}

export function MemberList({ onSelectMember }: MemberListProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    try {
      const res = await fetch('/api/members');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-16 bg-gray-200 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {members.map((member) => (
        <div
          key={member.id}
          onClick={() => member.isActive && onSelectMember(member.id)}
          className={cn(
            member.isActive ? 'cursor-pointer' : 'cursor-not-allowed'
          )}
        >
          <Card
            className={cn(
              'p-4 transition-all hover:shadow-md hover:scale-[1.02]',
              member.isActive
                ? 'border-2 border-transparent hover:border-primary-300'
                : 'opacity-50'
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-2xl">
                {member.avatarId || '👤'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">{member.alias}</h3>
                  {member.capabilities.includes('SHIFT_LEAD') && (
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded font-bold">
                      LEAD
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{member.experienceLevel}</p>
              </div>
              {member.isActive && <CheckCircle className="w-5 h-5 text-primary-600" />}
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}
