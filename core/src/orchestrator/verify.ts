import type {
  ProofPacket,
  Claim,
  ClaimLabel,
  Risk,
  Severity,
  SkepticVote,
  Tests,
  Verified,
  Evidence,
  Assumption,
  Telemetry,
} from "../types";
import type { ResolvedConfig } from "../config";
import type { ResolvedDiff } from "../git";
import { citationHolds } from "../git";
import {
  providerFor,
  parseModelSpec,
  extractJson,
  MockProvider,
  type Provider,
  type CompletionResult,
} from "../providers";

export interface VerifyInput {
  task: string;
  diff: ResolvedDiff;
  repoRoot: string;
  config: ResolvedConfig;
  /** invariants from .prism/project-model.md the change is checked against */
  projectRules?: Evidence["rules"];
  /** result of actually running the test suite (undefined = not run) */
  testResult?: Tests;
  /** shared MockProvider for the `mock` profile / tests */
  mock?: MockProvider;
  /** injected timestamp + id (kept out of the engine so it stays deterministic) */
  now?: string;
  id?: string;
  /** cap how many load-bearing claims go to the skeptic panel */
  maxSkepticClaims?: number;
}

interface GroundingOutput {
  verified?: Partial<Verified>;
  evidence?: Partial<Evidence>;
  claims?: { id?: string; text: string; citation?: string }[];
  risks?: Risk[];
  assumptions?: Assumption[];
}

const SEV_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function kindToProviderEnum(kind: string): SkepticVote["provider"] {
  if (kind === "anthropic") return "anthropic";
  if (kind === "openai") return "openai";
  if (kind === "ollama") return "ollama";
  if (kind === "mock") return "other";
  return "openai-compatible";
}

/** The verify flow: assemble → ground (re-open) → skeptics (if risk ≥ medium) → verdict → packet. */
export async function verify(input: VerifyInput): Promise<ProofPacket> {
  const { task, diff, repoRoot, config } = input;
  const overrides = { baseUrls: config.baseUrls, mock: input.mock };
  const usage: Record<string, { tokensIn: number; tokensOut: number }> = {};

  const record = (r: CompletionResult) => {
    const u = (usage[r.provider] ??= { tokensIn: 0, tokensOut: 0 });
    u.tokensIn += r.usage?.inputTokens ?? 0;
    u.tokensOut += r.usage?.outputTokens ?? 0;
  };

  const caseFile = [
    `TASK:\n${task}`,
    `DIFF (${diff.info.filesChanged ?? "?"} files, +${diff.info.insertions ?? 0}/-${diff.info.deletions ?? 0}):`,
    diff.patch.slice(0, 24000),
    input.projectRules?.length
      ? `PROJECT INVARIANTS (must be upheld):\n${input.projectRules.map((r) => `- ${r.rule}${r.citation ? ` (${r.citation})` : ""}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // ---- 1. Grounding pass ---------------------------------------------------
  const gModel = parseModelSpec(config.roles.groundingVerifier);
  const gProvider = providerFor(config.roles.groundingVerifier, overrides);
  const gRes = await gProvider.complete(gModel.model, {
    role: "grounding",
    system:
      "You are Prism's grounding verifier. You are INDEPENDENT of the agent that wrote this code. " +
      "Read the task + diff. Return STRICT JSON only, no prose, with keys: verified {inScope[], outOfScope[]}, " +
      "evidence {files[{path,lines,why}], docs[{source,claim}], rules[{rule,citation,status}]}, " +
      "claims [{id,text,citation}] (load-bearing claims the change depends on, each citing file:line), " +
      "risks [{severity,location,description,category}], assumptions [{claim,couldChangeVerdict,howToResolve}].",
    messages: [{ role: "user", content: caseFile }],
  });
  record(gRes);
  let g: GroundingOutput = {};
  try {
    g = extractJson<GroundingOutput>(gRes.text);
  } catch {
    g = {};
  }

  const verified: Verified = {
    inScope: g.verified?.inScope ?? [],
    outOfScope: g.verified?.outOfScope ?? [],
  };
  const evidence: Evidence = {
    files: g.evidence?.files ?? [],
    docs: g.evidence?.docs ?? [],
    rules: mergeRules(input.projectRules, g.evidence?.rules),
  };
  const risks: Risk[] = [...(g.risks ?? [])];
  const assumptions: Assumption[] = g.assumptions ?? [];

  // ---- 2. Structural grounding: is each citation re-openable in-repo? ------
  // A valid citation is NECESSARY but not sufficient for `grounded` — cited claims still go
  // through the skeptic panel below, so a citation no longer immunizes a claim from refutation.
  const claims: Claim[] = (g.claims ?? []).map((c, i) => ({
    id: c.id ?? `c${i + 1}`,
    text: c.text,
    citation: c.citation,
    label: "cross-model-survived" as ClaimLabel, // provisional; decided after the panel
  }));
  const citationValid = new Map<string, boolean>();
  for (const c of claims) citationValid.set(c.id, citationHolds(repoRoot, c.citation));

  const survivedLabel: ClaimLabel = config.decorrelation === "cross-model" ? "cross-model-survived" : "cross-tier-survived";
  const labelSurvivor = (c: Claim): ClaimLabel => (citationValid.get(c.id) ? "grounded" : survivedLabel);

  // ---- 3. Skeptic panel (only if risk ≥ medium) — votes on ALL load-bearing claims
  const changeRisk = assessRisk(diff, risks, evidence);
  const skepticVotes: SkepticVote[] = [];
  let divergence: Telemetry["divergence"] | undefined;
  const maxClaims = input.maxSkepticClaims ?? 4;
  const runPanel = changeRisk !== "low" && claims.length > 0;

  if (runPanel) {
    const top = claims.slice(0, maxClaims);
    const refuteCount = new Map<string, number>();
    let dissent = 0;
    for (const spec of config.roles.skeptics) {
      const { kind, model } = parseModelSpec(spec);
      const provider: Provider = providerFor(spec, overrides);
      let refutedAny = false;
      for (const claim of top) {
        const res = await provider.complete(model, {
          role: "skeptic",
          temperature: 0,
          system:
            "You are a Prism skeptic. Your ONLY job is to REFUTE the claim with a concrete counterexample. " +
            "Default to refuting when uncertain. Return STRICT JSON: {vote:'refute'|'uphold', reason}.",
          messages: [{ role: "user", content: `CLAIM: ${claim.text}\nCITATION: ${claim.citation ?? "none"}\n\nDIFF:\n${diff.patch.slice(0, 12000)}` }],
        });
        record(res);
        let vote: "refute" | "uphold" = "uphold";
        try {
          vote = extractJson<{ vote?: string }>(res.text).vote === "refute" ? "refute" : "uphold";
        } catch {
          vote = "uphold";
        }
        if (vote === "refute") {
          refuteCount.set(claim.id, (refuteCount.get(claim.id) ?? 0) + 1);
          refutedAny = true;
        }
      }
      skepticVotes.push({ model, provider: kindToProviderEnum(kind), vote: refutedAny ? "refute" : "uphold" });
      if (refutedAny) dissent++;
    }

    // Majority refute (a concrete counterexample) strikes a claim — even a cited one; a
    // counterexample beats a citation. Grounding outranks *survival*, never *refutation*.
    const panelSize = config.roles.skeptics.length;
    for (const claim of top) {
      const votes = refuteCount.get(claim.id) ?? 0;
      if (votes * 2 > panelSize) {
        claim.label = "struck";
        risks.push({
          severity: "high",
          location: claim.citation,
          description: `Load-bearing claim refuted by ${votes}/${panelSize} skeptics: "${claim.text}"`,
          category: "correctness",
        });
      } else {
        claim.label = labelSurvivor(claim);
      }
    }
    for (const claim of claims.slice(maxClaims)) claim.label = labelSurvivor(claim);

    const conclusionDiv = panelSize > 0 ? dissent / panelSize : 0;
    divergence = { score: conclusionDiv, evidence: conclusionDiv, conclusion: conclusionDiv, threshold: 0.3, calibrated: false };
  } else {
    // low-risk: no panel. Cited claims are grounded; uncited stay the weaker survivor label.
    for (const claim of claims) claim.label = labelSurvivor(claim);
  }

