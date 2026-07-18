import type { CompletionRequest, CompletionResult, Provider } from "./types";

/**
 * OpenAI-compatible adapter — one implementation reaches every OpenAI-shaped
 * /chat/completions endpoint: OpenAI (GPT/Codex), Ollama (open models, local),
 * vLLM, OpenRouter, LM Studio, Together, etc. This is what makes "open-source models"
 * a first-class Prism target with no extra code — just a base URL.
 *
 * Not exercised by the test suite; real calls need the endpoint's API key (if any).
 */
export class OpenAICompatibleProvider implements Provider {
  readonly name: string;
  private baseUrl: string;
  private apiKey: string;

