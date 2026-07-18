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

