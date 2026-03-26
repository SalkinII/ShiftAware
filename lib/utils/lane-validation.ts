import { ShiftType } from "@prisma/client";

interface TemplateWithLanes {
  type: ShiftType;
  allowedLanes: ShiftType[];
}

/**
 * Check if dropping a template into a lane is valid
 */
export function isValidLaneDrop(
  template: TemplateWithLanes,
  targetLane: ShiftType,
): boolean {
  const allowedLanes = getTemplateAllowedLanes(template);
  return allowedLanes.includes(targetLane);
}

/**
 * Get the lanes a template can be dropped into
 * Falls back to template's own type if allowedLanes is empty
 */
export function getTemplateAllowedLanes(
  template: TemplateWithLanes,
): ShiftType[] {
  if (template.allowedLanes && template.allowedLanes.length > 0) {
    return template.allowedLanes;
  }
  return [template.type];
}
