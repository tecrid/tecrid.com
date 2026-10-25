import folds from "./code-casefold.json";
const overrides = folds as Record<string, string>;
export function routingCode(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 120) throw Error("A nonempty code of at most 120 characters is required.");
  return Array.from(value.trim(), char => overrides[char] ?? char.toLowerCase()).join("");
}
export function optionalRoutingCode(value: unknown): string | null {
  return value === undefined ? null : routingCode(value);
}
