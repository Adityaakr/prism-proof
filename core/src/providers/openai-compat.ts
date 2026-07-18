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

  constructor(opts: { name?: string; baseUrl: string; apiKey?: string; apiKeyEnv?: string }) {
    this.name = opts.name ?? "openai-compatible";
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey ?? (opts.apiKeyEnv ? process.env[opts.apiKeyEnv] ?? "" : "");
  }

  async complete(model: string, req: CompletionRequest): Promise<CompletionResult> {
    const messages = [
      ...(req.system ? [{ role: "system", content: req.system }] : []),
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.apiKey) headers["authorization"] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: req.temperature ?? 0,
        max_tokens: req.maxTokens ?? 2048,
        messages,
      }),
    });
    if (!res.ok) {
      throw new Error(`${this.name} API ${res.status}: ${await res.text()}`);
    }
    const data: any = await res.json();
    const choice = data.choices?.[0];
