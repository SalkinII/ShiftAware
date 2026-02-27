"use client";

import { useState, useEffect } from "react";
import { Plus, UserMinus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { unwrapApiResponse } from "@/lib/api-errors";
import { ProfileDetailCard } from "@/components/features/Identity/ProfileDetailCard";

interface Member {
  id: string;
  alias: string;
  avatarId: string;
  experienceLevel?: string;
  capabilities?: string[];
  eventRegistrations?: { status: string }[];
  attributes?: Array<{
    definition?: { name?: string };
    name?: string;
    value: string;
  }>;
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
  const [attributeDefinitions, setAttributeDefinitions] = useState<
    Array<{
      id: string;
      name: string;
      label: string;
      type: "BOOLEAN" | "SELECT" | "MULTISELECT" | "TEXT";
      required: boolean;
      options?: string[];
    }>
  >([]);
  const [pendingAttributeMember, setPendingAttributeMember] = useState<{
    memberId: string;
    alias: string;
  } | null>(null);
  const [attributeValues, setAttributeValues] = useState<Record<string, any>>(
    {},
  );
  const [savingAttributes, setSavingAttributes] = useState(false);
  const [profileCardMember, setProfileCardMember] = useState<{
    alias: string;
    avatarId: string;
    experienceLevel?: string;
    capabilities?: string[];
    attributes?: { name: string; value: string }[];
  } | null>(null);

  useEffect(() => {
    loadMembers();
  }, [eventId]);

  useEffect(() => {
    async function loadAttributeDefinitions() {
      try {
        const res = await fetch(`/api/events/${eventId}/attributes`);
        if (res.ok) {
          const data = await res.json();
          setAttributeDefinitions(data.data || []);
        }
      } catch (error) {
        console.error("Failed to load attribute definitions:", error);
      }
    }
    loadAttributeDefinitions();
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

  async function handleAddMember(memberId: string, memberAlias: string) {
    try {
      const res = await fetch(`/api/events/${eventId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });

      if (res.ok) {
        toast.success("Member added to event");
        setShowAddPicker(false);
        if (attributeDefinitions.length > 0) {
          setPendingAttributeMember({ memberId, alias: memberAlias });
          setAttributeValues({});
        } else {
          loadMembers();
        }
      } else {
        const error = await res.json();
        toast.error(error.message || "Failed to add member");
      }
    } catch (error) {
      toast.error("Failed to add member");
    }
  }

  async function handleSaveAttributes() {
    if (!pendingAttributeMember) return;
    setSavingAttributes(true);
    try {
      await Promise.all(
        Object.entries(attributeValues).map(([key, value]) =>
          fetch(
            `/api/members/${pendingAttributeMember.memberId}/attributes`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventId, key, value }),
            },
          ),
        ),
      );
      toast.success("Attributes saved");
    } catch {
      toast.error("Failed to save some attributes");
    } finally {
      setSavingAttributes(false);
      setPendingAttributeMember(null);
      setAttributeValues({});
      loadMembers();
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
                <button
                  onClick={() =>
                    setProfileCardMember({
                      alias: member.alias,
                      avatarId: member.avatarId,
                      experienceLevel: member.experienceLevel,
                      capabilities: member.capabilities,
                      attributes: member.attributes?.map((a) => {
                        const name = a.definition?.name || (a as { name?: string }).name || "Unknown";
                        let val: string;
                        try {
                          const v = typeof a.value === "string" ? JSON.parse(a.value) : a.value;
                          val = typeof v === "boolean" ? String(v) : String(v);
                        } catch {
                          val = String(a.value);
                        }
                        return { name, value: val };
                      })
                    })
                  }
                  className="text-2xl cursor-pointer"
                  title={`View ${member.alias}'s profile`}
                >
                  {member.avatarId}
                </button>
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
                    onClick={() => handleAddMember(member.id, member.alias)}
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

      {/* Attribute Prompt Modal */}
      {pendingAttributeMember && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-white p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Event Attributes for {pendingAttributeMember.alias}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Fill in event-specific attributes. You can skip and edit later.
            </p>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {attributeDefinitions.map((attr) => (
                <div key={attr.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {attr.label}
                    {attr.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  {attr.type === "BOOLEAN" && (
                    <input
                      type="checkbox"
                      checked={attributeValues[attr.name] || false}
                      onChange={(e) =>
                        setAttributeValues((prev) => ({
                          ...prev,
                          [attr.name]: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded"
                    />
                  )}
                  {attr.type === "TEXT" && (
                    <input
                      type="text"
                      value={attributeValues[attr.name] || ""}
                      onChange={(e) =>
                        setAttributeValues((prev) => ({
                          ...prev,
                          [attr.name]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  )}
                  {attr.type === "SELECT" && (
                    <select
                      value={attributeValues[attr.name] || ""}
                      onChange={(e) =>
                        setAttributeValues((prev) => ({
                          ...prev,
                          [attr.name]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select...</option>
                      {attr.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                  {attr.type === "MULTISELECT" && (
                    <div className="space-y-1">
                      {attr.options?.map((opt) => (
                        <label key={opt} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={(
                              attributeValues[attr.name] || []
                            ).includes(opt)}
                            onChange={(e) => {
                              const current =
                                attributeValues[attr.name] || [];
                              setAttributeValues((prev) => ({
                                ...prev,
                                [attr.name]: e.target.checked
                                  ? [...current, opt]
                                  : current.filter(
                                      (v: string) => v !== opt,
                                    ),
                              }));
                            }}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded"
                          />
                          <span className="text-sm">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setPendingAttributeMember(null);
                  setAttributeValues({});
                  loadMembers();
                }}
              >
                Skip
              </Button>
              <Button
                onClick={handleSaveAttributes}
                disabled={savingAttributes}
              >
                {savingAttributes ? "Saving..." : "Save Attributes"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ProfileDetailCard
        member={profileCardMember}
        onClose={() => setProfileCardMember(null)}
      />
    </div>
  );
}
