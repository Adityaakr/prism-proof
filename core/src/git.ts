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

function parseNumstat(numstat: string): ResolvedDiff["files"] {
  return numstat
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [ins, del, ...rest] = l.split("\t");
      return {
        path: rest.join("\t"),
        insertions: ins === "-" ? 0 : parseInt(ins, 10) || 0,
        deletions: del === "-" ? 0 : parseInt(del, 10) || 0,
      };
    });
}

function parseFilesFromPatch(patch: string): ResolvedDiff["files"] {
  const files: ResolvedDiff["files"] = [];
  const re = /^\+\+\+ b\/(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(patch))) files.push({ path: m[1], insertions: 0, deletions: 0 });
  return files;
}

/**
 * Structural grounding check: does the cited "path:line" point at a real, in-repo file
 * with at least that many lines? This is a NECESSARY condition for labelling a claim
 * `grounded` — it proves the citation is re-openable inside the repo. It is NOT sufficient
 * on its own (it does not read the line's *content*); the orchestrator still routes cited
 * claims through the skeptic panel, so a valid citation no longer immunizes a claim.
 *
 * Hardened against: sibling-dir escape (`/repo` vs `/repo-evil`), `../` traversal, symlink
 * escape, off-by-one on a trailing newline, and reversed/zero line ranges.
 */
export function citationHolds(repoRoot: string, citation?: string): boolean {
  if (!citation) return false;
  const m = citation.match(/^(.+?):(\d+)(?:-(\d+))?$/);
  if (!m) return false;
  const rel = m[1];
  const start = parseInt(m[2], 10);
  const end = parseInt(m[3] ?? m[2], 10);
  if (!Number.isFinite(start) || start < 1 || end < start) return false;

