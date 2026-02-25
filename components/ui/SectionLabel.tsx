import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <label
      className={cn(
        "text-xs font-semibold text-gray-500 uppercase tracking-wider block",
        className
      )}
    >
      {children}
    </label>
  );
}
