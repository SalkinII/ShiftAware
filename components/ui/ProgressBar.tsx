import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max: number;
  color?: "green" | "blue" | "orange" | "gray";
  className?: string;
}

const colorClasses = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  orange: "bg-orange-500",
  gray: "bg-gray-500",
};

const textColorClasses = {
  green: "text-green-600",
  blue: "text-blue-600",
  orange: "text-orange-600",
  gray: "text-gray-600",
};

export function ProgressBar({
  value,
  max,
  color = "green",
  className,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.round((value / max) * 100));

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", colorClasses[color])}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={cn("text-sm font-bold", textColorClasses[color])}>
        {value.toFixed(1)}/{max}
      </span>
    </div>
  );
}
