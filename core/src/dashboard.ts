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

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Prism · Dashboard</title>
<style>
:root{--bg:#fff;--fg:#101418;--muted:#5b6570;--card:#f6f7f9;--border:#e3e7ec;--accent:#4a1d7a;--accept:#1a7f37;--review:#9a6700;--block:#b42318;--mono:ui-monospace,Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
@media(prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8b949e;--card:#161b22;--border:#30363d;--accent:#c8a6ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--sans);line-height:1.5}
.wrap{max-width:1000px;margin:0 auto;padding:32px 20px 80px}
h1{font-size:22px;margin:0 0 2px}.sub{color:var(--muted);font-size:14px;margin:0 0 24px}
.meters{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:24px}
.meter{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px}
.meter .k{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.meter .v{font-size:26px;font-weight:700;font-family:var(--mono)}
.meter.accept .v{color:var(--accept)}.meter.review .v{color:var(--review)}.meter.block .v{color:var(--block)}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:28px 0 10px}
table{width:100%;border-collapse:collapse;font-size:13px}.scroll{overflow-x:auto}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:middle}
th{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
a{color:var(--accent)}.mono{font-family:var(--mono);font-size:12px}.muted{color:var(--muted)}
.badge{font-weight:700;font-size:11px;text-transform:uppercase;padding:3px 9px;border-radius:999px;white-space:nowrap}
.badge.accept{color:var(--accept);border:1.5px solid var(--accept)}
.badge.human-review{color:var(--review);border:1.5px solid var(--review)}
.badge.block{color:var(--block);border:1.5px solid var(--block)}
.bar{display:inline-block;width:80px;height:6px;border-radius:4px;background:var(--border);overflow:hidden;vertical-align:middle;margin-right:6px}
.bar>span{display:block;height:100%;background:var(--accent)}
.empty{color:var(--muted);font-style:italic}
</style></head><body><div class="wrap">
<h1>Prism · Proof Dashboard</h1>
<p class="sub">${runs.length} run${runs.length === 1 ? "" : "s"} · a proof + model-comparison console over <span class="mono">.prism/runs/</span></p>
<div class="meters">
  <div class="meter accept"><div class="k">Accepted</div><div class="v">${counts.accept}</div></div>
  <div class="meter review"><div class="k">Human review</div><div class="v">${counts["human-review"]}</div></div>
  <div class="meter block"><div class="k">Blocked</div><div class="v">${counts.block}</div></div>
  <div class="meter"><div class="k">Runs</div><div class="v">${runs.length}</div></div>
</div>
<h2>Merge-gate queue</h2>
<div class="scroll"><table><thead><tr><th>Verdict</th><th>Run</th><th>Task</th><th>High risks</th><th>Decorrelation</th><th>Cost</th></tr></thead>
<tbody>${queueRows || '<tr><td colspan="6" class="empty">no runs yet — run `prism verify`</td></tr>'}</tbody></table></div>
<h2>Model comparison — who refutes what</h2>
<p class="sub">Refute rate across the skeptic panel. A model that refutes when others uphold is catching what they miss — the payoff of cross-model decorrelation.</p>
<div class="scroll"><table><thead><tr><th>Model</th><th>Provider</th><th>Refuted</th><th>Upheld</th><th>Refute rate</th></tr></thead>
<tbody>${modelRows || '<tr><td colspan="5" class="empty">no skeptic panels have run yet</td></tr>'}</tbody></table></div>
<h2>Cost / token ledger by provider</h2>
<div class="scroll"><table><thead><tr><th>Provider</th><th>Tokens in</th><th>Tokens out</th><th>USD</th></tr></thead>
<tbody>${costRows || '<tr><td colspan="4" class="empty">no cost recorded</td></tr>'}</tbody></table></div>
</div></body></html>`;

  return { html, runs: runs.length };
}
