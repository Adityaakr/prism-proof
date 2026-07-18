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

