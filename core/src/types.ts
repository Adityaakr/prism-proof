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

