"use client";

import { useState, useRef, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string; // HH:mm format
  onChange: (time: string) => void;
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
  use24Hour?: boolean;
}

export function TimePicker({
  value,
  onChange,
  label,
  error,
  required,
  className = "",
  use24Hour = false,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState<"AM" | "PM">("AM");
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse value into hour, minute, period
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        if (use24Hour) {
          setHour(h);
          setMinute(m);
        } else {
          if (h === 0) {
            setHour(12);
            setPeriod("AM");
          } else if (h === 12) {
            setHour(12);
            setPeriod("PM");
          } else if (h > 12) {
            setHour(h - 12);
            setPeriod("PM");
          } else {
            setHour(h);
            setPeriod("AM");
          }
          setMinute(m);
        }
      }
    }
  }, [value, use24Hour]);

  // Format time for output
  const formatTime = (h: number, m: number, p?: "AM" | "PM") => {
    if (use24Hour) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    } else {
      const hour24 =
        p === "PM" && h !== 12 ? h + 12 : p === "AM" && h === 12 ? 0 : h;
      return `${String(hour24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  };

  const handleHourChange = (newHour: number) => {
    setHour(newHour);
    onChange(formatTime(newHour, minute, period));
  };

  const handleMinuteChange = (newMinute: number) => {
    setMinute(newMinute);
    onChange(formatTime(hour, newMinute, period));
  };

  const handlePeriodChange = (newPeriod: "AM" | "PM") => {
    setPeriod(newPeriod);
    onChange(formatTime(hour, minute, newPeriod));
  };

  const displayValue = use24Hour
    ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    : `${hour}:${String(minute).padStart(2, "0")} ${period}`;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const inputId = `timepicker-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div ref={containerRef} className={cn("space-y-1 relative", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-gray-700"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          id={inputId}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full rounded-xl border bg-white px-4 py-3 text-gray-900 focus:ring-2 focus:outline-none shadow-sm transition-colors flex items-center gap-2",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
              : "border-gray-200 focus:border-primary-500 focus:ring-primary-500/20",
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${inputId}-error` : undefined}
          aria-label={label || "Select time"}
        >
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="flex-1 text-left font-medium">{displayValue}</span>
        </button>

        {isOpen && (
          <div
            className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-1.5 min-w-[200px]"
            role="dialog"
            aria-label="Time picker"
          >
            <div className="flex items-end gap-2 justify-center">
              {/* Hour selector */}
              <div className="flex flex-col items-center">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-0.5">
                  Hour
                </label>
                <select
                  value={hour}
                  onChange={(e) => handleHourChange(Number(e.target.value))}
                  className="rounded-lg border border-gray-200 px-2.5 py-0.5 text-sm font-semibold text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none h-8"
                  aria-label="Select hour"
                >
                  {Array.from({ length: use24Hour ? 24 : 12 }, (_, i) =>
                    use24Hour ? i : i + 1,
                  ).map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-xl font-bold text-gray-400 mb-1">:</span>

              {/* Minute selector */}
              <div className="flex flex-col items-center">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-0.5">
                  Minute
                </label>
                <select
                  value={minute}
                  onChange={(e) => handleMinuteChange(Number(e.target.value))}
                  className="rounded-lg border border-gray-200 px-2.5 py-0.5 text-sm font-semibold text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none h-8"
                  aria-label="Select minute"
                >
                  {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </div>

              {/* AM/PM selector (12-hour only) */}
              {!use24Hour && (
                <>
                  <span className="text-xl font-bold text-gray-400 mb-1 mx-0.5">
                    {" "}
                  </span>
                  <div className="flex flex-col items-center">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-0.5">
                      Period
                    </label>
                    <select
                      value={period}
                      onChange={(e) =>
                        handlePeriodChange(e.target.value as "AM" | "PM")
                      }
                      className="rounded-lg border border-gray-200 px-2.5 py-0.5 text-sm font-semibold text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none h-8"
                      aria-label="Select AM or PM"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {error && (
        <p
          id={`${inputId}-error`}
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
