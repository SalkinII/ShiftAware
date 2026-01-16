import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  hover?: boolean;
  interactive?: boolean;
}

export function Card({
  children,
  className = "",
  elevation = 1,
  hover = false,
  interactive = false,
}: CardProps) {
  const elevationClasses = {
    0: "shadow-none",
    1: "shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]",
    2: "shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]",
    3: "shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]",
    4: "shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)]",
    5: "shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]",
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-gray-200 bg-white p-3 transition-all duration-200",
        elevationClasses[elevation],
        hover &&
          "hover:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]",
        interactive && "cursor-pointer active:scale-[0.98]",
        className,
      )}
    >
      {children}
    </div>
  );
}
