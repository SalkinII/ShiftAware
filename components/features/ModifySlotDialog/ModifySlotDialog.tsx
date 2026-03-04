"use client";

import React, { useState, useEffect } from "react";
import { format, addMinutes, parseISO } from "date-fns";
import { X, Clock, Users, Calendar } from "lucide-react";

interface ShiftTemplate {
  id: string;
  name: string;
  type: string;
  durationMinutes: number;
  startTime: string; // "HH:mm"
  priority: string;
  capacity: number;
  desirabilityScore?: number;
  requiredRoles?: { role: string; count: number }[];
}

interface ModifiedSlotData {
  date: Date;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  capacity: number;
  priority: string;
}

interface ModifySlotDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: ModifiedSlotData) => void;
  template: ShiftTemplate | null;
  targetDate: Date | null;
  isLoading?: boolean;
}

export function ModifySlotDialog({
  isOpen,
  onClose,
  onConfirm,
  template,
  targetDate,
  isLoading = false,
}: ModifySlotDialogProps) {
  const [date, setDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [capacity, setCapacity] = useState<number>(0);
  const [priority, setPriority] = useState<string>("CORE");

  // Reset form when dialog opens with new template
  useEffect(() => {
    if (isOpen && template && targetDate) {
      setDate(format(targetDate, "yyyy-MM-dd"));
      setStartTime(template.startTime || "08:00");

      // Calculate end time from start time + duration
      const [hours, mins] = (template.startTime || "08:00").split(":").map(Number);
      const startDate = new Date();
      startDate.setHours(hours, mins, 0, 0);
      const endDate = addMinutes(startDate, template.durationMinutes || 360);
      setEndTime(format(endDate, "HH:mm"));

      setCapacity(template.capacity ?? 0);
      setPriority(template.priority || "CORE");
    }
  }, [isOpen, template, targetDate]);

  // Update end time when start time changes (maintain duration)
  const handleStartTimeChange = (newStartTime: string) => {
    setStartTime(newStartTime);
    if (template) {
      const [hours, mins] = newStartTime.split(":").map(Number);
      const startDate = new Date();
      startDate.setHours(hours, mins, 0, 0);
      const endDate = addMinutes(startDate, template.durationMinutes || 360);
      setEndTime(format(endDate, "HH:mm"));
    }
  };

  const handleConfirm = () => {
    onConfirm({
      date: parseISO(date),
      startTime,
      endTime,
      capacity,
      priority,
    });
  };

  if (!isOpen || !template) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Create Shift from Template
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Review and modify before creating
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Info */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{
                backgroundColor:
                  template.type === "MOBILE_TEAM"
                    ? "#0ea5e9"
                      : template.type === "STATIONARY"
                        ? "#22c55e"
                        : template.type === "SUPER"
                          ? "#f59e0b"
                          : "#78716c",
              }}
            >
              {template.name.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-gray-900">{template.name}</p>
              <p className="text-sm text-gray-500">
                {template.durationMinutes / 60}h &bull; {template.capacity} capacity
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {/* Date */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4" />
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4" />
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                step="900" // 15-minute intervals
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4" />
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                step="900" // 15-minute intervals
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Users className="w-4 h-4" />
              Capacity
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={capacity}
              onChange={(e) => setCapacity(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Priority - Hidden as requested */}
          {/* <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Priority
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="priority"
                  value="CORE"
                  checked={priority === "CORE"}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Core Event</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="priority"
                  value="BUFFER"
                  checked={priority === "BUFFER"}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Buffer</span>
              </label>
            </div>
          </div> */}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Creating...
              </>
            ) : (
              "Create Shift"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ModifiedSlotData, ShiftTemplate };
