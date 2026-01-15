"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Download, FileText, Users, Calendar } from "lucide-react";
import { exportScheduleToPDF } from "@/lib/services/export";

interface Member {
  id: string;
  alias: string;
  avatarId: string;
}

interface Event {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  capacity: number;
  assignments?: Array<{
    id: string;
    teamMemberId: string;
    teamMember?: { id: string; alias: string };
  }>;
  event?: { name: string };
}

export default function ExportPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [exportScope, setExportScope] = useState<"schedule" | "member">(
    "schedule",
  );
  const [exportOrientation, setExportOrientation] = useState<
    "portrait" | "landscape"
  >("landscape");
  const [exportIncludePseudonymMap, setExportIncludePseudonymMap] =
    useState<boolean>(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadShifts(selectedEventId);
    }
  }, [selectedEventId]);

  async function loadData() {
    try {
      const [membersRes, eventsRes] = await Promise.all([
        fetch("/api/members"),
        fetch("/api/events"),
      ]);

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData);
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData);
        if (eventsData.length > 0) {
          setSelectedEventId(eventsData[0].id);
        }
      }
    } catch (error) {
      console.error("Load data error:", error);
    }
  }

  async function loadShifts(eventId: string) {
    try {
      const res = await fetch(`/api/shifts?eventId=${eventId}`);
      if (res.ok) {
        const shiftsData = await res.json();
        setShifts(shiftsData);
      }
    } catch (error) {
      console.error("Load shifts error:", error);
    }
  }

  async function handleExport() {
    if (!selectedEventId) {
      alert("Please select an event");
      return;
    }

    if (exportScope === "member" && selectedMemberId === "all") {
      alert("Please select a member for member-specific export");
      return;
    }

    if (shifts.length === 0) {
      alert("No shifts available for this event");
      return;
    }

    setIsExporting(true);
    try {
      exportScheduleToPDF(shifts, {
        orientation: exportOrientation,
        memberId: exportScope === "member" ? selectedMemberId : undefined,
        includePseudonymMap: exportIncludePseudonymMap,
        title:
          exportScope === "member"
            ? `Member Schedule - ${members.find((m) => m.id === selectedMemberId)?.alias || ""}`
            : "ShiftAware Schedule",
      });
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export schedule");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="p-6 lg:pl-70">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Export Schedule
          </h1>
          <p className="text-gray-500 font-medium mt-1">
            Generate PDF exports of shift schedules
          </p>
        </div>

        <Card className="p-6 mb-6">
          <div className="space-y-6">
            {/* Event Selection */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                Event
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 bg-white focus:border-primary-400 focus:outline-none"
              >
                <option value="">Select an event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Export Scope */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                Export Scope
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setExportScope("schedule");
                    setSelectedMemberId("all");
                  }}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all text-left",
                    exportScope === "schedule"
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:border-primary-200",
                  )}
                >
                  <Calendar className="w-5 h-5 mb-2" />
                  <p className="font-bold text-sm">Full Schedule</p>
                  <p className="text-xs text-gray-500 mt-1">
                    All shifts and assignments
                  </p>
                </button>
                <button
                  onClick={() => setExportScope("member")}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all text-left",
                    exportScope === "member"
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:border-primary-200",
                  )}
                >
                  <Users className="w-5 h-5 mb-2" />
                  <p className="font-bold text-sm">Member Schedule</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Individual member only
                  </p>
                </button>
              </div>
            </div>

            {/* Member Selection (if member scope) */}
            {exportScope === "member" && (
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                  Select Member
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 bg-white focus:border-primary-400 focus:outline-none"
                >
                  <option value="all">Choose a member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.avatarId} {member.alias}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Orientation */}
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                Page Orientation
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExportOrientation("landscape")}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-center",
                    exportOrientation === "landscape"
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:border-primary-200",
                  )}
                >
                  <FileText className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-xs font-bold">Landscape</p>
                </button>
                <button
                  onClick={() => setExportOrientation("portrait")}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-center",
                    exportOrientation === "portrait"
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600 hover:border-primary-200",
                  )}
                >
                  <FileText className="w-5 h-5 mx-auto mb-1 rotate-90" />
                  <p className="text-xs font-bold">Portrait</p>
                </button>
              </div>
            </div>

            {/* Pseudonym Map Option */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
              <input
                type="checkbox"
                id="export-pseudonym-map"
                checked={exportIncludePseudonymMap}
                onChange={(e) => setExportIncludePseudonymMap(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-400 focus:ring-2"
              />
              <label
                htmlFor="export-pseudonym-map"
                className="flex-1 cursor-pointer"
              >
                <p className="text-sm font-bold text-gray-900">
                  Include Pseudonym Mapping Sheet
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Adds a conversion table mapping pseudonyms to real names
                </p>
              </label>
            </div>

            {/* Export Button */}
            <Button
              onClick={handleExport}
              disabled={
                isExporting ||
                !selectedEventId ||
                (exportScope === "member" && selectedMemberId === "all")
              }
              className="w-full flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Export to PDF
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Info Card */}
        <Card className="p-6 bg-primary-50 border-primary-100">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-primary-900 mb-1">
                Export Features
              </h3>
              <ul className="text-xs text-primary-700 space-y-1">
                <li>• Full schedule view with all shifts and assignments</li>
                <li>• Member-specific schedules for individual team members</li>
                <li>• Optional pseudonym mapping for privacy</li>
                <li>• Print-optimized formatting</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
