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

