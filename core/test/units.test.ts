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

