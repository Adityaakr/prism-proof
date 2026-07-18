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

/** Best-effort default branch: origin/HEAD → main → master. */
export function defaultBranch(repoRoot: string): string {
  try {
    const ref = git(repoRoot, ["symbolic-ref", "refs/remotes/origin/HEAD"]).trim();
    const m = ref.match(/origin\/(.+)$/);
    if (m) return m[1];
  } catch {
    /* no remote */
  }
  for (const b of ["main", "master"]) {
    try {
      git(repoRoot, ["rev-parse", "--verify", b]);
      return b;
    } catch {
      /* not present */
    }
  }
  return "HEAD";
}

function numstatArgs(source: DiffInfo["source"], base: string, ref?: string): string[] {
  switch (source) {
    case "staged":
      return ["--staged"];
    case "branch":
      return [`${base}...HEAD`];
    case "commit-range":
      return [ref ?? "HEAD~1..HEAD"];
    case "worktree":
    default:
      return [];
  }
}

