'use client';

import { useState } from 'react';
import { Info, X, TrendingUp, Heart, Shield, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface AllocationLogicPopoverProps {
  trigger?: React.ReactNode;
}

export function AllocationLogicPopover({ trigger }: AllocationLogicPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {trigger ? (
        <div onClick={() => setIsOpen(true)}>{trigger}</div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <Info className="w-4 h-4" />
          How does allocation work?
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="max-w-2xl w-full bg-white shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-2">How Shift Allocation Works</h3>
                  <p className="text-primary-100 text-sm">
                    Understanding the algorithm behind your shift assignments
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Overview */}
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-3">The Algorithm</h4>
                <p className="text-gray-700 leading-relaxed">
                  ShiftAware uses a weighted scoring algorithm to assign team members to shifts.
                  The system balances multiple factors to create fair, efficient, and
                  preference-aware schedules.
                </p>
              </div>

              {/* Factors */}
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-gray-900">Key Factors</h4>

                <Card className="p-4 border-l-4 border-l-primary-500">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-bold text-gray-900 mb-1">Fairness (Balance)</h5>
                      <p className="text-sm text-gray-600">
                        Ensures shifts are distributed evenly among team members. Prevents
                        anyone from being overworked or underutilized.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border-l-4 border-l-pink-500">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-pink-100 rounded-lg">
                      <Heart className="w-5 h-5 text-pink-600" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-bold text-gray-900 mb-1">Preferences</h5>
                      <p className="text-sm text-gray-600">
                        Takes your shift preferences into account. Your "I want" votes increase
                        your chances of getting those shifts.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border-l-4 border-l-purple-500">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Shield className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-bold text-gray-900 mb-1">Requirements</h5>
                      <p className="text-sm text-gray-600">
                        Enforces shift requirements like experience level, capabilities (shift
                        lead, driver), and minimum rest periods between shifts.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border-l-4 border-l-green-500">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Users className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-bold text-gray-900 mb-1">Team Composition</h5>
                      <p className="text-sm text-gray-600">
                        Balances teams by mixing experience levels and ensuring each shift has
                        the required roles (leads, members, specialists).
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* How Scoring Works */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-bold text-gray-900 mb-3">How Scoring Works</h4>
                <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                  <li>Each team member gets a score for each available shift</li>
                  <li>Higher scores = better fit for that shift</li>
                  <li>
                    The algorithm assigns shifts to maximize total score while respecting
                    constraints
                  </li>
                  <li>Manual assignments override algorithmic suggestions</li>
                </ol>
              </div>

              {/* Tips */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-md font-bold text-gray-900 mb-3">💡 Tips</h4>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>
                    <strong>Vote early:</strong> Submit your preferences as soon as voting
                    opens
                  </li>
                  <li>
                    <strong>Be specific:</strong> Only vote for shifts you genuinely prefer
                  </li>
                  <li>
                    <strong>Check requirements:</strong> You'll only be assigned to shifts you
                    qualify for
                  </li>
                  <li>
                    <strong>Request swaps:</strong> If you need changes after assignment, use
                    the swap feature
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <Button onClick={() => setIsOpen(false)} variant="primary" className="w-full">
                Got it!
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
