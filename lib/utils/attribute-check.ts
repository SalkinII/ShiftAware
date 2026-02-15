/**
 * Attribute check utility for Identity page.
 * Compares event attribute definitions with member's current values
 * to find required attributes that are missing.
 */

export interface AttributeDefinitionLike {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface MemberAttributeValueLike {
  definition: { name: string };
  value: string;
}

/**
 * Returns definitions for required attributes that have no value or empty value.
 */
export function getMissingAttributes(
  definitions: AttributeDefinitionLike[],
  values: MemberAttributeValueLike[],
): AttributeDefinitionLike[] {
  const valueByKey = new Map<string, string>();
  for (const v of values) {
    valueByKey.set(v.definition.name, v.value);
  }

  return definitions.filter((def) => {
    if (!def.required) return false;
    const raw = valueByKey.get(def.name);
    if (raw === undefined || raw === null) return true;
    try {
      const parsed = JSON.parse(raw);
      if (parsed === null || parsed === undefined) return true;
      if (typeof parsed === "string" && parsed.trim() === "") return true;
      if (Array.isArray(parsed) && parsed.length === 0) return true;
      return false;
    } catch {
      return raw.trim() === "";
    }
  });
}
