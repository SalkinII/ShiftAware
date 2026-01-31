'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, ThumbsUp, ThumbsDown, ArrowLeftRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Assignment {
  id: string;
  role: string;
  assignmentType: string;
  teamMember: { id: string; alias: string; avatarId: string };
}

interface Shift {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  priority: string;
  capacity: number;
  assignments: Assignment[];
  event: { name: string; id: string };
}

interface MyShiftsListProps {
  shifts: Shift[];
  userId: string;
  onVoteWant: (shiftId: string) => void;
  onVoteDontWant: (shiftId: string) => void;
  onRequestSwap: (assignmentId: string) => void;
}

export function MyShiftsList({
  shifts,
  userId,
  onVoteWant,
  onVoteDontWant,
  onRequestSwap,
}: MyShiftsListProps) {
  // Filter shifts to only show user's assignments
  const myShifts = useMemo(() => {
    return shifts
      .filter((shift) =>
        shift.assignments.some((a) => a.teamMember.id === userId)
      )
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [shifts, userId]);

  // Get user's assignment for a shift
  const getUserAssignment = (shift: Shift) => {
    return shift.assignments.find((a) => a.teamMember.id === userId);
  };

  if (myShifts.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Shifts Assigned</h3>
        <p className="text-gray-500">
          You don't have any shifts assigned yet. Check back later or contact your shift lead.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {myShifts.map((shift) => {
        const assignment = getUserAssignment(shift);
        const isAssigned = !!assignment;

        return (
          <Card
            key={shift.id}
            className="p-6 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {shift.type.replace(/_/g, ' ')}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(shift.startTime), 'EEE, dd.MM.yyyy')}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {format(new Date(shift.startTime), 'HH:mm')} -{' '}
                        {format(new Date(shift.endTime), 'HH:mm')}
                      </div>
                    </div>
                  </div>
                  {assignment && (
                    <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-primary-100 text-primary-700">
                      {assignment.role}
                    </span>
                  )}
                </div>

                {/* Inline Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  {isAssigned ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => assignment && onRequestSwap(assignment.id)}
                        className="text-xs"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 mr-1.5" />
                        Request Swap
                      </Button>
                      <span className="text-xs text-gray-400 ml-auto">
                        Assigned as {assignment.assignmentType}
                      </span>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onVoteWant(shift.id)}
                        className={cn(
                          'text-xs',
                          'hover:bg-green-50 hover:text-green-700 hover:border-green-200'
                        )}
                      >
                        <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                        I Want This
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onVoteDontWant(shift.id)}
                        className={cn(
                          'text-xs',
                          'hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                        )}
                      >
                        <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                        I Don't Want This
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
