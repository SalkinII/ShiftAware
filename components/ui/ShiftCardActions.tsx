"use client";

import { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Eye,
  Edit,
  UserPlus,
  ArrowLeftRight,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShiftCardActionsProps {
  shiftId: string;
  onViewDetails?: () => void;
  onEdit?: () => void;
  onAssignMember?: () => void;
  onSwap?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function ShiftCardActions({
  shiftId,
  onViewDetails,
  onEdit,
  onAssignMember,
  onSwap,
  onDelete,
  className = "",
}: ShiftCardActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
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

  // Close menu on Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const actions = [
    {
      label: "View Details",
      icon: Eye,
      onClick: onViewDetails,
      show: !!onViewDetails,
    },
    {
      label: "Edit Shift",
      icon: Edit,
      onClick: onEdit,
      show: !!onEdit,
    },
    {
      label: "Assign Member",
      icon: UserPlus,
      onClick: onAssignMember,
      show: !!onAssignMember,
    },
    {
      label: "Swap Assignment",
      icon: ArrowLeftRight,
      onClick: onSwap,
      show: !!onSwap,
    },
    {
      label: "Delete Shift",
      icon: Trash2,
      onClick: onDelete,
      show: !!onDelete,
      destructive: true,
    },
  ].filter((action) => action.show);

  if (actions.length === 0) return null;

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Shift actions"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px] z-50"
          role="menu"
          aria-orientation="vertical"
        >
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick?.();
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors",
                  action.destructive
                    ? "text-red-600 hover:bg-red-50"
                    : "text-gray-700 hover:bg-gray-50",
                )}
                role="menuitem"
              >
                <Icon className="w-4 h-4" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
