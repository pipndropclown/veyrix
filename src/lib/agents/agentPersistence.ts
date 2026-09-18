import { createInitialPaperPortfolio, restorePaperPortfolio } from "../trading/paperPortfolio.ts";
import { migrateLegacyAutomation, restoreAgentStore, emptyAgentStore } from "./agentModel.ts";
import type { AgentStore, PaperLabState } from "@/types/agents";
import type { PaperPortfolioState } from "@/types/trading";

export function serializePaperLab(state: PaperLabState): string {
  return JSON.stringify({ ...state.portfolio, agentState: state.agents });
}
export function restorePaperLab(input: { portfolioValue: unknown; agentValue?: unknown; legacyAutomation?: unknown; currentDay?: string }): { state: PaperLabState; error: string | null } {
  const portfolio = input.portfolioValue ? restorePaperPortfolio(input.portfolioValue, input.currentDay) : createInitialPaperPortfolio(input.currentDay);
  const embedded = input.portfolioValue && typeof input.portfolioValue === "object" ? (input.portfolioValue as PaperPortfolioState).agentState : undefined;
  let agents: AgentStore;
  try {
    agents = embedded ? restoreAgentStore(embedded) : input.agentValue ? restoreAgentStore(input.agentValue) : emptyAgentStore();
  } catch (error) {
    return { state: { portfolio, agents: emptyAgentStore() }, error: error instanceof Error ? error.message : "Saved agents could not be read." };
  }
  const migrated = migrateLegacyAutomation({ portfolio, agents }, input.legacyAutomation, input.currentDay ? new Date(`${input.currentDay}T12:00:00Z`).toISOString() : undefined);
  return { state: migrated, error: null };
}
