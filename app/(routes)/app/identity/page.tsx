"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useEnvironmentContext } from "@/lib/contexts/EnvironmentContext";
import { MemberList } from "./components/MemberList";
import { CreateProfileForm } from "./components/CreateProfileForm";
import { EventSelectionStep } from "./components/EventSelectionStep";
import { AttributePromptModal } from "@/components/features/Identity/AttributePromptModal";
import { getMissingAttributes } from "@/lib/utils/attribute-check";

export default function IdentityPage() {
  const router = useRouter();
  const { setSelectedEnvironmentId: setContextEventId } = useEnvironmentContext();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showEventSelection, setShowEventSelection] = useState(false);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
  const [missingDefinitions, setMissingDefinitions] = useState<any[]>([]);
  const [initialAttributeValues, setInitialAttributeValues] = useState<
    Record<string, unknown>
  >({});

  const handleSelectMember = (memberId: string) => {
    setSelectedMemberId(memberId);
    setShowEventSelection(true);
  };

  const proceedToCalendar = (environmentId: string) => {
    if (selectedMemberId) {
      localStorage.setItem("selectedMemberId", selectedMemberId);
      setContextEventId(environmentId);
      router.push("/app/calendar");
    }
  };

  const handleEventSelected = async (environmentId: string) => {
    if (!selectedMemberId) return;

    try {
      const [defRes, valuesRes] = await Promise.all([
        fetch(`/api/environments/${environmentId}/attributes`),
        fetch(`/api/members/${selectedMemberId}/attributes?environmentId=${environmentId}`),
      ]);

      const defData = defRes.ok ? await defRes.json() : { data: [] };
      const valuesData = valuesRes.ok ? await valuesRes.json() : { data: [] };
      const definitions = defData.data || [];
      const values = valuesData.data || [];

      const missing = getMissingAttributes(definitions, values);

      if (missing.length > 0) {
        const initial: Record<string, unknown> = {};
        for (const v of values) {
          try {
            initial[v.definition.name] = JSON.parse(v.value);
          } catch {
            initial[v.definition.name] = v.value;
          }
        }
        setMissingDefinitions(missing);
        setInitialAttributeValues(initial);
        setPendingEventId(environmentId);
        setShowAttributeModal(true);
      } else {
        proceedToCalendar(environmentId);
      }
    } catch {
      proceedToCalendar(environmentId);
    }
  };

  const handleAttributeSubmit = async (attributes: Record<string, unknown>) => {
    if (!selectedMemberId || !pendingEventId) return;

    for (const [key, value] of Object.entries(attributes)) {
      await fetch(`/api/members/${selectedMemberId}/attributes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environmentId: pendingEventId,
          key,
          value,
        }),
      });
    }

    setShowAttributeModal(false);
    setPendingEventId(null);
    setMissingDefinitions([]);
    proceedToCalendar(pendingEventId);
  };

  const handleBackToMemberSelection = () => {
    setSelectedMemberId(null);
    setShowEventSelection(false);
  };

  const handleCreateProfile = async (profileData: any) => {
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });

      if (res.ok) {
        const data = await res.json();
        const newMemberId = data.data.id;

        // If environmentId provided, create registration
        if (profileData.environmentId) {
          const regRes = await fetch(
            `/api/environments/${profileData.environmentId}/registrations`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ memberId: newMemberId }),
            },
          );

          if (!regRes.ok) {
            console.error("Failed to register for event");
          }

          // Save event-specific attributes
          if (
            profileData.attributes &&
            Object.keys(profileData.attributes).length > 0
          ) {
            for (const [key, value] of Object.entries(profileData.attributes)) {
              await fetch(`/api/members/${newMemberId}/attributes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  environmentId: profileData.environmentId,
                  key,
                  value,
                }),
              });
            }
          }
        }

        setSelectedMemberId(newMemberId);
        setShowCreateForm(false);
        setShowEventSelection(true);
      } else {
        const error = await res.json();
        console.error("Failed to create profile:", error);
        alert(error.message || "Failed to create profile");
      }
    } catch (error) {
      console.error("Failed to create profile:", error);
      alert("Failed to create profile");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        {!showEventSelection ? (
          <>
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="w-8 h-8 text-primary-600" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Select Your Identity
              </h1>
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
                  <h2 className="text-xl font-bold text-gray-900">
                    Create New Profile
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <CreateProfileForm onSubmit={handleCreateProfile} />
              </Card>
            )}
          </>
        ) : (
          <>
            <EventSelectionStep
              memberId={selectedMemberId!}
              onEventSelected={handleEventSelected}
              onBack={handleBackToMemberSelection}
            />
            {showAttributeModal && missingDefinitions.length > 0 && (
              <AttributePromptModal
                definitions={missingDefinitions}
                initialValues={initialAttributeValues}
                onSubmit={handleAttributeSubmit}
                onCancel={() => {
                  setShowAttributeModal(false);
                  setPendingEventId(null);
                  setMissingDefinitions([]);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
