"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Calendar,
  UserCircle2,
  CheckCircle2,
  Trash2,
  HelpCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { format } from "date-fns";
import CalendarView from "@/components/features/Calendar/CalendarView";
import { cn } from "@/lib/utils";

interface Shift {
  id: string;
  type: string;
  startTime: string;
  endTime: string;
  priority: string;
  desirabilityScore: number;
  event: { name: string; startDate: string };
}

export default function PreferencesPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShifts, setSelectedShifts] = useState<Map<string, number>>(
    new Map(),
  );
  const [members, setMembers] = useState<{ id: string; alias: string }[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentEventDate, setCurrentEventDate] = useState<string>();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [shiftsRes, membersRes] = await Promise.all([
        fetch("/api/shifts"),
        fetch("/api/members"),
      ]);

      if (shiftsRes.ok) {
        const shiftsData = await shiftsRes.json();
        setShifts(shiftsData);
        if (shiftsData.length > 0) {
          setCurrentEventDate(shiftsData[0].startTime.split("T")[0]);
        }
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData);
        if (membersData.length > 0) {
          setSelectedMember(membersData[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  function toggleShift(shiftId: string) {
    const newSelected = new Map(selectedShifts);
    if (newSelected.has(shiftId)) {
      newSelected.delete(shiftId);
      const remaining = Array.from(newSelected.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([id], index) => [id, index + 1] as [string, number]);
      setSelectedShifts(new Map(remaining));
    } else {
      const priority = newSelected.size + 1;
      newSelected.set(shiftId, priority);
      setSelectedShifts(newSelected);
    }
  }

  async function handleSubmit() {
    if (!selectedMember) {
      alert("Please select a team member");
      return;
    }

    if (selectedShifts.size < 2) {
      alert("Please select at least 2 shifts");
      return;
    }

    setSubmitting(true);
    try {
      const preferences = Array.from(selectedShifts.entries()).map(
        ([shiftId, priority]) => ({
          shiftId,
          priority,
        }),
      );

      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamMemberId: selectedMember,
          preferences,
        }),
      });

      if (res.ok) {
        alert("Preferences submitted successfully!");
        setSelectedShifts(new Map());
      } else {
        const error = await res.json();
        alert(error.error || "Failed to submit preferences");
      }
    } catch (error) {
      console.error("Failed to submit preferences:", error);
      alert("Failed to submit preferences");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const selectedList = shifts
    .filter((s) => selectedShifts.has(s.id))
    .sort(
      (a, b) =>
        (selectedShifts.get(a.id) || 0) - (selectedShifts.get(b.id) || 0),
    );

  const coreCount = selectedList.filter((s) => s.priority === "CORE").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Shift Preferences
          </h1>
          <p className="text-gray-500 font-medium flex items-center gap-2">
            Select your ideal slots for{" "}
            <span className="text-primary-600 font-bold uppercase tracking-tighter">
              Starlight Meadow 2026
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <UserCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 appearance-none shadow-sm"
            >
              <option value="">Select identity</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.alias}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={selectedShifts.size < 2 || !selectedMember || submitting}
            className="flex items-center gap-2 shadow-lg shadow-primary-500/20"
          >
            {submitting ? (
              "Processing..."
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Submit Selection
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-220px)] min-h-[600px]">
        <div className="lg:col-span-3 flex flex-col gap-6">
          <Card className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-white relative overflow-hidden shadow-xl shadow-primary-500/10 border-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">
                  ✨
                </div>
                <div>
                  <h3 className="text-lg font-bold leading-tight">
                    Interactive Calendar Selection
                  </h3>
                  <p className="text-primary-100 text-xs font-medium opacity-90">
                    Click blocks to select. Minimum 2 shifts required.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-center px-4 border-r border-white/20">
                  <p className="text-2xl font-black">{selectedShifts.size}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                    Selected
                  </p>
                </div>
                <div className="text-center px-4">
                  <p
                    className={cn(
                      "text-2xl font-black",
                      coreCount < 2 ? "text-accent-300" : "text-white",
                    )}
                  >
                    {coreCount}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                    Core Event
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="flex-grow p-0 shadow-sm overflow-hidden bg-white">
            <CalendarView
              shifts={shifts}
              onShiftClick={toggleShift}
              selectedShiftIds={new Set(selectedShifts.keys())}
              startDate={currentEventDate}
            />
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6 flex flex-col">
          <Card className="h-full flex flex-col shadow-sm bg-white p-6">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center justify-between">
              Your Ranking
              <HelpCircle className="w-3.5 h-3.5" />
            </h2>

            {selectedList.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-100 rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-gray-200" />
                </div>
                <p className="text-gray-400 text-sm font-medium leading-relaxed">
                  Click shifts on the calendar to build your preferred schedule.
                </p>
              </div>
            ) : (
              <div className="flex-grow space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                {selectedList.map((shift, index) => (
                  <div
                    key={shift.id}
                    className="p-4 rounded-2xl bg-gray-50 border border-gray-100 group hover:border-primary-200 transition-all animate-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-xs font-black text-primary-600 border border-gray-50">
                        {index + 1}
                      </div>
                      <button
                        onClick={() => toggleShift(shift.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-900 mb-1 leading-tight">
                        {shift.type.replace("_", " ")}
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(shift.startTime), "MMM d, HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-50">
              <div className="p-4 bg-primary-50 rounded-2xl border border-primary-100">
                <div className="flex items-center gap-2 mb-1 text-primary-700">
                  <Sparkles className="w-3.5 h-3.5" />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    Selection Tip
                  </p>
                </div>
                <p className="text-[11px] text-primary-600 font-medium leading-relaxed">
                  Rank your most desired shifts at the top. The algorithm
                  prioritizes your #1 and #2 choices.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
