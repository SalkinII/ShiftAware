import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface DesirabilityBadgeProps {
  score: number;
  className?: string;
}

export function DesirabilityBadge({ score, className }: DesirabilityBadgeProps) {
  // Score 1-2: easy to get (blue/cool)
  // Score 3: moderate (gray)
  // Score 4-5: hard to get (orange/hot)
  const colorClasses =
    score <= 2
      ? "bg-blue-50 text-blue-700"
      : score === 3
        ? "bg-gray-100 text-gray-600"
        : "bg-orange-50 text-orange-700";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        colorClasses,
        className
      )}
      title={`Desirability: ${score}/5 — ${score <= 2 ? "easier to get" : score >= 4 ? "harder to get" : "moderate"}`}
    >
      <span>{score.toFixed(1)}</span>
      <Star className="w-3 h-3 fill-current" />
    </div>
  );
}
