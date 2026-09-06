import { NextResponse } from "next/server";
import { getHistoricalSolData } from "@/lib/backtesting/historicalMarketService";
import {
  runExtendedValidation,
  runExtendedValidationArena,
  runValidationMethod,
} from "@/lib/validation/extendedValidation";
import { momentumStrategyConfig } from "@/lib/strategy/momentumStrategy";
import { paperTradingConfig } from "@/lib/trading/tradingConfig";
import { backtestExecutionConfig } from "@/lib/backtesting/backtestConfig";
import { strategyRegistry } from "@/lib/strategy/strategyRegistry";
import type { ValidationMethod } from "@/types/extendedValidation";
import type { StrategyId } from "@/types/strategy";
import {
  runStoredResearch,
  runMultiAnchorResearch,
} from "@/lib/research/researchService";
export const dynamic = "force-dynamic";
const config = {
    strategy: momentumStrategyConfig,
    paperTrading: paperTradingConfig,
    risk: paperTradingConfig,
    execution: backtestExecutionConfig,
  },
  methods: ValidationMethod[] = [
    "ROLLING_OVERLAPPING",
    "NON_OVERLAPPING",
    "EXPANDING_WALK_FORWARD",
  ];
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
        timeframe?: unknown;
        strategyId?: unknown;
        action?: unknown;
        method?: unknown;
        anchor?: unknown;
      },
      timeframe =
        body.timeframe === "90D" ||
        body.timeframe === "180D" ||
        body.timeframe === "365D"
          ? body.timeframe
          : null,
      strategyId =
        typeof body.strategyId === "string" &&
        body.strategyId in strategyRegistry
          ? (body.strategyId as StrategyId)
          : null,
      method = methods.includes(body.method as ValidationMethod)
        ? (body.method as ValidationMethod)
        : null,
      anchor =
        typeof body.anchor === "string" && body.anchor
          ? body.anchor
          : undefined;
    if (!timeframe || !strategyId)
      return NextResponse.json(
        { success: false, error: "Invalid validation request" },
        { status: 400 },
      );
    if (
      body.action === "multi_anchor" &&
      (timeframe === "180D" || timeframe === "365D")
    )
      return NextResponse.json({
        success: true,
        kind: "multi_anchor",
        data: await runMultiAnchorResearch(timeframe, anchor),
      });
    if (
      body.action === "arena" &&
      (timeframe === "180D" || timeframe === "365D")
    ) {
      const research = await runStoredResearch(timeframe, anchor);
      return NextResponse.json({
        success: true,
        kind: "arena",
        data: research.record.detailedResult,
        quality: research.record.manifest.dataQuality,
        research: {
          source: research.source,
          persistenceStatus: research.persistenceStatus,
          cachedAgeMs: research.cachedAgeMs,
          summary: research.summary,
        },
      });
    }
    const now = Date.now(),
      data = await getHistoricalSolData(timeframe, now, anchor),
      historyDays = Number(timeframe.slice(0, -1));
    if (body.action === "method" && method)
      return NextResponse.json({
        success: true,
        kind: "method",
        data: runValidationMethod(
          data.observations,
          strategyId,
          config,
          method,
        ),
        quality: data.quality,
      });
    if (body.action === "arena")
      return NextResponse.json({
        success: true,
        kind: "arena",
        data: runExtendedValidationArena(
          data.observations,
          config,
          historyDays,
          data.quality,
        ),
        quality: data.quality,
      });
    return NextResponse.json({
      success: true,
      kind: "report",
      data: runExtendedValidation({
        candles: data.observations,
        strategyId,
        config,
        historyDays,
        dataQuality: data.quality,
      }),
      quality: data.quality,
    });
  } catch (error) {
    console.error("Extended validation request failed", error);
    return NextResponse.json(
      { success: false, error: "Extended validation unavailable" },
      { status: 503 },
    );
  }
}
