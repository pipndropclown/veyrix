import { NextResponse } from "next/server";
import {
  getNormalizedResearchRecord,
  getNormalizedResearchRecordMetadata,
} from "@/lib/research/normalizedResearchAccess";
import { updateNormalizedMetadata } from "@/lib/research/normalizedResearchService";
import { parseResearchDetailLevel } from "@/lib/research/researchDetail";
export const dynamic = "force-dynamic",
  runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params,
    level = parseResearchDetailLevel(
      new URL(request.url).searchParams.get("detail"),
    );
  if (!level)
    return NextResponse.json(
      { success: false, error: "Invalid detail level" },
      { status: 400 },
    );
  const record =
    level === "full"
      ? await getNormalizedResearchRecord(runId)
      : await getNormalizedResearchRecordMetadata(runId);
  if (!record)
    return NextResponse.json(
      { success: false, error: "Research run not found" },
      { status: 404 },
    );
  if (level === "full")
    return NextResponse.json(
      { success: true, detailLevel: "full", record },
      { headers: { "X-Veyrix-Explicit-Full": "required" } },
    );
  return NextResponse.json({
    success: true,
    detailLevel: "standard",
    record: {
      schemaVersion: record.schemaVersion,
      researchRunId: record.researchRunId,
      manifest: record.manifest,
      summary: record.compactSummary,
      detail: record.standardDetail,
      sizes: record.sizes,
      strategyNotes: record.strategyNotes ?? {},
    },
  });
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params,
      body = (await request.json()) as {
        pinned?: unknown;
        note?: unknown;
        strategyNotes?: unknown;
      };
    if (body.pinned !== undefined && typeof body.pinned !== "boolean")
      return NextResponse.json(
        { success: false, error: "Invalid pinned state" },
        { status: 400 },
      );
    return NextResponse.json({
      success: true,
      summary: await updateNormalizedMetadata(runId, {
        pinned: body.pinned,
        note: body.note,
        strategyNotes: body.strategyNotes,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Update unavailable",
      },
      { status: 400 },
    );
  }
}
