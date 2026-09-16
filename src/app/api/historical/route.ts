import { NextResponse } from "next/server";
import { getHistoricalMarketData } from "@/lib/backtesting/historicalMarketService";
import { isMarketId } from "@/lib/market/marketRegistry";
import type { HistoricalApiResponse } from "@/types/backtesting";
import { isBacktestTimeframe } from "@/lib/backtesting/marketCandles";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
): Promise<NextResponse<HistoricalApiResponse>> {
  try {
    const params = new URL(request.url).searchParams;
    const requested = params.get("timeframe") ?? "7D";
    const symbol = params.get("symbol") ?? "SOL";
    if (!isMarketId(symbol)) return NextResponse.json({ success: false, error: "Unsupported market" }, { status: 400 });
    if (!isBacktestTimeframe(requested))
      return NextResponse.json(
        { success: false, error: "Unsupported historical timeframe" },
        { status: 400 },
      );
    return NextResponse.json(
      { success: true, data: await getHistoricalMarketData(requested, symbol) },
      { headers: { "Cache-Control": "private, max-age=0" } },
    );
  } catch (error) {
    console.error("Historical market data request failed", error);
    return NextResponse.json(
      { success: false, error: "Historical market data unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
