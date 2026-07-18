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

const groundedClaim = { id: "c1", text: "the change is correct", citation: "src/pay.ts:3" };
const badClaim = { id: "c1", text: "the change is correct", citation: "src/does-not-exist.ts:999" };

function mockScript(over: { risks?: any[]; assumptions?: any[]; claims?: any[]; skeptic?: string }) {
  const grounding = JSON.stringify({
    verified: { inScope: ["src/pay.ts"], outOfScope: [] },
    evidence: { files: [{ path: "src/pay.ts", lines: "1-20" }], docs: [], rules: [] },
    claims: over.claims ?? [groundedClaim],
    risks: over.risks ?? [],
    assumptions: over.assumptions ?? [],
  });
  return new MockProvider({ grounding, skeptic: over.skeptic ?? JSON.stringify({ vote: "uphold" }) });
}

const greenTests: Tests = { command: "npm test", passed: ["suite"], failed: [], notRun: [] };

describe("verify — verdicts", () => {
  it("ACCEPT: grounded claim, tests green, no risk", async () => {
    const cfg = loadConfig(repo, "mock");
    const packet = await verify({
      task: "small fix", diff: diff(), repoRoot: repo, config: cfg,
      mock: mockScript({}), testResult: greenTests, id: "t-accept", now: "2026-07-19T00:00:00Z",
    });
    expect(packet.verdict.decision).toBe("accept");
    expect(packet.claims?.[0].label).toBe("grounded");
    expect(validate(packet).valid).toBe(true);
  });

  it("HUMAN-REVIEW: grounded but tests not run", async () => {
    const cfg = loadConfig(repo, "mock");
    const packet = await verify({
      task: "small fix", diff: diff(), repoRoot: repo, config: cfg,
      mock: mockScript({}), id: "t-review", now: "2026-07-19T00:00:00Z",
    });
    expect(packet.verdict.decision).toBe("human-review");
    expect(validate(packet).valid).toBe(true);
  });

  it("HUMAN-REVIEW: medium risk present, tests green", async () => {
    const cfg = loadConfig(repo, "mock");
    const packet = await verify({
      task: "fix", diff: diff(), repoRoot: repo, config: cfg,
      mock: mockScript({ risks: [{ severity: "medium", location: "src/pay.ts:5", description: "edge case", category: "correctness" }] }),
      testResult: greenTests, id: "t-review2", now: "2026-07-19T00:00:00Z",
    });
    expect(packet.verdict.decision).toBe("human-review");
  });

  it("BLOCK: a high-severity risk", async () => {
    const cfg = loadConfig(repo, "mock");
    const packet = await verify({
      task: "risky", diff: diff(), repoRoot: repo, config: cfg,
      mock: mockScript({ risks: [{ severity: "high", location: "src/pay.ts:5", description: "auth bypass", category: "security" }] }),
      testResult: greenTests, id: "t-block", now: "2026-07-19T00:00:00Z",
    });
    expect(packet.verdict.decision).toBe("block");
  });

  it("BLOCK: failing tests can't be dressed as done", async () => {
    const cfg = loadConfig(repo, "mock");
    const packet = await verify({
      task: "fix", diff: diff(), repoRoot: repo, config: cfg,
      mock: mockScript({}), testResult: { command: "npm test", passed: [], failed: ["suite failed"], notRun: [] },
      id: "t-block2", now: "2026-07-19T00:00:00Z",
    });
    expect(packet.verdict.decision).toBe("block");
  });

  it("BLOCK: skeptic panel strikes a non-grounded load-bearing claim", async () => {
    const cfg = loadConfig(repo, "mock");
    const packet = await verify({
      task: "fix", diff: diff(), repoRoot: repo, config: cfg,
      // bad citation => non-grounded; medium risk triggers the panel; skeptics all refute
      mock: mockScript({
        claims: [badClaim],
        risks: [{ severity: "medium", location: "src/pay.ts:5", description: "unclear", category: "correctness" }],
        skeptic: JSON.stringify({ vote: "refute", reason: "counterexample" }),
      }),
      testResult: greenTests, id: "t-block3", now: "2026-07-19T00:00:00Z",
    });
    expect(packet.claims?.[0].label).toBe("struck");
    expect(packet.verdict.decision).toBe("block");
  });

