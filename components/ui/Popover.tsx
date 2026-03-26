"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface PopoverProps {
  children: ReactNode;
  content: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({
  children,
  content,
  open: controlledOpen,
  onOpenChange,
}: PopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, setIsOpen]);

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        {children}
      </div>
      {isOpen && (
        <div
          ref={popoverRef}
          className={cn(
            "absolute z-50 mt-2 rounded-lg border border-gray-200 bg-white shadow-lg",
            "animate-in fade-in-0 zoom-in-95",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      )}
    </div>
  );
}
