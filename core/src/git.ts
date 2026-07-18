import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { DiffInfo } from "./types";

export interface ResolvedDiff {
  info: DiffInfo;
  patch: string;
  files: { path: string; insertions: number; deletions: number }[];
}

export interface DiffOptions {
  source?: DiffInfo["source"];
  /** base branch for "branch" source (default: the repo's default branch) */
  base?: string;
  /** ref for "commit-range" (a..b) or "pr" (number) */
  ref?: string;
}

function git(repoRoot: string, args: string[]): string {
  // stderr ignored so best-effort probes (e.g. missing origin/HEAD) don't leak to the user.
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

