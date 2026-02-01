"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MemberList } from "./components/MemberList";
import { CreateProfileForm } from "./components/CreateProfileForm";
import { EventSelectionStep } from "./components/EventSelectionStep";

export default function IdentityPage() {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showEventSelection, setShowEventSelection] = useState(false);

  const handleSelectMember = (memberId: string) => {
    setSelectedMemberId(memberId);
    setShowEventSelection(true);
  };

  const handleEventSelected = (eventId: string) => {
    if (selectedMemberId) {
      localStorage.setItem("selectedMemberId", selectedMemberId);
      localStorage.setItem("selectedEventId", eventId);
      router.push("/app/calendar");
    }
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

        // If eventId provided, create registration
        if (profileData.eventId) {
          await fetch(`/api/events/${profileData.eventId}/registrations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId: newMemberId }),
          });
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
          <EventSelectionStep
            memberId={selectedMemberId!}
            onEventSelected={handleEventSelected}
            onBack={handleBackToMemberSelection}
          />
        )}
      </div>
    </div>
  );
}
