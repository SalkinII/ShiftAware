import { z } from "zod";

export const eventTransitionSchema = z.object({
  targetStatus: z.enum([
    "PLANNING",
    "OPEN_FOR_PREFERENCES",
    "ASSIGNING",
    "FINALIZED",
    "COMPLETED",
  ]),
});

/** Valid forward and backward transitions (one step at a time) */
const STATUS_ORDER = [
  "PLANNING",
  "OPEN_FOR_PREFERENCES",
  "ASSIGNING",
  "FINALIZED",
  "COMPLETED",
] as const;

export function isValidTransition(current: string, target: string): boolean {
  const currentIdx = STATUS_ORDER.indexOf(
    current as (typeof STATUS_ORDER)[number],
  );
  const targetIdx = STATUS_ORDER.indexOf(
    target as (typeof STATUS_ORDER)[number],
  );
  if (currentIdx === -1 || targetIdx === -1) return false;
  const diff = targetIdx - currentIdx;
  // Allow one step forward or one step backward
  return diff === 1 || diff === -1;
}

export function getNextStatus(current: string): string | null {
  const idx = STATUS_ORDER.indexOf(current as (typeof STATUS_ORDER)[number]);
  if (idx === -1 || idx >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

export function getPreviousStatus(current: string): string | null {
  const idx = STATUS_ORDER.indexOf(current as (typeof STATUS_ORDER)[number]);
  if (idx <= 0) return null;
  return STATUS_ORDER[idx - 1];
}
