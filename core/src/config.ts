import * as fs from "node:fs";
import * as path from "node:path";
import { providerKind } from "./providers";
import type { Decorrelation } from "./types";

/** Role → model spec map. A model spec is "<kind>:<model>" (see providers/parseModelSpec). */
export interface RoleMap {
  draft: string;
  judge: string;
  groundingVerifier: string;
  skeptics: string[];
}

export interface PrismConfig {
  /** which built-in/custom profile to use if none is passed explicitly */
  defaultProfile?: string;
  /** named profiles; merged over the built-ins below */
  profiles?: Record<string, Partial<RoleMap>>;
  /** custom base URLs for OpenAI-compatible kinds, e.g. { openrouter: "..." } */
  baseUrls?: Record<string, string>;
}

export interface ResolvedConfig {
  profile: string;
  roles: RoleMap;
  decorrelation: Decorrelation;
  baseUrls: Record<string, string>;
}

/** Built-in profiles. `mock` (zero-key, deterministic) is the safe default. */
export const BUILTIN_PROFILES: Record<string, RoleMap> = {
  mock: {
    draft: "mock:mock",
    judge: "mock:mock",
    groundingVerifier: "mock:mock",
    skeptics: ["mock:mock", "mock:mock", "mock:mock"],
  },
  // Zero API keys — runs entirely on local open models via Ollama.
  local: {
    draft: "ollama:qwen2.5-coder:32b",
    judge: "ollama:qwen2.5-coder:32b",
    groundingVerifier: "ollama:qwen2.5-coder:7b",
    skeptics: ["ollama:qwen2.5-coder:32b", "ollama:deepseek-coder-v2:16b", "ollama:llama3.1:8b"],
  },
  // Claude-only: the historical cross-TIER split (2× Opus + 1× Sonnet).
  claude: {
    draft: "anthropic:claude-opus-4-8",
    judge: "anthropic:claude-sonnet-5",
    groundingVerifier: "anthropic:claude-sonnet-5",
    skeptics: ["anthropic:claude-opus-4-8", "anthropic:claude-opus-4-8", "anthropic:claude-sonnet-5"],
  },
  // Genuine cross-MODEL decorrelation — skeptics span three lineages. The flagship.
  balanced: {
    draft: "anthropic:claude-opus-4-8",
    judge: "anthropic:claude-sonnet-5",
    groundingVerifier: "ollama:qwen2.5-coder:7b",
    skeptics: ["anthropic:claude-opus-4-8", "openai:gpt-5-codex", "ollama:qwen2.5-coder:32b"],
  },
};

/** Decide the decorrelation axis from the skeptic pool. Keys on the FULL spec (kind+model),
 *  so two identical models are correctly reported as no decorrelation, not a tier split. */
export function decorrelationOf(skeptics: string[]): Decorrelation {
  const distinct = new Set(skeptics);
  if (distinct.size <= 1) return "single-model";
  const kinds = new Set(skeptics.map(providerKind));
  if (kinds.size > 1) return "cross-model"; // different lineages = strongest
  return "cross-tier"; // same lineage, different models/tiers
}

/** A spec must name its provider kind explicitly (except the literal `mock`), or a dropped
 *  colon would silently route a real model to the deterministic mock — a faked verification. */
export function assertValidSpec(spec: string, profile: string): void {
  if (!spec || !spec.trim()) throw new Error(`Empty model spec in profile "${profile}".`);
  const kind = providerKind(spec);
  if (kind === "") {
    throw new Error(`Empty provider kind in spec "${spec}" (profile "${profile}"). Use "<kind>:<model>".`);
  }
  if (kind === "mock" && spec !== "mock" && !spec.startsWith("mock:")) {
    throw new Error(
      `Ambiguous model spec "${spec}" in profile "${profile}": missing provider kind. ` +
        `Prefix it, e.g. "openai:${spec}" or "anthropic:${spec}".`
    );
  }
}

/** Load prism.config.json (if present) and resolve a profile into concrete roles. */
export function loadConfig(repoRoot: string, profileName?: string): ResolvedConfig {
  const file = path.join(repoRoot, "prism.config.json");
  let user: PrismConfig = {};
  if (fs.existsSync(file)) {
    try {
      user = JSON.parse(fs.readFileSync(file, "utf8")) as PrismConfig;
    } catch (e) {
      throw new Error(`Invalid prism.config.json: ${(e as Error).message}`);
    }
  }

  const profile =
    profileName ?? process.env.PRISM_PROFILE ?? user.defaultProfile ?? "mock";

  const base = BUILTIN_PROFILES[profile];
  const override = user.profiles?.[profile];

  // A verification tool must never silently fall back to the mock: an unknown profile
  // name is an error, not "run a fake pass".
  if (!base && !override) {
    const known = [...Object.keys(BUILTIN_PROFILES), ...Object.keys(user.profiles ?? {})];
    throw new Error(`Unknown profile "${profile}". Known: ${known.join(", ")}. Define it in prism.config.json or pass a valid --profile.`);
  }

  const roles: RoleMap = {
    draft: override?.draft ?? base?.draft ?? "",
    judge: override?.judge ?? base?.judge ?? "",
    groundingVerifier: override?.groundingVerifier ?? base?.groundingVerifier ?? "",
    skeptics: override?.skeptics ?? base?.skeptics ?? [],
  };

  // A custom (non-builtin) profile must define every role — no silent mock backfill.
  const missing: string[] = [];
  if (!roles.draft) missing.push("draft");
  if (!roles.judge) missing.push("judge");
  if (!roles.groundingVerifier) missing.push("groundingVerifier");
  if (!roles.skeptics.length) missing.push("skeptics");
  if (missing.length) {
    throw new Error(`Profile "${profile}" is missing role(s): ${missing.join(", ")}. A custom profile must define draft, judge, groundingVerifier and skeptics.`);
  }

  for (const spec of [roles.draft, roles.judge, roles.groundingVerifier, ...roles.skeptics]) {
    assertValidSpec(spec, profile);
  }

  return {
    profile,
    roles,
    decorrelation: decorrelationOf(roles.skeptics),
    baseUrls: user.baseUrls ?? {},
  };
}
