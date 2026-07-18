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

