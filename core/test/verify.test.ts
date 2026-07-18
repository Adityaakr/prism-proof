import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { verify } from "../src/orchestrator/verify";
import { loadConfig } from "../src/config";
import { MockProvider } from "../src/providers/mock";
import { validate } from "../src/packet";
import type { ResolvedDiff } from "../src/git";
import type { Tests } from "../src/types";

let repo: string;

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "prism-test-"));
  fs.mkdirSync(path.join(repo, "src"), { recursive: true });
  fs.writeFileSync(path.join(repo, "src", "pay.ts"), Array.from({ length: 20 }, (_, i) => `// line ${i + 1}`).join("\n"));
});

afterAll(() => fs.rmSync(repo, { recursive: true, force: true }));

function diff(patch = "diff --git a/src/pay.ts b/src/pay.ts\n+ small change", files = [{ path: "src/pay.ts", insertions: 2, deletions: 0 }]): ResolvedDiff {
  return {
    info: { source: "staged", ref: "staged", filesChanged: files.length, insertions: 2, deletions: 0 },
    patch,
    files,
  };
}

