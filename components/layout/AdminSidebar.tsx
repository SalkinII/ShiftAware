"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  Users,
  Clock,
  Settings2,
  History,
  AlertTriangle,
  Send,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminItems = [
  { label: "Festival Setup", href: "/admin/festival/setup", icon: Settings },
  { label: "Team Manage", href: "/admin/team/manage", icon: Users },
  { label: "Shift Templates", href: "/admin/shifts/templates", icon: Clock },
  {
    label: "Shift Schedule",
    href: "/admin/shifts/schedule",
    icon: CalendarDays,
  },
  { label: "Allocation", href: "/admin/allocation", icon: Settings2 },
  { label: "Coverage Gaps", href: "/admin/coverage", icon: AlertTriangle },
  { label: "Publish", href: "/admin/publish", icon: Send },
  { label: "Audit Log", href: "/admin/audit", icon: History },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 overflow-y-auto hidden lg:block scrollbar-hide">
      <div className="p-4 pb-36 space-y-8">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-4">
            Administration
          </p>
          <div className="space-y-1">
            {adminItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
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

        <div className="pt-4 border-t border-gray-100">
          <Link
            href="/app/dashboard"
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
          >
            <span className="text-lg">←</span>
            <span>Back to User View</span>
          </Link>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="p-4 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">
            Admin Mode
          </p>
          <p className="text-sm font-semibold truncate">Full Access Enabled</p>
        </div>
      </div>
    </nav>
  );
}
