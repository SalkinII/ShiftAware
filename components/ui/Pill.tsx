"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<"gray" | "sky" | "orange" | "green" | "amber", string> = {
  gray: "bg-gray-50 text-gray-700 border-gray-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  green: "bg-green-50 text-green-700 border-green-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
};

interface PillProps {
  tone: keyof typeof TONE_CLASSES;
  pulse?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export function Pill({ tone, pulse, onClick, children, className }: PillProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border",
        TONE_CLASSES[tone],
        pulse && "animate-pulse",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
