import type {
  NormalizedResearchRecord,
  ResearchDetailLevel,
} from "@/types/research";
export function parseResearchDetailLevel(
  value: string | null,
): Exclude<ResearchDetailLevel, "summary"> | null {
  if (value === null || value === "standard") return "standard";
  if (value === "full") return "full";
  return null;
}
export function researchDetail(
  record: NormalizedResearchRecord,
  level: ResearchDetailLevel,
) {
  if (level === "summary") return record.compactSummary;
  if (level === "standard")
    return {
      schemaVersion: "veyrix-standard-export-v1",
      manifest: record.manifest,
      summary: record.compactSummary,
      detail: record.standardDetail,
      sizes: record.sizes,
    };
  if (level === "full") return record;
  throw new Error("Invalid detail level");
}
