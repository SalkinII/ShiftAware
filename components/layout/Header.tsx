"use client";

import React, { useState } from "react";
import { LogOut, Settings, Bell, Menu, X } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface HeaderProps {
  alias?: string;
  avatarEmoji?: string;
}

export function Header({ alias = "Admin", avatarEmoji = "🐺" }: HeaderProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
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
            <span className="text-xl">🌟</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            ShiftAware
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>

          <div className="h-8 w-px bg-gray-200 mx-1"></div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-2xl shadow-inner border border-primary-100">
                {avatarEmoji}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-semibold text-gray-900 leading-tight">
                  {alias}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                  Administrator
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 ml-2">
              <button
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
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
      />
    </>
  );
}

// Mobile sidebar component
function MobileSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: "📊" },
    { label: "My Preferences", href: "/preferences", icon: "📅" },
    { label: "Schedule View", href: "/schedule", icon: "📆" },
    { label: "Coverage Gaps", href: "/admin/coverage", icon: "⚠️" },
    { label: "Export", href: "/export", icon: "📥" },
  ];

  const adminItems = [
    { label: "Team Members", href: "/admin/members", icon: "👥" },
    { label: "Shift Config", href: "/admin/shifts", icon: "⏰" },
    { label: "Assignment Control", href: "/admin/assignments", icon: "⚙️" },
    { label: "Audit Log", href: "/admin/audit", icon: "📜" },
  ];

  return (
    <aside
      className={`
        fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 
        overflow-y-auto z-50 transform transition-transform duration-300 ease-in-out
        lg:hidden
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
    >
      <div className="p-4 space-y-8">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-4">
            Main Navigation
          </p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
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

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-4">
            Administration
          </p>
          <div className="space-y-1">
            {adminItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium 
                    transition-all
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
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">
            Current Event
          </p>
          <p className="text-sm font-semibold truncate">
            Starlight Meadow 2026
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20">
              Planning
            </span>
            <span className="text-[10px] opacity-80 italic">Jun 26-29</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
