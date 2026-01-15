"use client";

import React, { useEffect, useMemo, useRef } from "react";
import {
  format,
  addDays,
  differenceInMinutes,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { List, RowComponentProps } from "react-window";
import "./CalendarView.css";

interface CalendarViewProps {
  shifts: any[];
  onShiftClick?: (shiftId: string) => void;
  onAssignmentClick?: (assignment: any) => void;
  selectedShiftIds?: Set<string>;
  viewType?: "Day" | "Week" | "Grid";
  startDate?: string;
  showAssignments?: boolean;
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

  const startBound = useMemo(
    () =>
      viewType === "Day"
        ? dayStarts[0]
        : startOfWeek(baseDate, { weekStartsOn: 1 }),
    [baseDate, dayStarts, viewType],
  );

  const endBound = useMemo(
    () =>
      viewType === "Day"
        ? addDays(startBound, dayStarts.length)
        : addDays(startBound, 7),
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

  const getCoverage = (shift: any): CoverageState => {
    const filled = shift.assignments?.length || 0;
    if (filled >= shift.capacity) return "full";
    if (filled > 0) return "partial";
    return "empty";
  };

  const renderGridView = () => {
    return (
      <div className="calendar-grid-view overflow-auto h-full bg-white">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <tr>
              <th className="p-4 text-left text-xs font-black uppercase tracking-widest text-gray-500 border-b border-r sticky left-0 bg-gray-50 z-30">
                Team Member
              </th>
              {shifts
                .sort(
                  (a, b) =>
                    new Date(a.startTime).getTime() -
                    new Date(b.startTime).getTime(),
                )
                .map((shift) => (
                  <th
                    key={shift.id}
                    className="p-4 text-center border-b border-r min-w-[140px]"
                  >
                    <div className="text-[10px] font-black uppercase tracking-tighter text-gray-400 mb-1">
                      {format(new Date(shift.startTime), "MMM d")}
                    </div>
                    <div className="text-xs font-bold text-gray-700 whitespace-nowrap">
                      {format(new Date(shift.startTime), "HH:mm")} -{" "}
                      {format(new Date(shift.endTime), "HH:mm")}
                    </div>
                    <div className="text-[9px] font-bold text-primary-500 mt-1">
                      {shift.type.replace("_", " ")}
                    </div>
                  </th>
                ))}
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
                {shifts
                  .sort(
                    (a, b) =>
                      new Date(a.startTime).getTime() -
                      new Date(b.startTime).getTime(),
                  )
                  .map((shift) => {
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

  const renderTimeline = () => {
    if (sortedShifts.length === 0) {
      return (
        <div className="timeline-empty">
          <div className="timeline-empty__icon">📅</div>
          <div className="timeline-empty__text">No shifts to display</div>
        </div>
      );
    }

    type TimelineRowProps = { shifts: any[] };

    const Row = ({
      index,
      style,
      shifts,
    }: RowComponentProps<TimelineRowProps>) => {
      const shift = shifts[index];
      const start = new Date(shift.startTime);
      const end = new Date(shift.endTime);
      const filled = shift.assignments?.length || 0;
      const capacity = shift.capacity || 0;
      const status = getCoverage(shift);
      const left = Math.max(
        0,
        (differenceInMinutes(start, startBound) / totalMinutes) * 100,
      );
      const rawWidth = Math.max(
        2,
        (differenceInMinutes(end, start) / totalMinutes) * 100,
      );
      let width = Math.max(12, rawWidth); // ensure enough space for labels
      if (left + width > 100) {
        width = Math.max(8, 100 - left); // keep inside track even near the right edge
      }

      return (
        <div style={style} className="timeline-row">
          <div className="timeline-row__meta">
            <div className="timeline-row__title">
              <span className="timeline-row__type">
                {shift.type.replace("_", " ")}
              </span>
              <span className="timeline-row__time">
                {format(start, "EEE, MMM d HH:mm")} — {format(end, "HH:mm")}
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
          <div
            className="timeline-track"
            onClick={() =>
              showAssignments
                ? onAssignmentClick?.(shift)
                : onShiftClick?.(shift.id)
            }
          >
            <div
              className={`timeline-bar ${status} ${selectedShiftIds.has(shift.id) ? "is-selected" : ""}`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
              }}
            >
              <div className="timeline-bar__label">
                <span>{shift.assignments?.length || 0} assigned</span>
                <span className="timeline-bar__capacity">cap {capacity}</span>
              </div>
            </div>
          </div>
        </div>
      );
    };

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
                  <div
                    key={`day-${format(day, "yyyy-MM-dd")}`}
                    className="timeline-day-marker"
                  />
                ))}
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
                        <div
                          key={`d-first-${i}`}
                          className="timeline-scale__cell"
                        >
                          {format(day, "EEE d")}
                        </div>
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
