"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Lock } from "lucide-react";
import { ANIMAL_EMOJI_CATEGORIES } from "@/lib/constants/emojis";
import { cn } from "@/lib/utils";

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function EmojiPicker({
  value,
  onChange,
  label,
  error,
  disabled = false,
  className,
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter emojis based on search
  const filteredCategories = Object.entries(ANIMAL_EMOJI_CATEGORIES).reduce(
    (acc, [category, emojis]) => {
      const filtered = emojis.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.emoji.includes(search),
      );
      if (filtered.length > 0) {
        acc[category] = filtered;
      }
      return acc;
    },
    {} as Record<string, { id: string; emoji: string; name: string; reserved: boolean }[]>,
  );

  const handleSelect = (emoji: string, reserved: boolean) => {
    if (reserved || disabled) return;
    onChange(emoji);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 border rounded-lg transition-all",
          "focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
          disabled
            ? "bg-gray-100 cursor-not-allowed"
            : "bg-white hover:border-gray-400",
          error ? "border-red-300" : "border-gray-300",
        )}
      >
        <span className="flex items-center gap-2">
          <span className="text-2xl">{value || "🐾"}</span>
          <span className="text-sm text-gray-500">
            {value ? "Change avatar" : "Select avatar"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-gray-400 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[320px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search animals..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                autoFocus
              />
            </div>
          </div>

          {/* Emoji grid */}
          <div className="max-h-64 overflow-y-auto p-2">
            {Object.entries(filteredCategories).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No animals found
              </p>
            ) : (
              Object.entries(filteredCategories).map(([category, emojis]) => (
                <div key={category} className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2">
                    {category}
                  </p>
                  <div className="grid grid-cols-6 gap-1">
                    {emojis.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.emoji, item.reserved)}
                        disabled={item.reserved}
                        title={
                          item.reserved ? `${item.name} (Reserved)` : item.name
                        }
                        className={cn(
                          "relative p-2 text-2xl rounded-lg transition-all",
                          item.reserved
                            ? "opacity-40 cursor-not-allowed bg-gray-100"
                            : "hover:bg-primary-50 hover:scale-110 cursor-pointer",
                          value === item.emoji &&
                            !item.reserved &&
                            "bg-primary-100 ring-2 ring-primary-500",
                        )}
                      >
                        {item.emoji}
                        {item.reserved && (
                          <Lock className="absolute bottom-0 right-0 w-3 h-3 text-gray-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Reserved legend */}
          <div className="p-2 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Reserved emojis: 🐻 Admin, 🦥 Default User</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
