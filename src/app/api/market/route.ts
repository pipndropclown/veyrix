import { NextResponse } from "next/server";
import { getSolMarketData } from "@/lib/market/marketService";
import { getRecentPriceObservations } from "@/lib/market/priceHistory";
import { evaluateMomentum } from "@/lib/strategy/momentumStrategy";
import { buildStrategyActivity } from "@/lib/strategy/strategyActivity";
import type { MarketApiResponse } from "@/types/market";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<MarketApiResponse>> {
  try {
    const data = await getSolMarketData();
    const observations = getRecentPriceObservations();
    const strategy = evaluateMomentum(observations);
    return NextResponse.json(
      {
        success: true,
        data,
        observations,
        strategy,
        activity: buildStrategyActivity(strategy, data.lastUpdated),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("SOL market data request failed", error);
    return NextResponse.json(
      { success: false, error: "Market data unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
