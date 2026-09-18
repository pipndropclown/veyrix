import { isMarketId } from "../market/marketRegistry.ts";
import { LIVE_TIMEFRAME_IDS } from "../market/liveCandles.ts";
import { restoreAutomationSettings } from "../trading/automationEngine.ts";
import { unifiedTradeHistory } from "../trading/tradeHistory.ts";
import type { AgentConfig, AgentStore, PaperAgent, PaperLabState } from "@/types/agents";

export const AGENT_STORAGE_KEY = "veyrix.agents.v1";
export const MAX_ACTIVE_AGENTS = 6;
export const MAX_SAVED_AGENTS = 30;
export const STRATEGY_LABELS = { momentum: "Momentum", moving_average: "MA", mean_reversion: "Mean Reversion" } as const;
export const emptyAgentStore = (): AgentStore => ({ version: 1, migratedV13: false, agents: [], archived: [] });
export function defaultAgentName(config: Pick<AgentConfig, "marketId" | "strategyId" | "mode">) {
  return `${config.marketId} ${STRATEGY_LABELS[config.strategyId]}${config.mode === "FUTURES" ? " Futures" : ""}`;
}
export function validateAgentConfig(value: unknown, capital = 10000): string | null {
  if (!value || typeof value !== "object") return "Invalid agent configuration.";
  const c = value as Partial<AgentConfig>;
  if (typeof c.name !== "string" || !c.name.trim() || c.name.trim().length > 32) return "Use an agent name of 1–32 characters.";
  if (!isMarketId(c.marketId)) return "Unsupported market.";
  if (c.mode !== "SPOT" && c.mode !== "FUTURES") return "Unsupported paper mode.";
  if (!c.strategyId || !Object.hasOwn(STRATEGY_LABELS, c.strategyId)) return "Invalid strategy.";
  if (!LIVE_TIMEFRAME_IDS.includes(c.timeframe!)) return "Invalid automation timeframe.";
  if (![1, 2, 3, 5].includes(c.leverage!) || (c.mode === "SPOT" && c.leverage !== 1)) return "Choose supported futures leverage; Spot is always 1x.";
  const a = c.allocation;
  if (!a || !["USDC", "PERCENT"].includes(a.unit) || !Number.isFinite(a.value) || a.value <= 0 || a.value > (a.unit === "PERCENT" ? 100 : capital)) return "Allocation must be positive and within allowed virtual capital (or 100%).";
  for (const n of [c.stopLossPercent, c.takeProfitPercent]) if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n >= 100) return "Risk percentages must be between 0 and less than 100. Zero disables that level.";
  return null;
}
export function createAgent(store: AgentStore, config: AgentConfig, id: string, timestamp: string, enabled = false, capital = 10000): AgentStore {
  const error = validateAgentConfig(config, capital);
  if (error) throw new Error(error);
  if (!id || [...store.agents, ...store.archived].some(a => a.id === id)) throw new Error("Agent ID must be unique.");
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error("Invalid creation timestamp.");
  if (store.agents.length >= MAX_SAVED_AGENTS) throw new Error("Maximum 30 saved agents; delete an unused agent first.");
  if (enabled && store.agents.filter(a => a.enabled).length >= MAX_ACTIVE_AGENTS) throw new Error("Maximum 6 running agents.");
  const agent: PaperAgent = { ...config, name: config.name.trim(), allocation: { ...config.allocation }, id, enabled, createdAt: timestamp, lastEvaluation: null, lastSignal: null, lastAction: "Created — paused", processedCandleIds: [], recentEvents: [] };
  return { ...store, agents: [...store.agents, agent] };
}
export function setAgentEnabled(store: AgentStore, id: string, enabled: boolean): AgentStore {
  if (!store.agents.some(a => a.id === id)) throw new Error("Agent not found.");
  if (enabled && store.agents.filter(a => a.enabled && a.id !== id).length >= MAX_ACTIVE_AGENTS) throw new Error("Maximum 6 running agents.");
  return { ...store, agents: store.agents.map(a => a.id === id ? { ...a, enabled, lastAction: enabled ? "Resumed — waiting for a closed candle" : "Paused — risk protection remains active" } : a) };
}
export function ownsOpenPosition(state: PaperLabState, id: string) {
  return unifiedTradeHistory(state.portfolio).some(t => t.status === "OPEN" && "agentId" in t && t.agentId === id && !("agentDetached" in t && t.agentDetached));
}
export function editAgent(state: PaperLabState, id: string, config: AgentConfig, capital = 10000): PaperLabState {
  const error = validateAgentConfig(config, capital);
  if (error) throw new Error(error);
  const current = state.agents.agents.find(a => a.id === id);
  if (!current) throw new Error("Agent not found.");
  const changedExecution = (Object.keys(config) as (keyof AgentConfig)[]).some(k => k !== "name" && JSON.stringify(config[k]) !== JSON.stringify(current[k]));
  if (ownsOpenPosition(state, id) && changedExecution) throw new Error("Only the name can change while this agent owns a position. Close or detach it first.");
  return { ...state, agents: { ...state.agents, agents: state.agents.agents.map(a => a.id === id ? { ...a, ...config, name: config.name.trim(), enabled: changedExecution ? false : a.enabled, lastAction: changedExecution ? "Configuration edited — paused" : "Renamed" } : a) } };
}
export function deleteAgent(state: PaperLabState, id: string, leavePositionManual = false, now = new Date().toISOString()): PaperLabState {
  const agent = state.agents.agents.find(a => a.id === id);
  if (!agent) throw new Error("Agent not found.");
  if (ownsOpenPosition(state, id) && !leavePositionManual) throw new Error("Pause the agent or explicitly leave its position under manual control.");
  const detach = <T extends { agentId?: string; status: string }>(t: T): T => t.agentId === id && t.status === "OPEN" ? { ...t, agentDetached: true } : t;
  return { agents: { ...state.agents, agents: state.agents.agents.filter(a => a.id !== id), archived: [...state.agents.archived, { ...agent, enabled: false, deletedAt: now }] }, portfolio: { ...state.portfolio, trades: state.portfolio.trades.map(detach), multiMarketSpotTrades: state.portfolio.multiMarketSpotTrades?.map(detach), futuresTrades: state.portfolio.futuresTrades?.map(detach), spotPositions: Object.fromEntries(Object.entries(state.portfolio.spotPositions ?? {}).map(([key, p]) => [key, p?.agentId === id ? { ...p, agentDetached: true } : p])) } };
}
export function restoreAgentStore(value: unknown): AgentStore {
  if (!value || typeof value !== "object" || (value as AgentStore).version !== 1) throw new Error("Unsupported saved agent schema. Existing data has been left intact.");
  const raw = value as AgentStore;
  if (!Array.isArray(raw.agents) || !Array.isArray(raw.archived) || raw.agents.length > MAX_SAVED_AGENTS) throw new Error("Invalid saved agent list.");
  const ids = new Set<string>();
  let active = 0;
  const restore = (a: PaperAgent, archived: boolean): PaperAgent => {
    if (validateAgentConfig(a, Number.MAX_VALUE) || typeof a.id !== "string" || !a.id || ids.has(a.id) || !Number.isFinite(Date.parse(a.createdAt)) || !Array.isArray(a.processedCandleIds) || !a.processedCandleIds.every(id => typeof id === "string")) throw new Error("Invalid saved agent. Existing data has been left intact.");
    ids.add(a.id);
    const enabled = !archived && a.enabled === true && ++active <= MAX_ACTIVE_AGENTS;
    return { ...a, enabled, processedCandleIds: a.processedCandleIds.slice(-500), recentEvents: Array.isArray(a.recentEvents) ? a.recentEvents.filter(e => e && typeof e.action === "string" && typeof e.timestamp === "string").slice(-30) : [] };
  };
  return { version: 1, migratedV13: raw.migratedV13 === true, agents: raw.agents.map(a => restore(a, false)), archived: raw.archived.map(a => restore(a, true)) };
}
export function migrateLegacyAutomation(state: PaperLabState, legacy: unknown, now = new Date().toISOString()): PaperLabState {
  if (state.agents.migratedV13) return state;
  let agents = { ...state.agents, migratedV13: true };
  if (!legacy || typeof legacy !== "object") return { ...state, agents };
  const s = restoreAutomationSettings(legacy);
  const config: AgentConfig = { name: "", marketId: s.marketId ?? "SOL", mode: s.tradingMode ?? "SPOT", strategyId: s.strategyId, timeframe: s.timeframe, allocation: { unit: "PERCENT", value: s.allocationPercent ?? 10 }, leverage: s.tradingMode === "FUTURES" ? s.leverage ?? 1 : 1, stopLossPercent: s.stopLossPercent ?? 3, takeProfitPercent: s.takeProfitPercent ?? 6 };
  config.name = `Legacy ${defaultAgentName(config)}`.slice(0, 32);
  agents = createAgent(agents, config, "legacy-v13", now, s.enabled);
  agents.agents[agents.agents.length - 1] = { ...agents.agents.at(-1)!, processedCandleIds: [...s.processedCandleIds], lastAction: "Migrated from V1.3" };
  const owner = { agentId: "legacy-v13", agentName: config.name };
  // Only the currently matching autonomous position has trustworthy ownership.
  const match = (t: { source: string; status: string; marketId?: string; agentId?: string }) => t.source === "AUTONOMOUS" && !t.agentId && (t.marketId ?? "SOL") === config.marketId;
  const portfolio = { ...state.portfolio, trades: state.portfolio.trades.map(t => config.mode === "SPOT" && t.status === "OPEN" && (t.source ?? "AUTONOMOUS") === "AUTONOMOUS" && config.marketId === "SOL" && !t.agentId ? { ...t, ...owner } : t), multiMarketSpotTrades: state.portfolio.multiMarketSpotTrades?.map(t => config.mode === "SPOT" && match(t) ? { ...t, ...owner } : t), futuresTrades: state.portfolio.futuresTrades?.map(t => config.mode === "FUTURES" && match(t) ? { ...t, ...owner } : t) };
  if (config.mode === "SPOT" && portfolio.multiMarketSpotTrades?.some(t => t.agentId === owner.agentId && t.status === "OPEN")) portfolio.spotPositions = { ...portfolio.spotPositions, [config.marketId]: { ...portfolio.spotPositions![config.marketId]!, ...owner } };
  return { portfolio, agents };
}
