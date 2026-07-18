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

