import { NextResponse } from "next/server";
import { compareResearchSummaries } from "@/lib/research/researchLibrary";
import {
  listNormalizedSummaries,
  normalizedStoreStatus,
} from "@/lib/research/normalizedResearchService";
export const dynamic = "force-dynamic",
  runtime = "nodejs";
export async function GET(request: Request) {
  const value = Number(new URL(request.url).searchParams.get("limit") ?? 25),
    limit = Number.isFinite(value)
      ? Math.max(1, Math.min(25, Math.floor(value)))
      : 25;
  return NextResponse.json({
    success: true,
    status: normalizedStoreStatus(),
    summaries: await listNormalizedSummaries(limit),
  });
}
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { runIds?: unknown },
      ids = Array.isArray(body.runIds)
        ? body.runIds.filter((id): id is string => typeof id === "string")
        : [];
    if (ids.length < 2 || ids.length > 3)
      return NextResponse.json(
        { success: false, error: "Select two or three runs" },
        { status: 400 },
      );
    const all = await listNormalizedSummaries(25),
      selected = ids.map((id) =>
        all.find((summary) => summary.researchRunId === id),
      );
    if (selected.some((value) => !value))
      return NextResponse.json(
        { success: false, error: "Research run not found" },
        { status: 404 },
      );
    return NextResponse.json({
      success: true,
      comparison: compareResearchSummaries(selected as typeof all),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Comparison unavailable" },
      { status: 400 },
    );
  }
}
