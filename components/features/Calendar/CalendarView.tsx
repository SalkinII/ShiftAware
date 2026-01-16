"use client";

import React, { useEffect, useMemo, useRef, useCallback, memo } from "react";
import {
  format,
  addDays,
  differenceInMinutes,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { List, RowComponentProps } from "react-window";
import { ShiftCardActions } from "@/components/ui/ShiftCardActions";
import { DateDropZone } from "./DateDropZone";
import "./CalendarView.css";

interface CalendarViewProps {
  shifts: any[];
  onShiftClick?: (shiftId: string) => void;
  onAssignmentClick?: (assignment: any) => void;
  selectedShiftIds?: Set<string>;
  viewType?: "Day" | "Week" | "Grid";
  startDate?: string;
  showAssignments?: boolean;
  onDateChange?: (date: string) => void;
  eventRange?: { start: string; end: string };
  onShiftEdit?: (shiftId: string) => void;
  onShiftDelete?: (shiftId: string) => void;
  onShiftAssign?: (shiftId: string) => void;
  onShiftSwap?: (shiftId: string) => void;
}

type CoverageState = "full" | "partial" | "empty";

const coverageStyles: Record<
  CoverageState,
  { badge: string; text: string; border: string; bg: string }
> = {
  full: {
    badge: "bg-success-500",
    text: "text-success-700",
    border: "border-success-100",
    bg: "bg-success-50",
  },
  partial: {
    badge: "bg-accent-500",
    text: "text-accent-700",
    border: "border-accent-100",
    bg: "bg-accent-50",
  },
  empty: {
    badge: "bg-red-500",
    text: "text-red-700",
    border: "border-red-100",
    bg: "bg-red-50",
  },
};

const typeColors: Record<string, string> = {
  MOBILE_TEAM_1: "var(--color-shift-mobile1, #0ea5e9)",
  MOBILE_TEAM_2: "var(--color-shift-mobile2, #8b5cf6)",
  STATIONARY: "var(--color-shift-stationary, #22c55e)",
  EXECUTIVE: "var(--color-shift-executive, #f59e0b)",
  BUFFER: "var(--color-shift-buffer, #78716c)",
};

const CalendarView = ({
  shifts,
  onShiftClick,
  onAssignmentClick,
  selectedShiftIds = new Set(),
  viewType = "Week",
  startDate,
  showAssignments = false,
  onDateChange,
  eventRange,
  onShiftEdit,
  onShiftDelete,
  onShiftAssign,
  onShiftSwap,
}: CalendarViewProps) => {
  const tasks = useMemo(
    () =>
      shifts.map((shift) => ({
        id: shift.id,
        text: shift.type.replace("_", " "),
        start: new Date(shift.startTime),
        end: new Date(shift.endTime),
        progress: Math.min(
          100,
          Math.round(
            ((shift.assignments?.length || 0) / (shift.capacity || 1)) * 100,
          ),
        ),
        type: "task",
        color: typeColors[shift.type] || "var(--color-primary-500)",
        capacity: shift.capacity,
        assignments: shift.assignments || [],
      })),
    [shifts],
  );

  const baseDate = useMemo(() => {
    if (startDate) return new Date(startDate);
    if (tasks.length > 0) return tasks[0].start;
    // If no shifts and no startDate, use today
    return new Date();
  }, [startDate, tasks]);

  const dayStarts = useMemo(() => {
    const dates = new Set<string>();
    shifts.forEach((shift) => {
      dates.add(shift.startTime.split("T")[0]);
    });
    if (startDate) {
      dates.add(startDate);
    }
    const sorted = Array.from(dates).sort();
    if (sorted.length === 0) {
      return [startOfDay(baseDate)];
    }
    return sorted.map((date) => startOfDay(new Date(date)));
  }, [shifts, startDate, baseDate]);

  // Calculate date range from all shifts, not just baseDate
  const allShiftDates = useMemo(() => {
    const dates = new Set<string>();
    shifts.forEach((shift) => {
      dates.add(shift.startTime.split("T")[0]);
    });
    if (startDate) {
      dates.add(startDate);
    }
    return Array.from(dates).sort();
  }, [shifts, startDate]);

  const minDate = useMemo(() => {
    if (allShiftDates.length > 0) {
      return new Date(allShiftDates[0]);
    }
    return startDate ? new Date(startDate) : new Date();
  }, [allShiftDates, startDate]);

  const maxDate = useMemo(() => {
    if (allShiftDates.length > 0) {
      return new Date(allShiftDates[allShiftDates.length - 1]);
    }
    return startDate ? new Date(startDate) : addDays(new Date(), 7);
  }, [allShiftDates, startDate]);

  const startBound = useMemo(
    () =>
      viewType === "Day"
        ? startDate
          ? startOfDay(new Date(startDate))
          : dayStarts[0] || startOfDay(new Date())
        : startDate
          ? startOfWeek(new Date(startDate), { weekStartsOn: 1 })
          : startOfWeek(baseDate, { weekStartsOn: 1 }),
    [baseDate, dayStarts, viewType, startDate],
  );

  const endBound = useMemo(
    () =>
      viewType === "Day" ? addDays(startBound, 1) : addDays(startBound, 7),
    [startBound, viewType],
  );

  const totalMinutes = useMemo(
    () => Math.max(1, differenceInMinutes(endBound, startBound)),
    [startBound, endBound],
  );

  const sortedShifts = useMemo(
    () =>
      [...shifts].sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      ),
    [shifts],
  );

  // Memoize sorted shifts for grid view to avoid re-sorting multiple times
  const sortedShiftsForGrid = useMemo(() => sortedShifts, [sortedShifts]);

  const scaleSegments = viewType === "Day" ? dayStarts.length * 24 : 7;
  const minCellPx = viewType === "Day" ? 88 : 120;
  const scaleMinWidth = scaleSegments * minCellPx;
  const gridTemplateColumns = `repeat(${scaleSegments}, minmax(${minCellPx}px, 1fr))`;
  const dayWidth = useMemo(() => 24 * minCellPx, [minCellPx]);

  const activeDayIndex = useMemo(() => {
    if (viewType !== "Day") return 0;
    const key = format(startOfDay(baseDate), "yyyy-MM-dd");
    const index = dayStarts.findIndex(
      (day) => format(day, "yyyy-MM-dd") === key,
    );
    return index >= 0 ? index : 0;
  }, [baseDate, dayStarts, viewType]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (viewType !== "Day") return;
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      left: activeDayIndex * dayWidth,
      behavior: "smooth",
    });
  }, [activeDayIndex, dayWidth, viewType]);

  const members = useMemo(() => {
    const memberMap = new Map<string, any>();
    shifts.forEach((shift) => {
      shift.assignments?.forEach((a: any) => {
        if (a.teamMember) {
          memberMap.set(a.teamMember.id, a.teamMember);
        }
      });
    });
    return Array.from(memberMap.values()).sort((a, b) =>
      a.alias.localeCompare(b.alias),
    );
  }, [shifts]);

  const getCoverage = useCallback((shift: any): CoverageState => {
    const filled = shift.assignments?.length || 0;
    if (filled >= shift.capacity) return "full";
    if (filled > 0) return "partial";
    return "empty";
  }, []);

  const renderGridView = () => {
    return (
      <div className="calendar-grid-view overflow-auto h-full bg-white">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <tr>
              <th className="p-4 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-r sticky left-0 bg-gray-50 z-30">
                Team Member
              </th>
              {sortedShiftsForGrid.map((shift) => {
                const shiftDate = new Date(shift.startTime);
                return (
                  <DateDropZone
                    key={shift.id}
                    date={shiftDate}
                    as="th"
                    className="p-4 text-center border-b border-r min-w-[140px]"
                  >
                    <div className="text-[10px] font-black uppercase tracking-tighter text-gray-400 mb-1">
                      {format(shiftDate, "MMM d")}
                    </div>
                    <div className="text-xs font-bold text-gray-700 whitespace-nowrap">
                      {format(new Date(shift.startTime), "HH:mm")} -{" "}
                      {format(new Date(shift.endTime), "HH:mm")}
                    </div>
                    <div className="text-[9px] font-bold text-primary-500 mt-1">
                      {shift.type.replace("_", " ")}
                    </div>
                  </DateDropZone>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.id}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="p-4 border-b border-r font-bold text-sm text-gray-900 sticky left-0 bg-white z-10 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{member.avatarId}</span>
                    <span>{member.alias}</span>
                  </div>
                </td>
                {sortedShiftsForGrid.map((shift) => {
                  const isAssigned = shift.assignments?.some(
                    (a: any) => a.teamMember.id === member.id,
                  );
                  const status = getCoverage(shift);
                  const style = coverageStyles[status];

                  return (
                    <td
                      key={`${member.id}-${shift.id}`}
                      className="p-2 border-b border-r text-center"
                    >
                      {isAssigned ? (
                        <div
                          onClick={() => onAssignmentClick?.(shift)}
                          className={`mx-auto w-10 h-10 rounded-xl ${style.bg} ${style.border} border flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-sm`}
                        >
                          <span className="text-lg">✓</span>
                        </div>
                      ) : (
                        <div className="text-gray-100 text-xs font-black select-none">
                          ···
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Memoize callbacks for ShiftCardActions to prevent re-renders
  const handleViewDetails = useCallback(
    (shift: any) => {
      if (showAssignments) {
        onAssignmentClick?.(shift);
      } else {
        onShiftClick?.(shift.id);
      }
    },
    [showAssignments, onAssignmentClick, onShiftClick],
  );

  const handleShiftEdit = useCallback(
    (shiftId: string) => {
      onShiftEdit?.(shiftId);
    },
    [onShiftEdit],
  );

  const handleShiftAssign = useCallback(
    (shiftId: string) => {
      onShiftAssign?.(shiftId);
    },
    [onShiftAssign],
  );

  const handleShiftSwap = useCallback(
    (shiftId: string) => {
      onShiftSwap?.(shiftId);
    },
    [onShiftSwap],
  );

  const handleShiftDelete = useCallback(
    (shiftId: string) => {
      onShiftDelete?.(shiftId);
    },
    [onShiftDelete],
  );

  const handleTrackClick = useCallback(
    (shift: any) => {
      if (showAssignments) {
        onAssignmentClick?.(shift);
      } else {
        onShiftClick?.(shift.id);
      }
    },
    [showAssignments, onAssignmentClick, onShiftClick],
  );

  // Memoize date navigation callbacks
  const handlePreviousDate = useCallback(() => {
    if (!onDateChange) return;
    const current = startDate ? new Date(startDate) : baseDate;
    const change = viewType === "Day" ? -1 : -7;
    const newDate = addDays(current, change);
    const newDateKey = format(newDate, "yyyy-MM-dd");

    const minAllowed = format(addDays(minDate, -365), "yyyy-MM-dd");
    const maxAllowed = format(addDays(maxDate, 365), "yyyy-MM-dd");

    if (newDateKey >= minAllowed && newDateKey <= maxAllowed) {
      onDateChange(newDateKey);
    }
  }, [onDateChange, startDate, baseDate, viewType, minDate, maxDate]);

  const handleNextDate = useCallback(() => {
    if (!onDateChange) return;
    const current = startDate ? new Date(startDate) : baseDate;
    const change = viewType === "Day" ? 1 : 7;
    const newDate = addDays(current, change);
    const newDateKey = format(newDate, "yyyy-MM-dd");

    const minAllowed = format(addDays(minDate, -365), "yyyy-MM-dd");
    const maxAllowed = format(addDays(maxDate, 365), "yyyy-MM-dd");

    if (newDateKey >= minAllowed && newDateKey <= maxAllowed) {
      onDateChange(newDateKey);
    }
  }, [onDateChange, startDate, baseDate, viewType, minDate, maxDate]);

  const handleTodayClick = useCallback(() => {
    if (!onDateChange) return;
    const today = format(new Date(), "yyyy-MM-dd");
    onDateChange(today);
  }, [onDateChange]);

  const handleDatePickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!onDateChange) return;
      const selectedDate = e.target.value;
      if (selectedDate) {
        const minAllowed = format(addDays(minDate, -365), "yyyy-MM-dd");
        const maxAllowed = format(addDays(maxDate, 365), "yyyy-MM-dd");

        if (selectedDate >= minAllowed && selectedDate <= maxAllowed) {
          onDateChange(selectedDate);
        }
      }
    },
    [onDateChange, minDate, maxDate],
  );

  // Memoized TimelineRow component
  type TimelineRowProps = {
    shifts: any[];
    index: number;
    style: React.CSSProperties;
    startBound: Date;
    totalMinutes: number;
    selectedShiftIds: Set<string>;
    showAssignments: boolean;
    getCoverage: (shift: any) => CoverageState;
    onTrackClick: (shift: any) => void;
    onViewDetails: (shift: any) => void;
    onShiftEdit?: (shiftId: string) => void;
    onShiftAssign?: (shiftId: string) => void;
    onShiftSwap?: (shiftId: string) => void;
    onShiftDelete?: (shiftId: string) => void;
  };

  const TimelineRow = memo(
    ({
      shifts,
      index,
      style,
      startBound,
      totalMinutes,
      selectedShiftIds,
      showAssignments,
      getCoverage,
      onTrackClick,
      onViewDetails,
      onShiftEdit,
      onShiftAssign,
      onShiftSwap,
      onShiftDelete,
    }: TimelineRowProps) => {
      const shift = shifts[index];
      const start = new Date(shift.startTime);
      const end = new Date(shift.endTime);
      const filled = shift.assignments?.length || 0;
      const capacity = shift.capacity || 0;
      const status = getCoverage(shift);

      // Calculate position relative to startBound
      const startMinutes = differenceInMinutes(start, startBound);
      const endMinutes = differenceInMinutes(end, startBound);

      // Clip shift to visible bounds
      const visibleStartMinutes = Math.max(0, startMinutes);
      const visibleEndMinutes = Math.min(totalMinutes, endMinutes);

      // Calculate left position (percentage from startBound)
      const left = Math.max(0, (visibleStartMinutes / totalMinutes) * 100);

      // Calculate width (percentage of visible portion)
      const visibleDuration = Math.max(
        0,
        visibleEndMinutes - visibleStartMinutes,
      );
      let width = Math.max(12, (visibleDuration / totalMinutes) * 100);

      // Ensure shift doesn't extend beyond 100%
      if (left + width > 100) {
        width = Math.max(8, 100 - left);
      }

      const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
          id: `shift-${shift.id}`,
          data: {
            type: "shift",
            shift,
          },
        });

      const barStyle: React.CSSProperties = {
        left: `${left}%`,
        width: `${width}%`,
        transform: transform ? CSS.Transform.toString(transform) : undefined,
        opacity: isDragging ? 0.7 : 1,
      };

      // If shift is completely outside visible range, render empty row
      if (
        visibleDuration <= 0 ||
        endMinutes < 0 ||
        startMinutes > totalMinutes
      ) {
        return (
          <div style={style} className="timeline-row" aria-hidden="true">
            {/* Empty row for shifts outside visible range */}
          </div>
        );
      }

      // Create stable callbacks for ShiftCardActions
      const handleViewDetailsClick = () => onViewDetails(shift);
      const handleEditClick = onShiftEdit
        ? () => onShiftEdit(shift.id)
        : undefined;
      const handleAssignClick = onShiftAssign
        ? () => onShiftAssign(shift.id)
        : undefined;
      const handleSwapClick = onShiftSwap
        ? () => onShiftSwap(shift.id)
        : undefined;
      const handleDeleteClick = onShiftDelete
        ? () => onShiftDelete(shift.id)
        : undefined;
      const handleTrackClickLocal = () => onTrackClick(shift);

      return (
        <div style={style} className="timeline-row">
          <div className="timeline-row__meta">
            <div className="timeline-row__title">
              <span className="timeline-row__type">
                {shift.type.replace("_", " ")}
              </span>
              <span className="timeline-row__time">
                {format(start, "HH:mm")} — {format(end, "HH:mm")}
              </span>
            </div>
            <div className={`timeline-row__pill ${status}`}>
              {filled}/{capacity}{" "}
              {status === "full"
                ? "Filled"
                : status === "partial"
                  ? "In Progress"
                  : "Open"}
            </div>
          </div>
          <div className="timeline-track" onClick={handleTrackClickLocal}>
            <div
              className={`timeline-bar ${status} ${selectedShiftIds.has(shift.id) ? "is-selected" : ""}`}
              ref={setNodeRef}
              style={barStyle}
            >
              <div className="timeline-bar__label">
                <span
                  {...attributes}
                  {...listeners}
                  className="inline-flex items-center cursor-grab active:cursor-grabbing opacity-80"
                  aria-label="Drag shift to reschedule"
                  title="Drag shift to reschedule"
                >
                  <GripVertical className="w-3 h-3" />
                </span>
                <span>{filled} assigned</span>
                <span className="timeline-bar__capacity">cap {capacity}</span>
              </div>
              <div className="timeline-bar__actions">
                <ShiftCardActions
                  shiftId={shift.id}
                  onViewDetails={handleViewDetailsClick}
                  onEdit={handleEditClick}
                  onAssignMember={handleAssignClick}
                  onSwap={handleSwapClick}
                  onDelete={handleDeleteClick}
                />
              </div>
            </div>
          </div>
        </div>
      );
    },
    (prevProps, nextProps) => {
      // Custom comparison for React.memo
      return (
        prevProps.index === nextProps.index &&
        prevProps.shifts[nextProps.index]?.id ===
          nextProps.shifts[nextProps.index]?.id &&
        prevProps.selectedShiftIds.has(
          nextProps.shifts[nextProps.index]?.id,
        ) ===
          nextProps.selectedShiftIds.has(
            nextProps.shifts[nextProps.index]?.id,
          ) &&
        prevProps.showAssignments === nextProps.showAssignments &&
        prevProps.startBound.getTime() === nextProps.startBound.getTime() &&
        prevProps.totalMinutes === nextProps.totalMinutes
      );
    },
  );

  TimelineRow.displayName = "TimelineRow";

  const renderTimeline = () => {
    // Don't show empty state here - navigation should always be visible
    // Empty state will be handled by the timeline list itself

    const Row = ({ index, style }: RowComponentProps<{ shifts: any[] }>) => {
      return (
        <TimelineRow
          shifts={sortedShifts}
          index={index}
          style={style}
          startBound={startBound}
          totalMinutes={totalMinutes}
          selectedShiftIds={selectedShiftIds}
          showAssignments={showAssignments}
          getCoverage={getCoverage}
          onTrackClick={handleTrackClick}
          onViewDetails={handleViewDetails}
          onShiftEdit={onShiftEdit}
          onShiftAssign={onShiftAssign}
          onShiftSwap={onShiftSwap}
          onShiftDelete={onShiftDelete}
        />
      );
    };

    // Ensure navigation is always available, even with empty shifts
    const hasShifts = sortedShifts.length > 0;

    return (
      <div className="timeline-container">
        <div
          className={`timeline-scroll${viewType === "Day" ? " timeline-scroll--snap" : ""}`}
          ref={scrollRef}
          style={
            {
              "--timeline-min-width": `${scaleMinWidth}px`,
              "--timeline-day-width": `${dayWidth}px`,
            } as React.CSSProperties
          }
        >
          <div className="timeline-canvas">
            {viewType === "Day" && (
              <div className="timeline-day-markers" aria-hidden="true">
                {dayStarts.map((day) => (
                  <DateDropZone
                    key={`day-${format(day, "yyyy-MM-dd")}`}
                    date={day}
                    className="timeline-day-marker"
                  />
                ))}
              </div>
            )}
            {/* Date display navigation - Day and Week views */}
            {(viewType === "Day" || viewType === "Week") && onDateChange && (
              <div className="mb-4 flex items-center justify-center">
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
                  {/* Previous button */}
                  <button
                    onClick={handlePreviousDate}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={`Previous ${viewType === "Day" ? "day" : "week"}`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Date display */}
                  <div className="text-sm font-bold uppercase tracking-widest text-gray-700 px-3 min-w-[180px] text-center">
                    {viewType === "Day" ? (
                      format(
                        new Date(startDate || baseDate),
                        "EEEE, MMMM d, yyyy",
                      )
                    ) : (
                      <>
                        {format(startBound, "MMM d")} -{" "}
                        {format(addDays(startBound, 6), "MMM d, yyyy")}
                      </>
                    )}
                  </div>

                  {/* Date picker for quick navigation */}
                  <input
                    type="date"
                    value={
                      viewType === "Day"
                        ? format(new Date(startDate || baseDate), "yyyy-MM-dd")
                        : format(startBound, "yyyy-MM-dd")
                    }
                    onChange={handleDatePickerChange}
                    min={format(addDays(minDate, -365), "yyyy-MM-dd")}
                    max={format(addDays(maxDate, 365), "yyyy-MM-dd")}
                    className="px-2 py-1 text-xs rounded-lg border border-gray-300 text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none bg-white"
                    aria-label="Jump to date"
                    title="Jump to specific date"
                  />

                  {/* Next button */}
                  <button
                    onClick={handleNextDate}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={`Next ${viewType === "Day" ? "day" : "week"}`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Today button */}
                  <button
                    onClick={handleTodayClick}
                    className="px-3 py-1 text-xs font-semibold text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition"
                    aria-label="Jump to today"
                  >
                    Today
                  </button>
                </div>
              </div>
            )}
            {/* Infinite scroll timeline scale - only on smaller screens */}
            <div className="timeline-scale-container timeline-scale-container--infinite">
              {/* First copy - starts at 0, animates to -200% */}
              <div
                className="timeline-scale timeline-scale--infinite"
                data-first
                style={{ gridTemplateColumns }}
              >
                {viewType === "Day"
                  ? Array.from({ length: scaleSegments }, (_, i) => (
                      <div
                        key={`h-first-${i}`}
                        className="timeline-scale__cell"
                      >
                        {i % 24}:00
                      </div>
                    ))
                  : Array.from({ length: 7 }, (_, i) => {
                      const day = addDays(startBound, i);
                      return (
                        <DateDropZone
                          key={`d-first-${i}`}
                          date={day}
                          className="timeline-scale__cell"
                        >
                          {format(day, "EEE d")}
                        </DateDropZone>
                      );
                    })}
              </div>
              {/* Second copy - starts at 100%, animates to -100% */}
              <div
                className="timeline-scale timeline-scale--infinite"
                style={{ gridTemplateColumns }}
              >
                {viewType === "Day"
                  ? Array.from({ length: scaleSegments }, (_, i) => (
                      <div
                        key={`h-second-${i}`}
                        className="timeline-scale__cell"
                      >
                        {i % 24}:00
                      </div>
                    ))
                  : Array.from({ length: 7 }, (_, i) => {
                      const day = addDays(startBound, i);
                      return (
                        <div
                          key={`d-second-${i}`}
                          className="timeline-scale__cell"
                        >
                          {format(day, "EEE d")}
                        </div>
                      );
                    })}
              </div>
              {/* Third copy - starts delayed, animates to -100% */}
              <div
                className="timeline-scale timeline-scale--infinite"
                data-last
                style={{ gridTemplateColumns }}
              >
                {viewType === "Day"
                  ? Array.from({ length: scaleSegments }, (_, i) => (
                      <div
                        key={`h-third-${i}`}
                        className="timeline-scale__cell"
                      >
                        {i % 24}:00
                      </div>
                    ))
                  : Array.from({ length: 7 }, (_, i) => {
                      const day = addDays(startBound, i);
                      return (
                        <div
                          key={`d-third-${i}`}
                          className="timeline-scale__cell"
                        >
                          {format(day, "EEE d")}
                        </div>
                      );
                    })}
              </div>
              {/* Fade overlay for smooth edges */}
              <div className="timeline-scale-fade" aria-hidden="true"></div>
            </div>
            {sortedShifts.length === 0 ? (
              <div className="timeline-empty" style={{ padding: "2rem" }}>
                <div className="timeline-empty__icon">📅</div>
                <div className="timeline-empty__text">No shifts to display</div>
                <div className="text-sm text-gray-500 mt-2">
                  {viewType === "Day"
                    ? "No shifts found for this date"
                    : viewType === "Week"
                      ? "No shifts found for this week"
                      : "No shifts found"}
                </div>
              </div>
            ) : (
              <List
                defaultHeight={520}
                rowCount={sortedShifts.length}
                rowHeight={132}
                rowComponent={Row}
                rowProps={{ shifts: sortedShifts }}
                className="timeline-list"
                style={{ height: "100%", width: "100%" }}
              >
                {null}
              </List>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="calendar-container">
      {viewType === "Grid" ? renderGridView() : renderTimeline()}
    </div>
  );
};

export default CalendarView;
