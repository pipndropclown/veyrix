import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import {
  calculateNormalizedRootFingerprint,
  getArtifact,
  verifyArtifact,
} from "./researchArtifacts.ts";
import { stableFingerprint } from "./researchIdentity.ts";
import type {
  NormalizedResearchRecord,
  ResearchArtifact,
  ResearchSummary,
} from "@/types/research";
export const NORMALIZED_STORE_SCHEMA = "veyrix-store-v2";
const RUN = /^VRX-[a-f0-9]{24}$/,
  ARTIFACT = /^(FD|BT|EQ|DD|TR|BM|SN|CF|RG)-[a-f0-9]{64}$/;
export function validRunId(id: string) {
  return RUN.test(id);
}
export function validArtifactId(id: string) {
  return ARTIFACT.test(id);
}
export function validateNormalizedRecord(
  value: unknown,
  verifyArtifacts = true,
): value is NormalizedResearchRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<NormalizedResearchRecord>;
  if (
    record.schemaVersion !== NORMALIZED_STORE_SCHEMA ||
    record.complete !== true ||
    !record.researchRunId ||
    !validRunId(record.researchRunId) ||
    record.manifest?.researchRunId !== record.researchRunId ||
    record.datasetFingerprint !== record.manifest?.datasetFingerprint ||
    record.standardDetail?.researchRunId !== record.researchRunId ||
    record.compactSummary?.researchRunId !== record.researchRunId ||
    typeof record.rootFingerprint !== "string" ||
    !record.artifacts ||
    !Array.isArray(record.artifactIndex)
  )
    return false;
  if (
    record.artifactIndex.some(
      (item) =>
        !validArtifactId(item.artifactId) ||
        (verifyArtifacts &&
          record.artifacts?.[item.artifactId]?.contentHash !==
            item.contentHash),
    )
  )
    return false;
  if (!verifyArtifacts) return true;
  if (!Object.values(record.artifacts).every(verifyArtifact)) return false;
  if (
    record.strategyNotes !== undefined &&
    (!record.strategyNotes ||
      typeof record.strategyNotes !== "object" ||
      Array.isArray(record.strategyNotes) ||
      Object.entries(record.strategyNotes).some(
        ([key, value]) =>
          !["momentum", "moving_average", "mean_reversion"].includes(key) ||
          typeof value !== "string" ||
          value.length > 200,
      ))
  )
    return false;
  return (
    calculateNormalizedRootFingerprint(
      stableFingerprint(record.manifest),
      record.compactSummary,
      record.artifacts,
    ) === record.rootFingerprint
  );
}
export interface NormalizedResearchStore {
  readonly name: string;
  readonly durable: boolean;
  readonly supportsPinning: boolean;
  get(runId: string): Promise<NormalizedResearchRecord | null>;
  getMetadata(runId: string): Promise<NormalizedResearchRecord | null>;
  put(record: NormalizedResearchRecord): Promise<void>;
  delete(runId: string): Promise<void>;
  has(runId: string): Promise<boolean>;
  list(limit?: number): Promise<ResearchSummary[]>;
  getArtifact(
    runId: string,
    artifactId: string,
  ): Promise<ResearchArtifact | null>;
  cleanupExpired(now?: number): Promise<number>;
}
export class NormalizedMemoryResearchStore implements NormalizedResearchStore {
  readonly name = "memory-v2";
  readonly durable = false;
  readonly supportsPinning = false;
  private records = new Map<string, NormalizedResearchRecord>();
  async get(id: string) {
    return this.records.get(id) ?? null;
  }
  async getMetadata(id: string) {
    return this.get(id);
  }
  async put(record: NormalizedResearchRecord) {
    if (!validateNormalizedRecord(record))
      throw new Error("Invalid normalized research record");
    this.records.set(record.researchRunId, record);
  }
  async delete(id: string) {
    this.records.delete(id);
  }
  async has(id: string) {
    return this.records.has(id);
  }
  async list(limit = 25) {
    return [...this.records.values()]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, Math.min(25, Math.max(0, limit)))
      .map((item) => item.compactSummary);
  }
  async getArtifact(runId: string, id: string) {
    const record = await this.get(runId);
    return record ? getArtifact(record.artifacts, id) : null;
  }
  async cleanupExpired(now = Date.now()) {
    let count = 0;
    for (const [id, record] of this.records)
      if (!record.pinned && Date.parse(record.expiresAt) <= now) {
        this.records.delete(id);
        count++;
      }
    return count;
  }
  clear() {
    this.records.clear();
  }
}
export class NormalizedFileResearchStore implements NormalizedResearchStore {
  readonly name = "filesystem-v2";
  readonly durable = true;
  readonly supportsPinning = true;
  private root: string;
  constructor(root = join(process.cwd(), ".veyrix-research-v2")) {
    this.root = root;
  }
  private run(id: string) {
    if (!validRunId(id)) throw new Error("Invalid run ID");
    return join(this.root, id);
  }
  private artifact(runId: string, id: string) {
    if (!validArtifactId(id)) throw new Error("Invalid artifact ID");
    return join(this.run(runId), "artifacts", `${id}.json`);
  }
  async get(runId: string) {
    try {
      const parsed: unknown = JSON.parse(
        await readFile(join(this.run(runId), "record.json"), "utf8"),
      );
      if (!validateNormalizedRecord(parsed, false)) return null;
      const metadata = parsed as NormalizedResearchRecord,
        artifacts: Record<string, ResearchArtifact> = {};
      for (const item of metadata.artifactIndex) {
        const artifact = await this.getArtifact(runId, item.artifactId);
        if (!artifact) return null;
        artifacts[item.artifactId] = artifact;
      }
      const record = { ...metadata, artifacts };
      return validateNormalizedRecord(record) ? record : null;
    } catch {
      return null;
    }
  }
  async getMetadata(runId: string) {
    try {
      const parsed: unknown = JSON.parse(
        await readFile(join(this.run(runId), "record.json"), "utf8"),
      );
      return validateNormalizedRecord(parsed, false)
        ? (parsed as NormalizedResearchRecord)
        : null;
    } catch {
      return null;
    }
  }
  async put(record: NormalizedResearchRecord) {
    if (!validateNormalizedRecord(record))
      throw new Error("Invalid normalized research record");
    const target = this.run(record.researchRunId),
      temporary = `${target}.tmp-${stableFingerprint(record.createdAt).slice(0, 8)}`;
    await rm(temporary, { recursive: true, force: true });
    await mkdir(join(temporary, "artifacts"), { recursive: true });
    for (const artifact of Object.values(record.artifacts))
      await writeFile(
        join(temporary, "artifacts", `${artifact.artifactId}.json`),
        JSON.stringify(artifact),
        "utf8",
      );
    const metadata = { ...record, artifacts: {} };
    await writeFile(
      join(temporary, "record.json"),
      JSON.stringify(metadata),
      "utf8",
    );
    await rm(target, { recursive: true, force: true });
    await rename(temporary, target);
  }
  async delete(id: string) {
    try {
      await rm(this.run(id), { recursive: true, force: true });
    } catch {}
  }
  async has(id: string) {
    return !!(await this.get(id));
  }
  async list(limit = 25) {
    try {
      const names = (await readdir(this.root)).filter(validRunId),
        records = await Promise.all(
          names.map(async (id) => {
            try {
              const value: unknown = JSON.parse(
                await readFile(join(this.run(id), "record.json"), "utf8"),
              );
              return validateNormalizedRecord(value, false)
                ? value.compactSummary
                : null;
            } catch {
              return null;
            }
          }),
        );
      return records
        .filter((value): value is ResearchSummary => value !== null)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, Math.min(25, Math.max(0, limit)));
    } catch {
      return [];
    }
  }
  async getArtifact(runId: string, id: string) {
    try {
      const parsed: unknown = JSON.parse(
        await readFile(this.artifact(runId, id), "utf8"),
      );
      return verifyArtifact(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  async cleanupExpired(now = Date.now()) {
    let removed = 0;
    for (const summary of await this.list(25)) {
      const record = await this.get(summary.researchRunId);
      if (record && !record.pinned && Date.parse(record.expiresAt) <= now) {
        await this.delete(record.researchRunId);
        removed++;
      }
    }
    return removed;
  }
}
