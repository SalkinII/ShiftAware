"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { isAdminClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  User,
  Shield,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Calendar,
  Save,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { EMOJI_ADMIN, EMOJI_DEFAULT_USER } from "@/lib/constants/emojis";

type ViewPreference = "Day" | "Week" | "Grid";
type Theme = "light" | "dark" | "system";

interface AppSettings {
  defaultCalendarView: ViewPreference;
  theme: Theme;
  compactMode: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultCalendarView: "Week",
  theme: "light",
  compactMode: false,
};

const STORAGE_KEY = "shiftaware:user-settings";

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setIsAdmin(isAdminClient());

    // Load settings from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  const handleSettingChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSettings = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Also set individual keys for backwards compatibility
    localStorage.setItem(
      "shiftaware:user-calendar:view",
      settings.defaultCalendarView,
    );
    setHasChanges(false);
    toast.success("Settings saved");
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("shiftaware:user-calendar:view");
    setHasChanges(false);
    toast.info("Settings reset to defaults");
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
      }
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to logout");
    }
  };

  const displayEmoji = isAdmin ? EMOJI_ADMIN : EMOJI_DEFAULT_USER;
  const roleLabel = isAdmin ? "Administrator" : "Team Member";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          View your session info and customize app settings
        </p>
      </div>

      {/* Session Info Card */}
      <Card className="p-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-primary-50 flex items-center justify-center text-5xl shadow-inner border border-primary-100">
            {displayEmoji}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-gray-900">{roleLabel}</h2>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                  <ShieldCheck className="w-3 h-3" />
                  Admin Access
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                  <Shield className="w-3 h-3" />
                  Standard Access
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {isAdmin
                ? "You have full access to all admin features including team management, shift configuration, and assignments."
                : "You can view schedules, submit preferences, and request shift swaps."}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-red-600 border border-red-200 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </Card>

      {/* App Settings Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">App Settings</h3>
            <p className="text-sm text-gray-500">
              Customize your ShiftAware experience
            </p>
          </div>
          {hasChanges && (
            <span className="text-xs text-amber-600 font-medium">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="space-y-6">
          {/* Default Calendar View */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Default Calendar View
            </label>
            <div className="flex gap-2">
              {(["Day", "Week", "Grid"] as ViewPreference[]).map((view) => (
                <button
                  key={view}
                  onClick={() =>
                    handleSettingChange("defaultCalendarView", view)
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settings.defaultCalendarView === view
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The calendar will open in this view by default
            </p>
          </div>

          {/* Theme (visual only for now) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              {[
                { value: "light", icon: Sun, label: "Light" },
                { value: "dark", icon: Moon, label: "Dark" },
                { value: "system", icon: Monitor, label: "System" },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => handleSettingChange("theme", value as Theme)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    settings.theme === value
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Dark mode coming soon - only light theme is currently active
            </p>
          </div>

          {/* Compact Mode */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.compactMode}
                onChange={(e) =>
                  handleSettingChange("compactMode", e.target.checked)
                }
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Compact Mode
                </span>
                <p className="text-xs text-gray-500">
                  Reduce padding and spacing for more content on screen
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-100">
          <Button onClick={saveSettings} disabled={!hasChanges}>
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
          <Button variant="ghost" onClick={resetSettings}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>
      </Card>

      {/* Quick Links Card */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="/app/calendar"
            className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <Calendar className="w-5 h-5 text-primary-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">View Calendar</p>
              <p className="text-xs text-gray-500">See your schedule</p>
            </div>
          </a>
          <a
            href="/app/vote"
            className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <User className="w-5 h-5 text-primary-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                Submit Preferences
              </p>
              <p className="text-xs text-gray-500">Vote on shifts you want</p>
            </div>
          </a>
        </div>
      </Card>
    </div>
  );
}
