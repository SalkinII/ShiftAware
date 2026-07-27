"use client";

import { useState } from "react";
import { Activity, Users, UserCog, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useEventContext } from "@/lib/hooks/useEventContext";
import { DistributionSettings } from "./components/DistributionSettings";
import { MemberListByEvent } from "./components/MemberListByEvent";
import { MemberManagement } from "./components/MemberManagement";
import { AvailabilityHeatmap } from "@/components/features/AvailabilityHeatmap/AvailabilityHeatmap";

type TabType = "directory" | "members" | "allocation" | "heatmap";

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<TabType>("directory");
  const { selectedEventId, selectedEvent } = useEventContext(true);

  const tabs = [
    { id: "directory" as TabType, label: "Member Directory", icon: UserCog },
    { id: "members" as TabType, label: "Event Members", icon: Users },
    {
      id: "allocation" as TabType,
      label: "Allocation & Distribution",
      icon: Zap,
    },
    { id: "heatmap" as TabType, label: "Availability Heatmap", icon: Activity },
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
        <nav className="flex gap-1 flex-wrap">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 py-3 px-3 border-b-2 font-medium text-sm transition-colors min-h-[44px]",
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
        {activeTab === "directory" && <MemberManagement />}

        {activeTab === "members" && (
          <Card className="p-6">
            {selectedEventId ? (
              <MemberListByEvent
                eventId={selectedEventId}
                eventName={selectedEvent?.name || ""}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="font-medium">No event selected</p>
                <p className="text-sm mt-1">
                  Choose an event using the selector in the header (desktop) or
                  the menu sidebar (mobile).
                </p>
              </div>
            )}
          </Card>
        )}

        {activeTab === "allocation" && <DistributionSettings />}

        {activeTab === "heatmap" && (
          selectedEventId ? (
            <AvailabilityHeatmap eventId={selectedEventId} />
          ) : (
            <Card className="p-6">
              <div className="text-center py-8 text-gray-500">
                <p className="font-medium">No event selected</p>
                <p className="text-sm mt-1">
                  Choose an event using the selector in the header (desktop) or
                  the menu sidebar (mobile).
                </p>
              </div>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
