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

