"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface ProfileMember {
  alias: string;
  avatarId?: string;
  experienceLevel?: string;
  capabilities?: string[];
  attributes?: { name: string; value: string }[];
}

interface ProfileDetailCardProps {
  member: ProfileMember | null;
  onClose: () => void;
}

const expBadgeColor = (level: string) => {
  switch (level) {
    case "SENIOR":
      return "bg-primary-100 text-primary-700";
    case "INTERMEDIATE":
      return "bg-accent-50 text-accent-700";
    case "JUNIOR":
      return "bg-success-50 text-success-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

export function ProfileDetailCard({ member, onClose }: ProfileDetailCardProps) {
  useEffect(() => {
    if (!member) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [member, onClose]);

  if (!member) return null;

  return (
    <div
      data-testid="profile-card-backdrop"
      className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-8 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center text-5xl shadow-inner border border-gray-100">
            {member.avatarId || "👤"}
          </div>
          <h2 className="text-2xl font-black text-gray-900">{member.alias}</h2>
        </div>

        {/* Experience Level */}
        {member.experienceLevel && (
          <div className="mb-4 flex justify-center">
            <span
              className={cn(
                "text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full",
                expBadgeColor(member.experienceLevel),
              )}
            >
              {member.experienceLevel}
            </span>
          </div>
        )}

        {/* Capabilities */}
        {member.capabilities && member.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {member.capabilities.map((cap) => (
              <span
                key={cap}
                className="text-xs font-bold bg-gray-50 text-gray-600 px-2 py-1 rounded-lg border border-gray-100"
              >
                {cap.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {/* Attributes */}
        {member.attributes && member.attributes.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400 text-center">
              Attributes
            </p>
            <div className="space-y-1">
              {member.attributes.map((attr) => (
                <div
                  key={attr.name}
                  className="flex justify-between items-center px-3 py-1.5 bg-gray-50 rounded-lg"
                >
                  <span className="text-xs font-medium text-gray-600">
                    {attr.name}
                  </span>
                  <span className="text-xs font-bold text-gray-900">
                    {attr.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Close hint */}
        <p className="text-xs text-gray-400 text-center mt-6">
          Click outside or press Esc to close
        </p>
      </div>
    </div>
  );
}
