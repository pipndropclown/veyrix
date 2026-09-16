import { NextResponse } from "next/server";
import { getMarketData } from "@/lib/market/marketService";
import { requestedMarket } from "@/lib/market/marketRequest";
import { getRecentPriceObservations } from "@/lib/market/priceHistory";
import { evaluateMomentum } from "@/lib/strategy/momentumStrategy";
import { buildStrategyActivity } from "@/lib/strategy/strategyActivity";
import type { MarketApiResponse } from "@/types/market";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse<MarketApiResponse>> {
  const symbol = requestedMarket(request.url);
  if (!symbol) return NextResponse.json({ success: false, error: "Unsupported market" }, { status: 400 });
  try {
    const data = await getMarketData(symbol);
    const observations = getRecentPriceObservations(symbol);
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
    console.error(`${symbol} market data request failed`, error);
    return NextResponse.json(
      { success: false, error: "Market data unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
