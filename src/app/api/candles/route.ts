import { NextResponse } from "next/server";
import { getLiveCandles } from "@/lib/market/liveCandleService";
import { isLiveTimeframe } from "@/lib/market/liveCandles";
import { requestedMarket } from "@/lib/market/marketRequest";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const value = params.get("timeframe"), symbol = requestedMarket(request.url);
  if (!symbol) return NextResponse.json({ success: false, error: "Unsupported market" }, { status: 400 });
  if (!isLiveTimeframe(value))
    return NextResponse.json(
      { success: false, error: "Unsupported candle timeframe" },
      { status: 400 },
    );
  try {
    return NextResponse.json({
      success: true,
      data: await getLiveCandles(value, symbol),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Market candles are temporarily unavailable" },
      { status: 503 },
    );
  }
}
