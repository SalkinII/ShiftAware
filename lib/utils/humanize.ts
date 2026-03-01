/**
 * Convert attribute keys (camelCase, snake_case, kebab-case) to human-readable labels.
 */
export function humanize(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
