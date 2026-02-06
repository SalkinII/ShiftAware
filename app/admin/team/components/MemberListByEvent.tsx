"use client";

import { useState, useEffect } from "react";
import { Plus, UserMinus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { unwrapApiResponse } from "@/lib/api-errors";

interface Member {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel: string;
  eventRegistrations?: { status: string }[];
}

interface MemberListByEventProps {
  eventId: string;
  eventName: string;
}

export function MemberListByEvent({
  eventId,
  eventName,
}: MemberListByEventProps) {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadMembers();
  }, [eventId]);

  async function loadMembers() {
    setLoading(true);
    try {
      // Load registered members
      const res = await fetch(`/api/members?eventId=${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(unwrapApiResponse<Member[]>(data) || []);
      }

      // Load all members for add picker
      const allRes = await fetch(
        `/api/members?eventId=${eventId}&includeUnregistered=true`,
      );
      if (allRes.ok) {
        const data = await allRes.json();
        setAllMembers(unwrapApiResponse<Member[]>(data) || []);
      }
    } catch (error) {
      console.error("Failed to load members:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(memberId: string) {
    try {
      const res = await fetch(`/api/events/${eventId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });

      if (res.ok) {
        toast.success("Member added to event");
        loadMembers();
        setShowAddPicker(false);
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to add member");
      }
    } catch (error) {
      toast.error("Failed to add member");
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (
      !confirm(
        "Remove this member from the event? Their shifts will be unassigned.",
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/events/${eventId}/registrations/${memberId}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        toast.success("Member removed from event");
        loadMembers();
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to remove member");
      }
    } catch (error) {
      toast.error("Failed to remove member");
    }
  }

  const unregisteredMembers = allMembers.filter(
    (m) => !m.eventRegistrations || m.eventRegistrations.length === 0,
  );

  const filteredMembers = members.filter((m) =>
    m.alias.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return <div className="text-gray-500">Loading members...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Team Members for {eventName}
          </h3>
          <p className="text-sm text-gray-500">
            {members.length} members registered
          </p>
        </div>
        <Button onClick={() => setShowAddPicker(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Existing Member
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-3">
        {filteredMembers.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            No members registered for this event yet
          </Card>
        ) : (
          filteredMembers.map((member) => (
            <Card
              key={member.id}
              className="p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{member.avatarId}</span>
                <div>
                  <div className="font-bold text-gray-900">{member.alias}</div>
                  <div className="text-sm text-gray-500">
                    {member.experienceLevel}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveMember(member.id)}
                className="text-red-600 hover:bg-red-50"
              >
                <UserMinus className="w-4 h-4" />
              </Button>
            </Card>
          ))
        )}
      </div>

      {/* Add Member Picker Modal */}
      {showAddPicker && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-white p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Add Existing Member
            </h3>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {allMembers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No members exist yet. Create members first.
                </p>
              ) : unregisteredMembers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  All members are already registered for this event
                </p>
              ) : (
                unregisteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleAddMember(member.id)}
                    className="w-full p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all flex items-center gap-3 text-left"
                  >
                    <span className="text-2xl">{member.avatarId}</span>
                    <div>
                      <div className="font-medium text-gray-900">
                        {member.alias}
                      </div>
                      <div className="text-xs text-gray-500">
                        {member.experienceLevel}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="secondary"
                onClick={() => setShowAddPicker(false)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
