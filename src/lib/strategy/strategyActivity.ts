import type { ActivityItem } from "@/types";
import type { StrategyResult } from "@/types/strategy";

export function buildStrategyActivity(result: StrategyResult, timestamp: string): ActivityItem[] {
  const time = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" }).format(new Date(timestamp));
  const events: ActivityItem[] = [{ id: `${timestamp}-scan`, time, title: "Market scanned", description: `${result.metrics.observationCount} valid unique price observations evaluated.`, type: "system" }];

  if (result.metrics.shortTermChangePercent !== null) {
    events.push({ id: `${timestamp}-momentum`, time, title: "Momentum calculated", description: `Recent change ${result.metrics.shortTermChangePercent.toFixed(2)}%; direction ${result.metrics.direction.toLowerCase()}.`, type: "analysis" });
    events.push({ id: `${timestamp}-candidate`, time, title: result.signal === "HOLD" ? "No qualifying signal" : `${result.signal} candidate detected`, description: result.reason, type: result.signal === "HOLD" ? "analysis" : "signal" });
  } else {
    events.push({ id: `${timestamp}-history`, time, title: "Price history checked", description: result.reason, type: "analysis" });
  }

  events.push({ id: `${timestamp}-decision`, time, title: `Strategy decision: ${result.signal}`, description: `Rule-based decision confidence: ${result.confidence}%.`, type: result.signal === "HOLD" ? "system" : "signal" });
  return events;
}
