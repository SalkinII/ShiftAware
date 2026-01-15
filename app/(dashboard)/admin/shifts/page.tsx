"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Clock,
  Calendar,
  Shield,
  Tag,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ShiftType, ShiftPriority, Role } from "@prisma/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Shift {
  id: string;
  type: ShiftType;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  priority: ShiftPriority;
  desirabilityScore: number;
  capacity: number;
  event: { name: string };
  requiredRoles: { role: Role; count: number }[];
}

interface Event {
  id: string;
  name: string;
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    eventId: "",
    type: "MOBILE_TEAM_1" as ShiftType,
    startTime: "",
    endTime: "",
    durationMinutes: 360,
    priority: "CORE" as ShiftPriority,
    desirabilityScore: 3,
    capacity: 2,
    requiredRoles: [{ role: "TEAM_MEMBER", count: 1 }],
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [shiftsRes, eventsRes] = await Promise.all([
        fetch("/api/shifts"),
        fetch("/api/events"),
      ]);

      if (shiftsRes.ok) {
        const shiftsData = await shiftsRes.json();
        setShifts(shiftsData);
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData);
        if (eventsData.length > 0 && !formData.eventId) {
          setFormData({ ...formData, eventId: eventsData[0].id });
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await loadData();
        setShowForm(false);
        alert("Shift created successfully");
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create shift");
      }
    } catch (error) {
      console.error("Failed to create shift:", error);
      alert("Failed to create shift");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const getPriorityColor = (p: ShiftPriority) => {
    return p === "CORE"
      ? "bg-primary-100 text-primary-700"
      : "bg-gray-100 text-gray-600";
  };

  const getShiftTypeColor = (type: ShiftType) => {
    switch (type) {
      case "MOBILE_TEAM_1":
        return "bg-blue-500";
      case "MOBILE_TEAM_2":
        return "bg-purple-500";
      case "STATIONARY":
        return "bg-success-500";
      case "EXECUTIVE":
        return "bg-accent-500";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Shift Configuration
          </h1>
          <p className="text-gray-500 font-medium">
            Define and manage event shift requirements
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 shadow-lg shadow-primary-500/20"
        >
          {showForm ? (
            "Cancel"
          ) : (
            <>
              <Plus className="w-4 h-4" /> Define New Shift
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                Filter by Event
              </span>
            </div>
            <select className="bg-gray-50 border-none text-sm font-bold text-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500/20">
              <option>All Events</option>
              {events.map((e) => (
                <option key={e.id}>{e.name}</option>
              ))}
            </select>
          </Card>

          <div className="space-y-4">
            {shifts.map((shift) => (
              <Card
                key={shift.id}
                className="shadow-sm hover:shadow-md transition-all overflow-hidden p-0"
              >
                <div className="flex flex-col md:flex-row">
                  <div
                    className={cn(
                      "w-2 md:w-3 shrink-0",
                      getShiftTypeColor(shift.type),
                    )}
                  />
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-bold text-gray-900">
                            {shift.type.replace("_", " ")}
                          </h3>
                          <span
                            className={cn(
                              "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                              getPriorityColor(shift.priority),
                            )}
                          >
                            {shift.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-tighter flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5" /> {shift.event.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-gray-900 leading-none">
                          {shift.capacity}
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                          Capacity
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
                            Timing
                          </p>
                          <p className="text-sm font-bold text-gray-700 leading-none">
                            {format(new Date(shift.startTime), "HH:mm")} -{" "}
                            {format(new Date(shift.endTime), "HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
                            Date
                          </p>
                          <p className="text-sm font-bold text-gray-700 leading-none">
                            {format(new Date(shift.startTime), "MMM do, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
                            Score
                          </p>
                          <div className="flex gap-0.5 text-accent-500">
                            {[...Array(5)].map((_, i) => (
                              <span
                                key={i}
                                className={cn(
                                  "text-xs",
                                  i >= shift.desirabilityScore &&
                                    "text-gray-200",
                                )}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button className="bg-gray-50 p-4 flex items-center justify-center text-gray-300 hover:text-primary-500 hover:bg-primary-50 transition-all border-l border-gray-100">
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {showForm ? (
            <Card className="bg-white border-none shadow-xl p-8 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary-500" /> New Shift
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <Select
                  label="Event Context"
                  value={formData.eventId}
                  onChange={(e) =>
                    setFormData({ ...formData, eventId: e.target.value })
                  }
                  required
                  className="bg-gray-50 border-gray-100 font-medium"
                >
                  <option value="">Select event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Shift Type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as ShiftType,
                    })
                  }
                  className="bg-gray-50 border-gray-100 font-medium"
                >
                  <option value="MOBILE_TEAM_1">Mobile Team 1</option>
                  <option value="MOBILE_TEAM_2">Mobile Team 2</option>
                  <option value="STATIONARY">Stationary</option>
                  <option value="EXECUTIVE">Executive</option>
                </Select>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Start Time"
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => {
                      const start = new Date(e.target.value);
                      const end = new Date(
                        start.getTime() + formData.durationMinutes * 60000,
                      );
                      setFormData({
                        ...formData,
                        startTime: e.target.value,
                        endTime: end.toISOString().slice(0, 16),
                      });
                    }}
                    required
                    className="bg-gray-50 border-gray-100 text-xs font-bold"
                  />
                  <Input
                    label="End Time"
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(e) => {
                      const start = new Date(formData.startTime);
                      const end = new Date(e.target.value);
                      const minutes = Math.round(
                        (end.getTime() - start.getTime()) / 60000,
                      );
                      setFormData({
                        ...formData,
                        endTime: e.target.value,
                        durationMinutes: minutes,
                      });
                    }}
                    required
                    className="bg-gray-50 border-gray-100 text-xs font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Priority"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        priority: e.target.value as ShiftPriority,
                      })
                    }
                    className="bg-gray-50 border-gray-100 font-medium"
                  >
                    <option value="CORE">Core</option>
                    <option value="BUFFER">Buffer</option>
                  </Select>
                  <Input
                    label="Score (1-5)"
                    type="number"
                    min="1"
                    max="5"
                    value={formData.desirabilityScore}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        desirabilityScore: parseInt(e.target.value),
                      })
                    }
                    required
                    className="bg-gray-50 border-gray-100 font-medium"
                  />
                </div>

                <Input
                  label="Staff Capacity"
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      capacity: parseInt(e.target.value),
                    })
                  }
                  required
                  className="bg-gray-50 border-gray-100 font-medium"
                />

                <Button
                  type="submit"
                  className="w-full py-4 shadow-lg shadow-primary-500/20 font-bold uppercase tracking-widest text-xs mt-4"
                >
                  Register Shift Template
                </Button>
              </form>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8 border-none shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-6">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-black mb-2 leading-tight">
                  Configurable Slots
                </h3>
                <p className="text-sm text-primary-100 leading-relaxed opacity-90">
                  Each shift defines its type, required capacity, and
                  desirability. The algorithm uses the score to prioritize
                  popular or difficult slots.
                </p>
              </Card>

              <Card className="bg-white border-none shadow-sm p-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Slot Breakdown
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>{" "}
                      Mobile 1
                    </span>
                    <span className="text-sm font-black text-gray-900">
                      {shifts.filter((s) => s.type === "MOBILE_TEAM_1").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>{" "}
                      Mobile 2
                    </span>
                    <span className="text-sm font-black text-gray-900">
                      {shifts.filter((s) => s.type === "MOBILE_TEAM_2").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-success-500"></div>{" "}
                      Stationary
                    </span>
                    <span className="text-sm font-black text-gray-900">
                      {shifts.filter((s) => s.type === "STATIONARY").length}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
