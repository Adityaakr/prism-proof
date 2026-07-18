import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseModelSpec, providerKind, extractJson, providerFor, MockProvider } from "../src/providers";
import { decorrelationOf, loadConfig } from "../src/config";
import { citationHolds } from "../src/git";
import { validate, renderHtml } from "../src/packet";
import type { ProofPacket } from "../src/types";

describe("model specs", () => {
  it("parses provider kind and model, keeping colons in the model tag", () => {
    expect(parseModelSpec("anthropic:claude-opus-4-8")).toEqual({ kind: "anthropic", model: "claude-opus-4-8" });
    expect(parseModelSpec("ollama:qwen2.5-coder:32b")).toEqual({ kind: "ollama", model: "qwen2.5-coder:32b" });
    expect(providerKind("openai:gpt-5-codex")).toBe("openai");
  });

  it("builds providers for known kinds and rejects unknown", () => {
    expect(providerFor("mock:mock")).toBeInstanceOf(MockProvider);
    expect(providerFor("ollama:qwen2.5-coder:7b").name).toBe("ollama");
    expect(() => providerFor("nope:x")).toThrow(/Unknown provider kind/);
  });
});

describe("decorrelation axis", () => {
  it("labels cross-model when lineages differ", () => {
    expect(decorrelationOf(["anthropic:opus", "openai:gpt", "ollama:qwen"])).toBe("cross-model");
  });
  it("labels cross-tier for same-lineage panels", () => {
    expect(decorrelationOf(["anthropic:opus", "anthropic:opus", "anthropic:sonnet"])).toBe("cross-tier");
  });
  it("labels single-model for a lone skeptic", () => {
    expect(decorrelationOf(["anthropic:opus"])).toBe("single-model");
  });
  it("labels single-model when two specs are identical (no real decorrelation)", () => {
    expect(decorrelationOf(["anthropic:opus", "anthropic:opus"])).toBe("single-model");
  });
});

describe("loadConfig validation (a verification tool must not silently fake a pass)", () => {
  function tmp(config?: object): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prism-cfg-"));
    if (config) fs.writeFileSync(path.join(dir, "prism.config.json"), JSON.stringify(config));
    return dir;
  }
  it("throws on an unknown profile instead of falling back to mock", () => {
    expect(() => loadConfig(tmp(), "balnced")).toThrow(/Unknown profile/);
  });
  it("throws on a partial custom profile (missing roles)", () => {
    const dir = tmp({ profiles: { prod: { draft: "anthropic:claude-opus-4-8" } } });
    expect(() => loadConfig(dir, "prod")).toThrow(/missing role/);
  });
  it("throws on a colon-less spec that would silently route to mock", () => {
    const dir = tmp({ profiles: { prod: { draft: "gpt-5-codex", judge: "openai:gpt-5", groundingVerifier: "openai:gpt-5", skeptics: ["openai:gpt-5"] } } });
    expect(() => loadConfig(dir, "prod")).toThrow(/Ambiguous model spec/);
  });
  it("accepts a complete custom cross-model profile", () => {
    const dir = tmp({ profiles: { prod: { draft: "anthropic:opus", judge: "anthropic:sonnet", groundingVerifier: "ollama:qwen", skeptics: ["anthropic:opus", "openai:gpt"] } } });
    expect(loadConfig(dir, "prod").decorrelation).toBe("cross-model");
  });
});

describe("citationHolds (real grounding re-open)", () => {
  it("is true only when the cited path:line exists in the repo", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prism-cite-"));
    fs.writeFileSync(path.join(dir, "a.ts"), "one\ntwo\nthree\n");
    expect(citationHolds(dir, "a.ts:2")).toBe(true);
    expect(citationHolds(dir, "a.ts:999")).toBe(false);
    expect(citationHolds(dir, "missing.ts:1")).toBe(false);
    expect(citationHolds(dir, undefined)).toBe(false);
    expect(citationHolds(dir, "../escape.ts:1")).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("does not count a trailing newline as an extra line, and rejects line 0 / reversed ranges", () => {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prism-cite2-")));
    fs.writeFileSync(path.join(dir, "f.ts"), "one\ntwo\n"); // 2 real lines + trailing newline
    expect(citationHolds(dir, "f.ts:2")).toBe(true);
    expect(citationHolds(dir, "f.ts:3")).toBe(false); // line 3 does not exist
    expect(citationHolds(dir, "f.ts:0")).toBe(false);
    expect(citationHolds(dir, "f.ts:5-2")).toBe(false); // reversed range
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("blocks sibling-directory escape that shares the repo path prefix", () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "prism-root-")));
    const sib = root + "-evil";
    fs.mkdirSync(sib, { recursive: true });
    fs.writeFileSync(path.join(sib, "secret.ts"), "top secret\n");
    expect(citationHolds(root, `../${path.basename(sib)}/secret.ts:1`)).toBe(false);
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(sib, { recursive: true, force: true });
  });
});

describe("extractJson", () => {
  it("parses fenced, prefixed, and raw JSON", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('here you go: {"b":2} thanks')).toEqual({ b: 2 });
    expect(extractJson('[1,2,3]')).toEqual([1, 2, 3]);
  });
  it("prefers the object over a stray leading array in prose", () => {
    expect(extractJson('[1,2] and then {"verdict":"x"}')).toEqual({ verdict: "x" });
  });
  it("handles nested objects and strings containing braces", () => {
    expect(extractJson('note {"a":{"b":"}"}} end')).toEqual({ a: { b: "}" } });
  });
});

