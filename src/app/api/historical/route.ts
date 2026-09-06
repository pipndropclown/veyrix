import { NextResponse } from "next/server";
import { getHistoricalSolData } from "@/lib/backtesting/historicalMarketService";
import type { HistoricalApiResponse } from "@/types/backtesting";
import { isBacktestTimeframe } from "@/lib/backtesting/marketCandles";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
): Promise<NextResponse<HistoricalApiResponse>> {
  try {
    const requested =
      new URL(request.url).searchParams.get("timeframe") ?? "7D";
    if (!isBacktestTimeframe(requested))
      return NextResponse.json(
        { success: false, error: "Unsupported historical timeframe" },
        { status: 400 },
      );
    return NextResponse.json(
      { success: true, data: await getHistoricalSolData(requested) },
      { headers: { "Cache-Control": "private, max-age=0" } },
    );
  } catch (error) {
    console.error("Historical SOL data request failed", error);
    return NextResponse.json(
      { success: false, error: "Historical market data unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
