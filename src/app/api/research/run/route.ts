import { NextResponse } from "next/server";
import { runNormalizedResearch } from "@/lib/research/normalizedResearchService";
import { isMarketId } from "@/lib/market/marketRegistry";
export const dynamic = "force-dynamic",
  runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
        timeframe?: unknown;
        anchor?: unknown;
        marketId?: unknown;
      },
      timeframe =
        body.timeframe === "180D" || body.timeframe === "365D"
          ? body.timeframe
          : null,
      anchor =
        typeof body.anchor === "string" && body.anchor
          ? body.anchor
          : undefined;
    if (!timeframe || (body.marketId!==undefined&&!isMarketId(body.marketId)))
      return NextResponse.json(
        { success: false, error: "Invalid research timeframe" },
        { status: 400 },
      );
    const result = await runNormalizedResearch(timeframe, anchor,Date.now(),isMarketId(body.marketId)?body.marketId:"SOL");
    return NextResponse.json({
      success: true,
      source: result.source,
      persistenceStatus: result.persistenceStatus,
      cachedAgeMs: result.cachedAgeMs,
      summary: result.summary,
      sizes: result.record.sizes,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Research run unavailable" },
      { status: 503 },
    );
  }
}
