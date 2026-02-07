"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  Download,
  Users,
  Clock,
  Settings2,
  History,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useEventContext,
  formatEventDateRange,
} from "@/lib/hooks/useEventContext";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Preferences", href: "/preferences", icon: CalendarCheck },
  { label: "Schedule View", href: "/schedule", icon: CalendarDays },
  { label: "Coverage Gaps", href: "/admin/coverage", icon: AlertTriangle },
  { label: "Export", href: "/export", icon: Download },
];

const adminItems = [
  { label: "Team Members", href: "/admin/members", icon: Users },
  { label: "Shift Config", href: "/admin/shifts", icon: Clock },
  { label: "Templates", href: "/admin/shifts/templates", icon: Clock },
  { label: "Assignment Control", href: "/admin/assignments", icon: Settings2 },
  { label: "Audit Log", href: "/admin/audit", icon: History },
];

export function Sidebar() {
  const pathname = usePathname();
  const { selectedEvent: event, loading: eventLoading } = useEventContext(false);

  return (
    <nav className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto hidden lg:block scrollbar-hide">
      <div className="p-4 pb-36 space-y-8">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-4">
            Main Navigation
          </p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                    isActive
                      ? "bg-primary-50 text-primary-700 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] border border-primary-100"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-colors duration-200",
                      isActive
                        ? "text-primary-600"
                        : "text-gray-400 group-hover:text-gray-600",
                    )}
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-4">
            Administration
          </p>
          <div className="space-y-1">
            {adminItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                    isActive
                      ? "bg-primary-50 text-primary-700 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] border border-primary-100"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-colors duration-200",
                      isActive
                        ? "text-primary-600"
                        : "text-gray-400 group-hover:text-gray-600",
                    )}
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">
            Current Event
          </p>
          {eventLoading ? (
            <div className="h-4 w-32 bg-white/20 rounded animate-pulse" />
          ) : event ? (
            <>
              <p className="text-sm font-semibold truncate">{event.name}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 capitalize">
                  {event.status.toLowerCase().replace("_", " ")}
                </span>
                <span className="text-[10px] opacity-80 italic">
                  {formatEventDateRange(event.startDate, event.endDate)}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm font-semibold truncate opacity-70">
              No event
            </p>
          )}
        </div>
      </div>
    </nav>
  );
}
