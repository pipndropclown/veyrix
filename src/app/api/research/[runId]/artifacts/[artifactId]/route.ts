import { NextResponse } from "next/server";
import { getNormalizedResearchArtifact } from "@/lib/research/normalizedResearchAccess";
export const dynamic = "force-dynamic",
  runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string; artifactId: string }> },
) {
  const { runId, artifactId } = await params;
  try {
    const artifact = await getNormalizedResearchArtifact(runId, artifactId);
    return artifact
      ? NextResponse.json({ success: true, artifact })
      : NextResponse.json(
          { success: false, error: "Artifact not found or corrupt" },
          { status: 404 },
        );
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid artifact identifier" },
      { status: 400 },
    );
  }
}
