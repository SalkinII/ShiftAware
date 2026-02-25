import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
}

export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div
      className={cn(
        "bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]",
        className
      )}
    >
      {children}
    </div>
  );
}
