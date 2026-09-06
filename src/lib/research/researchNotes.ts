import type { StrategyId } from "@/types/strategy";
const allowed = new Set<StrategyId>([
  "momentum",
  "moving_average",
  "mean_reversion",
]);
export function validateStrategyNotes(
  value: unknown,
): Partial<Record<StrategyId, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid strategy notes");
  const result: Partial<Record<StrategyId, string>> = {};
  for (const [key, note] of Object.entries(value)) {
    if (
      !allowed.has(key as StrategyId) ||
      typeof note !== "string" ||
      note.trim().length > 200
    )
      throw new Error("Invalid strategy note");
    if (note.trim()) result[key as StrategyId] = note.trim();
  }
  return result;
}
