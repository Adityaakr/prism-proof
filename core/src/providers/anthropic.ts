import type { CompletionRequest, CompletionResult, Provider } from "./types";

/**
 * Anthropic (Claude) adapter — uses the Messages API via global fetch (Node >= 20).
 * Not exercised by the test suite (that uses the mock); real calls need ANTHROPIC_API_KEY.
 */
export class AnthropicProvider implements Provider {
  readonly name = "anthropic";
  private apiKey: string;
  private baseUrl: string;

  constructor(opts: { apiKey?: string; baseUrl?: string } = {}) {
    this.apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.baseUrl = opts.baseUrl ?? "https://api.anthropic.com";
  }

  async complete(model: string, req: CompletionRequest): Promise<CompletionResult> {
    if (!this.apiKey) throw new Error("AnthropicProvider: ANTHROPIC_API_KEY is not set");
