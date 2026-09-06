import { NextResponse } from "next/server";
import { getNormalizedResearchRecordMetadata } from "@/lib/research/normalizedResearchAccess";
export const dynamic = "force-dynamic",
  runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params,
    record = await getNormalizedResearchRecordMetadata(runId);
  return record
    ? NextResponse.json({
        success: true,
        summary: record.compactSummary,
        sizes: record.sizes,
      })
    : NextResponse.json(
        { success: false, error: "Research run not found" },
        { status: 404 },
      );
}
