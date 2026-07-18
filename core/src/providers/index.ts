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

export interface ProviderOverrides {
  /** custom base URLs per kind, e.g. { openrouter: "https://openrouter.ai/api/v1" } */
  baseUrls?: Record<string, string>;
  /** shared MockProvider instance (so tests can inject scripted responses) */
  mock?: MockProvider;
}

const OPENAI_COMPAT_DEFAULTS: Record<string, { baseUrl: string; apiKeyEnv?: string }> = {
  openai: { baseUrl: "https://api.openai.com/v1", apiKeyEnv: "OPENAI_API_KEY" },
  ollama: { baseUrl: "http://localhost:11434/v1" },
  vllm: { baseUrl: "http://localhost:8000/v1" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", apiKeyEnv: "OPENROUTER_API_KEY" },
  lmstudio: { baseUrl: "http://localhost:1234/v1" },
  together: { baseUrl: "https://api.together.xyz/v1", apiKeyEnv: "TOGETHER_API_KEY" },
};

/** Build a Provider for a model spec's kind. Model-agnostic dispatch lives here. */
export function providerFor(spec: string, overrides: ProviderOverrides = {}): Provider {
  const { kind } = parseModelSpec(spec);
  if (kind === "mock") return overrides.mock ?? new MockProvider();
  if (kind === "anthropic") return new AnthropicProvider({ baseUrl: overrides.baseUrls?.anthropic });

  const preset = OPENAI_COMPAT_DEFAULTS[kind];
  const baseUrl = overrides.baseUrls?.[kind] ?? preset?.baseUrl;
  if (!baseUrl) {
    throw new Error(
      `Unknown provider kind "${kind}". Known: mock, anthropic, ${Object.keys(OPENAI_COMPAT_DEFAULTS).join(", ")}. ` +
        `For a custom OpenAI-compatible endpoint, add it under config.baseUrls.`
    );
  }
  return new OpenAICompatibleProvider({ name: kind, baseUrl, apiKeyEnv: preset?.apiKeyEnv });
}

export function providerKind(spec: string): string {
  return parseModelSpec(spec).kind;
}
