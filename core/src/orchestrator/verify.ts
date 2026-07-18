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

