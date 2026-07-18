import type { CompletionRequest, CompletionResult, Provider } from "./types";

/**
 * Deterministic mock provider — the zero-key path used by tests and the `mock`/demo
 * profile. It returns canned JSON keyed by the orchestration `role` on each request,
 * so the full verify flow runs end-to-end with no network and no API keys.
 *
 * Tests can override any role's response to drive accept / human-review / block paths.
 */
export class MockProvider implements Provider {
  readonly name = "mock";
  private scripts: Record<string, string>;

  constructor(scripts: Partial<Record<string, string>> = {}) {
    this.scripts = { ...MockProvider.defaults, ...stripUndefined(scripts) };
  }

  async complete(model: string, req: CompletionRequest): Promise<CompletionResult> {
    const role = req.role ?? "grounding";
    const text = this.scripts[role] ?? "{}";
    const inputTokens = approxTokens(req.system) + req.messages.reduce((n, m) => n + approxTokens(m.content), 0);
    return {
      text,
      model,
      provider: this.name,
      usage: { inputTokens, outputTokens: approxTokens(text) },
    };
  }

  static defaults: Record<string, string> = {
    // The grounding pass: extract scope, evidence, load-bearing claims, risks, assumptions.
    grounding: JSON.stringify({
      verified: {
        inScope: ["the changed function and its direct call sites"],
        outOfScope: ["unrelated modules not touched by the diff"],
      },
      evidence: {
        files: [{ path: "sample-app/payment.ts", lines: "1-20", why: "the change under review" }],
        docs: [],
        rules: [],
      },
      claims: [
        { id: "c1", text: "the changed logic does what the task asked", citation: "sample-app/payment.ts:1" },
      ],
      risks: [
        { severity: "medium", location: "sample-app/payment.ts:1", description: "edge case not covered by a test", category: "correctness" },
      ],
      assumptions: [
        { claim: "inputs are validated upstream", couldChangeVerdict: true, howToResolve: "confirm the caller sanitizes input" },
      ],
    }),
    // A skeptic pass: default to upholding (a concrete counterexample is required to refute).
    skeptic: JSON.stringify({ vote: "uphold", reason: "no concrete counterexample found" }),
  };
}

function stripUndefined(o: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(o)) if (o[k] !== undefined) out[k] = o[k] as string;
  return out;
}

