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
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens ?? 2048,
        temperature: req.temperature ?? 0,
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    }
    const data: any = await res.json();
    const text = Array.isArray(data.content)
      ? data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
      : "";
    if (!text) {
      throw new Error(`Anthropic: empty text response (stop_reason=${data.stop_reason ?? "?"})`);
    }
    return {
      text,
      model,
      provider: this.name,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
    };
  }
}
