export type MigrationChoice = "SAVE_DEVICE" | "USE_CLOUD" | "REPLACE_CLOUD" | "START_FRESH";
export function hasGuestData(value: unknown): boolean { if (!value || typeof value !== "object") return false; const v=value as { availableUsdc?: unknown; trades?: unknown[]; openPosition?: unknown }; return (typeof v.availableUsdc === "number" && Number.isFinite(v.availableUsdc) && v.availableUsdc !== 10000) || Boolean(v.openPosition) || Boolean(v.trades?.length); }
export function canReplaceCloud(choice: MigrationChoice, confirmed: boolean) { return choice !== "REPLACE_CLOUD" || confirmed; }
export function freshPaperAccount() { return { availableUsdc: 10000, solQuantity: 0, openPosition: null, realizedPnl: 0, trades: [] }; }
