import { cn } from "@/lib/utils";

interface ColorStripeProps {
  color: string;
  className?: string;
}

export function ColorStripe({ color, className }: ColorStripeProps) {
  return (
    <div
      className={cn("w-1 rounded-full flex-shrink-0", className)}
      style={{ backgroundColor: color }}
    />
  );
}
