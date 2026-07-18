import * as fs from "node:fs";
import * as path from "node:path";
import type { ProofPacket, Decision } from "./types";

export interface RunSummary {
  id: string;
  task: string;
  decision: Decision;
  createdAt?: string;
  highRisks: number;
  decorrelation?: string;
  costUsd: number | null;
  packet: ProofPacket;
}

/** Load every run in .prism/runs/*.json, newest first. */
export function loadRuns(repoRoot: string): RunSummary[] {
  const dir = path.join(repoRoot, ".prism", "runs");
  if (!fs.existsSync(dir)) return [];
  const runs: RunSummary[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const packet = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as ProofPacket;
      runs.push({
        id: packet.id,
        task: packet.task,
        decision: packet.verdict?.decision ?? "human-review",
        createdAt: packet.createdAt,
        highRisks: (packet.risks ?? []).filter((r) => r.severity === "high" || r.severity === "critical").length,
        decorrelation: packet.telemetry?.models?.decorrelation,
        costUsd: packet.telemetry?.cost?.totalUsd ?? null,
        packet,
      });
    } catch {
      /* skip unreadable run */
    }
  }
  return runs.sort((a, b) => (b.createdAt ?? b.id).localeCompare(a.createdAt ?? a.id));
}

