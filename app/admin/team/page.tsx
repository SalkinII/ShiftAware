"use client";

import { useState } from "react";
import { Users, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useEventContext } from "@/lib/hooks/useEventContext";
import { DistributionSettings } from "./components/DistributionSettings";
import { MemberListByEvent } from "./components/MemberListByEvent";

type TabType = "members" | "allocation";

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<TabType>("members");
  const { selectedEventId, selectedEvent } = useEventContext(true);

  const tabs = [
    { id: "members" as TabType, label: "Team Members", icon: Users },
    {
      id: "allocation" as TabType,
      label: "Allocation & Distribution",
      icon: Zap,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Team Management
        </h1>
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
                  "flex items-center gap-2 pb-4 px-1 border-b-2 font-medium text-sm transition-colors",
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
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
        {activeTab === "members" && (
          <Card className="p-6">
            {selectedEventId ? (
              <MemberListByEvent
                eventId={selectedEventId}
                eventName={selectedEvent?.name || ""}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                Please select an event from the header dropdown to manage team
                members.
              </div>
            )}
          </Card>
        )}

        {activeTab === "allocation" && <DistributionSettings />}
      </div>
    </div>
  );
}
