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

/** Resolve the diff under review into a patch + per-file stats. */
export function resolveDiff(repoRoot: string, opts: DiffOptions = {}): ResolvedDiff {
  const source = opts.source ?? "staged";

  if (source === "pr") {
    const n = opts.ref;
    if (!n) throw new Error('pr source needs a ref (PR number), e.g. { source: "pr", ref: "42" }');
    const patch = execFileSync("gh", ["pr", "diff", n], { cwd: repoRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return { info: { source, ref: n }, patch, files: parseFilesFromPatch(patch) };
  }

  const base = opts.base ?? defaultBranch(repoRoot);
  if (source === "branch" && base === "HEAD") {
    throw new Error("Cannot determine the base branch for a branch diff (no origin/HEAD, main, or master). Pass --base <branch>.");
  }
  const args = numstatArgs(source, base, opts.ref);
  const patch = git(repoRoot, ["diff", ...args]);
  const numstat = git(repoRoot, ["diff", "--numstat", ...args]);
  const files = parseNumstat(numstat);
  const ref = source === "branch" ? `${base}...HEAD` : source === "commit-range" ? (opts.ref ?? "HEAD~1..HEAD") : "worktree/staged";
  const info: DiffInfo = {
    source,
    ref,
    filesChanged: files.length,
    insertions: files.reduce((n, f) => n + f.insertions, 0),
    deletions: files.reduce((n, f) => n + f.deletions, 0),
  };
  return { info, patch, files };
}

