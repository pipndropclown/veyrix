import { NextResponse } from "next/server";
import { getLiveCandles } from "@/lib/market/liveCandleService";
import { isLiveTimeframe } from "@/lib/market/liveCandles";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("timeframe");
  if (!isLiveTimeframe(value))
    return NextResponse.json(
      { success: false, error: "Unsupported candle timeframe" },
      { status: 400 },
    );
  try {
    return NextResponse.json({
      success: true,
      data: await getLiveCandles(value),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Market candles are temporarily unavailable" },
      { status: 503 },
    );
  }
}
