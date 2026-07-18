#!/usr/bin/env node
/**
 * Prism MCP server — exposes the proof layer as an MCP tool so ANY MCP client
 * (Claude Code, Codex, Cursor, Zed, a script) can call `prism_verify` regardless of
 * which model host it runs in. This is Prism's portability layer: one engine, many hosts.
 *
 * Requires @modelcontextprotocol/sdk (loaded dynamically so the rest of Core has no
 * hard dependency on it). Run: `npm run mcp`  (or `node dist/mcp/server.js`).
 */
import { execFileSync } from "node:child_process";
import { loadConfig } from "../config";
import { resolveDiff, type DiffOptions } from "../git";
import { verify } from "../orchestrator/verify";
import { writeRun, writeHtml, validate } from "../packet";

function repoRoot(): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

const VERIFY_INPUT_SCHEMA = {
  type: "object",
  properties: {
    task: { type: "string", description: "The original task the diff was supposed to accomplish." },
    source: { type: "string", enum: ["staged", "branch", "commit-range", "worktree", "pr"], default: "staged" },
    base: { type: "string", description: "Base branch for source=branch." },
    ref: { type: "string", description: "Range for commit-range, or PR number for source=pr." },
    profile: { type: "string", description: "mock | local | claude | balanced." },
  },
} as const;

async function runVerify(args: any) {
  const root = repoRoot();
  const config = loadConfig(root, args.profile);
  const opts: DiffOptions = { source: args.source ?? "staged", base: args.base, ref: args.ref };
  const diff = resolveDiff(root, opts);
  const now = new Date().toISOString();
  const id = `${now.slice(0, 10)}-mcp-${Math.abs(hash(diff.patch)).toString(36).slice(0, 6)}`;
  const packet = await verify({ task: args.task ?? "Verify staged change", diff, repoRoot: root, config, now, id });
  const v = validate(packet);
  const jsonPath = writeRun(root, packet);
  const htmlPath = writeHtml(root, packet);
  return { packet, jsonPath, htmlPath, valid: v.valid, errors: v.errors };
}

