"use client";

import { useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { Input } from "./Input";
import { TimePicker } from "./TimePicker";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value: string; // ISO datetime string or datetime-local format
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
  use24Hour?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  label,
  error,
  required,
  className = "",
  use24Hour = false,
}: DateTimePickerProps) {
  // Parse datetime-local format (YYYY-MM-DDTHH:mm) or ISO string
  const parseValue = (val: string) => {
    if (!val) return { date: "", time: "" };

    // Handle datetime-local format
    if (val.includes("T") && val.length >= 16) {
      const [date, time] = val.split("T");
      return { date, time: time.substring(0, 5) }; // HH:mm
    }

    // Handle ISO string
    if (val.includes("T")) {
      const dateObj = new Date(val);
      if (!isNaN(dateObj.getTime())) {
        const date = dateObj.toISOString().split("T")[0];
        const time = dateObj.toTimeString().substring(0, 5);
        return { date, time };
      }
    }

    return { date: "", time: "" };
  };

  const { date: currentDate, time: currentTime } = parseValue(value);

  const handleDateChange = (newDate: string) => {
    if (currentTime) {
      onChange(`${newDate}T${currentTime}`);
    } else {
      onChange(`${newDate}T00:00`);
    }
  };

  const handleTimeChange = (newTime: string) => {
    if (currentDate) {
      onChange(`${currentDate}T${newTime}`);
    } else {
      // If no date, use today
      const today = new Date().toISOString().split("T")[0];
      onChange(`${today}T${newTime}`);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <label className="block text-sm font-semibold text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            type="date"
            value={currentDate}
            onChange={(e) => handleDateChange(e.target.value)}
            error={error && !currentDate ? "Date is required" : undefined}
            required={required}
            className="bg-gray-50 border-gray-100 font-medium"
            aria-label={`${label || "Date"} date selection`}
          />
        </div>

        <div>
          <TimePicker
            value={currentTime || "00:00"}
            onChange={handleTimeChange}
            error={error && !currentTime ? "Time is required" : undefined}
            required={required}
            use24Hour={use24Hour}
            className="bg-gray-50"
          />
        </div>
      </div>

      {error && currentDate && currentTime && (
        <p
          className="text-sm text-red-600 font-medium flex items-center gap-1"
          role="alert"
        >
          <span>⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}
