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

