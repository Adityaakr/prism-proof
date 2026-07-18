#!/usr/bin/env node
import { execFileSync, execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "./config";
import { resolveDiff, type DiffOptions } from "./git";
import { verify } from "./orchestrator/verify";
import { validate, writeRun, writeHtml } from "./packet";
import { buildDashboard } from "./dashboard";
import type { Tests, Evidence } from "./types";

function parseArgs(argv: string[]): { _: string[]; flags: Record<string, string | boolean> } {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else _.push(a);
  }
  return { _, flags };
}

function repoRootFrom(cwd: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
  } catch {
    return cwd;
  }
}

/** Best-effort extraction of cited invariants from .prism/project-model.md. */
function readProjectRules(repoRoot: string): Evidence["rules"] {
  const file = path.join(repoRoot, ".prism", "project-model.md");
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const rules: NonNullable<Evidence["rules"]> = [];
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+Invariants/i.test(line)) { inSection = true; continue; }
    if (inSection && /^##\s+/.test(line)) break;
    if (!inSection) continue;
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    if (!m) continue;
    const cite = m[1].match(/`?([\w./-]+:\d+(?:-\d+)?)`?/);
    rules.push({ rule: m[1].replace(/`/g, ""), citation: cite?.[1], status: "n/a" });
  }
  return rules;
}

function runTests(repoRoot: string, cmd: string): Tests {
  try {
    execSync(cmd, { cwd: repoRoot, stdio: "pipe", encoding: "utf8" });
    return { command: cmd, passed: [cmd], failed: [], notRun: [] };
  } catch (e: any) {
    const out = String(e.stdout ?? "") + String(e.stderr ?? "");
    const tail = out.split("\n").slice(-6).join("\n").trim();
    return { command: cmd, passed: [], failed: [`${cmd}${tail ? " — " + tail : ""}`], notRun: [] };
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "run";
}

async function cmdVerify(flags: Record<string, string | boolean>) {
  const cwd = process.cwd();
  const repoRoot = repoRootFrom(cwd);
  const profile = typeof flags.profile === "string" ? flags.profile : undefined;
  const config = loadConfig(repoRoot, profile);

