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

