"use client";

import React, { useState, useEffect } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isAdminClient } from "@/lib/auth-client";
import { EventSelector } from "@/components/ui/EventSelector";
import { useEventContext, formatEventDateRange } from "@/lib/hooks/useEventContext";
import { useMemberContext } from "@/lib/hooks/useMemberContext";
import {
  EMOJI_ADMIN,
  EMOJI_DEFAULT_USER,
  EMOJI_APP_LOGO,
} from "@/lib/constants/emojis";

interface HeaderProps {
  alias?: string;
  avatarEmoji?: string;
}

export function Header({ alias, avatarEmoji }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const { selectedMember } = useMemberContext();
  const isAdminRoute = pathname?.startsWith("/admin");
  const {
    selectedEventId,
    events,
    setSelectedEventId,
    loading: eventsLoading,
  } = useEventContext(isAdminRoute);

  useEffect(() => {
    setIsAdmin(isAdminClient());
  }, []);

  // Role-based defaults: Admin=🐻, User=🦥
  const displayAlias = alias ?? (isAdmin ? "Admin" : "Team Member");
  const displayEmoji =
    avatarEmoji ?? (isAdmin ? EMOJI_ADMIN : EMOJI_DEFAULT_USER);

  // Build identity display string
  const identityDisplay = selectedMember
    ? `${selectedMember.avatarId} ${selectedMember.alias}`
    : null;

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        localStorage.removeItem("selectedMemberId");
        localStorage.removeItem("selectedEventId");
        localStorage.removeItem("adminSelectedEventId");
        router.push("/login");
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <div className="bg-primary-500 p-1.5 rounded-lg text-white">
            <span className="text-xl">{EMOJI_APP_LOGO}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            ShiftAware
          </h1>
        </div>

        {/* Center: Event Selector (admin only) */}
        {isAdminRoute && !eventsLoading && (
          <div className="hidden md:flex items-center">
            <EventSelector
              events={events}
              selectedEventId={selectedEventId}
              onSelect={setSelectedEventId}
              placeholder="Select event..."
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Identity display */}
          {identityDisplay && (
            <Link
              href="/app/identity"
              className="hidden md:flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span>{identityDisplay}</span>
            </Link>
          )}

          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-2xl shadow-inner border border-primary-100">
              {displayEmoji}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-gray-900 leading-tight">
                {displayAlias}
              </p>
              <p
                className={`text-[10px] uppercase tracking-wider font-medium ${
                  isAdmin ? "text-red-500" : "text-gray-500"
                }`}
              >
                {isAdmin ? "Administrator" : "Team Member"}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <MobileSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        events={events}
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
      />
    </>
  );
}

// Mobile sidebar component - route-aware like desktop sidebars
function MobileSidebar({
  isOpen,
  onClose,
  events: _events,
  selectedEventId: _selectedEventId,
  onSelectEvent: _onSelectEvent,
}: {
  isOpen: boolean;
  onClose: () => void;
  events: any[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const { selectedEvent: event, loading: eventLoading } = useEventContext(false);

  useEffect(() => {
    setIsAdmin(isAdminClient());
  }, []);

  // Determine if we're in admin section
  const isInAdminSection = pathname.startsWith("/admin");

  // User navigation items (matching UserSidebar)
  const userNavItems = [
    { label: "Calendar", href: "/app/calendar", icon: "📆" },
    { label: "Switch Identity", href: "/app/identity", icon: "👤" },
  ];

  // Admin navigation items (matching AdminSidebar)
  const adminNavItems = [
    { label: "Event Setup", href: "/admin/setup", icon: "⚙️" },
    { label: "Shift Schedule", href: "/admin/shifts/schedule", icon: "📅" },
    { label: "Team Management", href: "/admin/team", icon: "👥" },
    { label: "Audit Log", href: "/admin/audit", icon: "📜" },
  ];

  // Choose items based on current section
  const navItems = isInAdminSection ? adminNavItems : userNavItems;
  const sectionLabel = isInAdminSection ? "Administration" : "Main Navigation";

  return (
    <aside
      className={`
        fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 
        overflow-y-auto z-50 transform transition-transform duration-300 ease-in-out
        lg:hidden
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      {/* pb-36 accounts for the fixed bottom card height */}
      <div className="p-4 pb-36 space-y-8">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-4">
            {sectionLabel}
          </p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium 
                    transition-all text-left
                    ${
                      isActive
                        ? "bg-primary-50 text-primary-700 shadow-sm border border-primary-100"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }
                  `}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Context switch: Admin Panel link (user section) or Back to User View (admin section) */}
        {isAdmin && !isInAdminSection && (
          <div className="pt-4 border-t border-gray-100">
            <Link
              href="/admin/setup"
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
            >
              <span className="text-xl">⚙️</span>
              <span>Admin Panel</span>
            </Link>
          </div>
        )}

        {isInAdminSection && (
          <div className="pt-4 border-t border-gray-100">
            <Link
              href="/app/calendar"
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
            >
              <span className="text-xl">←</span>
              <span>Back to User View</span>
            </Link>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50/50">
        <div
          className={`p-4 rounded-xl text-white shadow-lg ${
            isInAdminSection
              ? "bg-gradient-to-br from-red-500 to-red-600"
              : "bg-gradient-to-br from-primary-500 to-primary-600"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">
            {isInAdminSection ? "Admin Mode" : "Current Event"}
          </p>
          {isInAdminSection ? (
            <p className="text-sm font-semibold truncate">
              Full Access Enabled
            </p>
          ) : eventLoading ? (
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
    </aside>
  );
}
