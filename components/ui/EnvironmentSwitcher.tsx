// components/ui/EnvironmentSwitcher.tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnvironmentSummary {
  id: string;
  name: string;
  festivalId: string;
  festivalName: string;
  status: string;
  shiftCount: number;
}

interface JoinableEnvironment {
  id: string;
  name: string;
  festivalId: string;
  festivalName: string;
  missingQuestionCount: number;
}

interface EnvironmentSwitcherProps {
  activeEnvironment: EnvironmentSummary | null;
  myEnvironments: EnvironmentSummary[];
  joinable: JoinableEnvironment[];
  onSelect: (environmentId: string) => void;
  onJoin: (environmentId: string) => void;
}

function groupByFestival<T extends { festivalId: string; festivalName: string }>(items: T[]) {
  const groups = new Map<string, { festivalName: string; items: T[] }>();
  for (const item of items) {
    const group = groups.get(item.festivalId) ?? { festivalName: item.festivalName, items: [] };
    group.items.push(item);
    groups.set(item.festivalId, group);
  }
  return Array.from(groups.values());
}

export function EnvironmentSwitcher({
  activeEnvironment,
  myEnvironments,
  joinable,
  onSelect,
  onJoin,
}: EnvironmentSwitcherProps) {
  const [open, setOpen] = useState(false);
  const myGroups = groupByFestival(myEnvironments);
  const joinGroups = groupByFestival(joinable);
  const showFestivalHeadings = myGroups.length + joinGroups.length > 1;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"
      >
        {activeEnvironment
          ? `${activeEnvironment.festivalName} › ${activeEnvironment.name}`
          : "Select an environment"}
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-80 rounded-lg border border-gray-200 bg-white shadow-lg p-2">
          <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">Your Environments</p>
          {myGroups.map((group) => (
            <div key={group.festivalName}>
              {showFestivalHeadings && (
                <p className="px-2 pt-1 text-xs text-gray-400">{group.festivalName}</p>
              )}
              {group.items.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => { onSelect(env.id); setOpen(false); }}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded text-sm flex justify-between items-center hover:bg-gray-50",
                    env.id === activeEnvironment?.id && "font-semibold",
                  )}
                >
                  <span>{env.id === activeEnvironment?.id ? "●" : "○"} {env.name}</span>
                  <span className="text-xs text-gray-400">{env.shiftCount} shifts · {env.status.toLowerCase().replace(/_/g, " ")}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="border-t border-gray-100 my-1" />
          <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">Join Another</p>
          {joinGroups.map((group) => (
            <div key={group.festivalName}>
              {showFestivalHeadings && (
                <p className="px-2 pt-1 text-xs text-gray-400">{group.festivalName}</p>
              )}
              {group.items.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => { onJoin(env.id); setOpen(false); }}
                  className="w-full text-left px-2 py-1.5 rounded text-sm flex justify-between items-center hover:bg-gray-50"
                >
                  <span>+ {env.name}</span>
                  <span className="text-xs text-gray-400">
                    {env.missingQuestionCount === 0 ? "no questions" : `needs ${env.missingQuestionCount} more question${env.missingQuestionCount === 1 ? "" : "s"}`}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
