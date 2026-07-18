/**
 * Provider abstraction — the seam that makes Prism model-agnostic.
 * Every model (Claude, GPT/Codex, or an open model via Ollama/vLLM/OpenRouter)
 * is reached through this one interface, so the orchestrator never knows which
 * vendor it is talking to.
 */

export interface CompletionMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  system?: string;
  messages: CompletionMessage[];
  temperature?: number;
  maxTokens?: number;
  /**
   * Prism-internal hint identifying which orchestration role this call plays
   * (e.g. "grounding", "skeptic", "judge"). Real providers ignore it; the mock
   * provider uses it to return deterministic canned evidence for tests/demo.
   */
  role?: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  provider: string;
  usage?: Usage;
}

export interface Provider {
  /** provider id: "anthropic" | "openai-compatible" | "mock" */
  readonly name: string;
  complete(model: string, req: CompletionRequest): Promise<CompletionResult>;
}

/** Return the first balanced {...} or [...] span starting with `opener`, string-aware. */
function firstBalanced(s: string, opener: "{" | "["): string | null {
  const close = opener === "{" ? "}" : "]";
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== opener) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") {
        depth--;
        if (depth === 0) return c === close ? s.slice(i, j + 1) : null;
      }
    }
  }
  return null;
}

