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

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** Build the local Prism dashboard — a proof + model-comparison console (not just run history). */
export function buildDashboard(repoRoot: string): { html: string; runs: number } {
  const runs = loadRuns(repoRoot);

  const counts = { accept: 0, "human-review": 0, block: 0 } as Record<Decision, number>;
  const modelStats: Record<string, { refute: number; uphold: number; provider: string }> = {};
  const providerCost: Record<string, { tokensIn: number; tokensOut: number; usd: number | null }> = {};

  for (const r of runs) {
    counts[r.decision]++;
    for (const s of r.packet.telemetry?.models?.skeptics ?? []) {
      const m = (modelStats[s.model] ??= { refute: 0, uphold: 0, provider: s.provider ?? "?" });
      if (s.vote === "refute") m.refute++;
      else if (s.vote === "uphold") m.uphold++;
    }
    for (const c of r.packet.telemetry?.cost?.byProvider ?? []) {
      const p = (providerCost[c.provider] ??= { tokensIn: 0, tokensOut: 0, usd: 0 });
      p.tokensIn += c.tokensIn ?? 0;
      p.tokensOut += c.tokensOut ?? 0;
      p.usd = p.usd == null || c.usd == null ? null : p.usd + (c.usd ?? 0);
    }
  }

  const queueRows = runs
    .map(
      (r) => `<tr>
      <td><span class="badge ${r.decision}">${esc(r.decision.replace("-", " "))}</span></td>
      <td><a href="runs/${esc(r.id)}.html">${esc(r.id)}</a></td>
      <td>${esc(r.task).slice(0, 90)}</td>
      <td>${r.highRisks || ""}</td>
      <td class="mono">${esc(r.decorrelation ?? "")}</td>
      <td class="mono">${r.costUsd == null ? "—" : "$" + r.costUsd}</td>
    </tr>`
    )
    .join("");

  const modelRows = Object.entries(modelStats)
    .map(([model, s]) => {
      const total = s.refute + s.uphold;
      const rate = total ? Math.round((s.refute / total) * 100) : 0;
      return `<tr><td class="mono">${esc(model)}</td><td class="muted">${esc(s.provider)}</td><td>${s.refute}</td><td>${s.uphold}</td><td>
        <div class="bar"><span style="width:${rate}%"></span></div><span class="muted">${rate}% refute</span></td></tr>`;
    })
    .join("");

  const costRows = Object.entries(providerCost)
    .map(
      ([p, c]) =>
        `<tr><td class="mono">${esc(p)}</td><td>${c.tokensIn.toLocaleString()}</td><td>${c.tokensOut.toLocaleString()}</td><td>${c.usd == null ? "—" : "$" + c.usd.toFixed(4)}</td></tr>`
    )
    .join("");

