/**
 * Proof Packet types — the TypeScript mirror of schema/proof-packet.schema.json.
 * This is the provider-neutral spine every adapter produces and every UI renders.
 * Keep in sync with the JSON schema; the schema is the source of truth at runtime
 * (see packet.ts validate()).
 */

export type Decision = "accept" | "human-review" | "block";
export type Severity = "low" | "medium" | "high" | "critical";
export type ClaimLabel =
  | "grounded"
  | "cross-model-survived"
  | "cross-tier-survived"
  | "struck";
export type Decorrelation = "cross-model" | "cross-tier" | "single-model";

export interface DiffInfo {
  source: "staged" | "branch" | "commit-range" | "pr" | "worktree";
  ref: string;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
}

export interface Verdict {
  decision: Decision;
  rationale: string;
  confidence?: "low" | "medium" | "high";
}

export interface Verified {
  inScope: string[];
  outOfScope: string[];
}

export interface EvidenceFile {
  path: string;
  lines: string;
  why?: string;
}
export interface EvidenceDoc {
  source: string;
  claim?: string;
}
export interface EvidenceRule {
  rule: string;
  citation?: string;
  status?: "upheld" | "violated" | "n/a";
}
export interface Evidence {
  files: EvidenceFile[];
  docs?: EvidenceDoc[];
  rules?: EvidenceRule[];
}

