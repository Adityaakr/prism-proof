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

