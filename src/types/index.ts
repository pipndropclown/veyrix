export type Signal = "BUY" | "SELL" | "HOLD";
export interface ActivityItem { id: string; time: string; title: string; description: string; type: "signal" | "analysis" | "trade" | "system"; }
