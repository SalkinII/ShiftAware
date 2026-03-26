"use client";

import { useState } from "react";
import { Settings, Calendar, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { FestivalSettings } from "./components/FestivalSettings";
import { TemplateManager } from "./components/TemplateManager";
import { AttributeDefinitions } from "./components/AttributeDefinitions";

type TabType = "event" | "templates" | "attributes";

export default function SetupPage() {
  const [activeTab, setActiveTab] = useState<TabType>("event");

  const tabs = [
    { id: "event" as TabType, label: "Event Settings", icon: Calendar },
    { id: "templates" as TabType, label: "Shift Templates", icon: Settings },
    { id: "attributes" as TabType, label: "Team Attributes", icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Event Setup
        </h1>
        <p className="text-gray-500 font-medium">
          Configure event settings, shift templates, and team attributes
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
        {activeTab === "event" && (
          <Card className="p-6">
            <FestivalSettings />
          </Card>
        )}

        {activeTab === "templates" && (
          <Card className="p-6">
            <TemplateManager />
          </Card>
        )}

        {activeTab === "attributes" && (
          <Card className="p-6">
            <AttributeDefinitions />
          </Card>
        )}
      </div>
    </div>
  );
}
