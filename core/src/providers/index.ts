import type { Provider } from "./types";
import { MockProvider } from "./mock";
import { AnthropicProvider } from "./anthropic";
import { OpenAICompatibleProvider } from "./openai-compat";

export * from "./types";
export { MockProvider } from "./mock";
export { AnthropicProvider } from "./anthropic";
export { OpenAICompatibleProvider } from "./openai-compat";

/** A model spec is "<providerKind>:<model>", e.g. "anthropic:claude-opus-4-8",
 *  "openai:gpt-5-codex", "ollama:qwen2.5-coder:32b", "mock:mock". The provider kind
 *  is everything before the FIRST colon; the model is the remainder (which may itself
 *  contain colons, as Ollama tags do). */
export function parseModelSpec(spec: string): { kind: string; model: string } {
  const i = spec.indexOf(":");
  if (i < 0) return { kind: "mock", model: spec };
  return { kind: spec.slice(0, i), model: spec.slice(i + 1) };
}

