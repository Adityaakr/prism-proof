# 01 — Prism: Proof Layer, Model-Agnostic Core & UI Platform

> Decision doc. Created 2026-07-19. Reframes Prism around the published article
> (adibuilds.in/blog/prism → "The Proof Layer for AI-Generated Software"), makes it
> model-agnostic (Claude Code + Codex + open models), and plans the UI platform.
> Decisions confirmed with the user 2026-07-19 (all recommended options).

## Recommendation
Commit the repo to the article's **proof-layer** positioning; build the missing verification
gate (`/prism-verify` + a structured **Proof Packet**); extract a **model-agnostic Prism Core**
so it runs on Claude, Codex/GPT, and open models; distribute via **MCP + CLI** (keep the native
Claude Code commands); and make the **web dashboard** a proof + model-comparison console. Drop
the VS Code extension.

## Why
- The published article already sells Prism as a proof layer; the repo still says "orchestration
  playbook." Closing that drift is free credibility.
- Going model-agnostic turns a **documented limitation into the flagship feature**: the repo
  repeatedly apologises that decorrelation is "cross-tier, not cross-model" (`commands/prism.md:120`,
  `OVERVIEW.md:187`). Skeptics across Claude + GPT/Codex + an open model deliver *genuine*
  cross-model decorrelation — the strongest form of Prism's core bet.
- MCP is the portability layer: one engine, many hosts, no per-host prompt forks.
- A local-only (all-Ollama) profile lets devs run the whole proof layer with zero API keys.

## Steelman of the rejected option (just port the prompts per host)
Cheaper, keeps the 10-second zero-install copy-in that is a real strength. But a raw open model
has **no agent host**, so prompt-porting structurally cannot reach open models, and it forces N
maintained command copies that drift. It fails the model-agnostic requirement. Mitigation we keep:
the native Claude Code slash commands stay as the no-install premium path *alongside* Core.

## Architecture

```
                 ┌───────────────── PRISM CORE (engine) ─────────────────┐
                 │  orchestration: fan-out → divergence → judge →         │
                 │  verify → loop → Proof Packet JSON  (the spine)        │
                 └───────────────┬───────────────────────────────────────┘
                                 │  Provider adapters (role → model)
        ┌────────────────────────┼────────────────────────┐
   Anthropic (Claude)     OpenAI / Codex (GPT)     OpenAI-compatible
                                                   (Ollama / vLLM / OpenRouter → open models)
                                 │
        ┌────────────────────────┼────────────────────────┐
   CLI  `prism verify`     MCP server            Native Claude Code commands
   (any model, anywhere)   (→ Claude Code,       (kept — zero-install premium)
                            Codex, any client)
```

The **Proof Packet JSON** (`schema/proof-packet.schema.json`) is the provider-neutral output
every adapter produces and every UI renders. Answers six questions:
Verified · Evidence · Tests · Assumptions · Risks · Verdict (accept | human-review | block).

## Roadmap

| Phase | Ships | Status |
|---|---|---|
| **0 · Proof Packet contract + `/prism-verify`** | The proof layer + JSON spine | ✅ this branch |
| **0.5 · Prism Core** | Model-agnostic engine + provider adapters + `prism.config` (role→model) | planned |
| **1 · HTML Proof Packet artifact** | Shareable, legible proof page | ✅ this branch (renderer) |
| **2 · MCP server + CLI + Codex integ + git hooks** | Prism in any host / any model | planned |
| ~~VS Code extension~~ | dropped per user | — |
| **3 · Web dashboard** | Proof + model-comparison console | planned |
| **4 · Doc reframe** | README/OVERVIEW headline → proof layer | planned |

### Phase 0 (done on this branch)
- `schema/proof-packet.schema.json` — the six-question contract + telemetry (models per role,
  cost per provider, cross-model decorrelation label).
- `commands/prism-verify.md` — independent proof layer: assemble case file → risk-size →
  ground every claim → skeptic panel (cross-model if available, else cross-tier) → run tests →
  verdict → emit markdown + `.prism/runs/<id>.json`.
- `renderer/proof-packet.html` — self-contained, theme-aware renderer; **reused verbatim** as the
  dashboard's packet view (single source of truth for how a packet looks).

### Phase 0.5 — Prism Core (the model-agnostic lift)
- Provider adapter interface + implementations: Anthropic, OpenAI/Codex, OpenAI-compatible
  (covers Ollama / vLLM / OpenRouter → open models).
- `prism.config.{json,yaml}` mapping roles → models, e.g.:
  ```yaml
  draft: claude-opus-4-8
  judge: claude-sonnet-5
  grounding_verifier: qwen2.5-coder:32b   # cheap/local
  skeptics: [claude-opus-4-8, gpt-5-codex, qwen2.5-coder:32b]  # genuine cross-model
  ```
  Ship a `local` profile (all Ollama, zero keys) and a `balanced` profile.
- Core owns control flow (deterministic fan-out/judge/verify/loop) and emits the Proof Packet.
- **Open question (user's call): Core language.** Lean **TypeScript** — one toolchain across
  Core + MCP + dashboard, MCP SDK is TS-first; adapters hit any OpenAI-compatible endpoint so
  open models work regardless. Alt: Python (heavier local-model ecosystem).

### Phase 2 — Distribution
- **MCP server** exposing `prism-verify` / `prism-plan` / etc. → any MCP client (Claude Code,
  Codex, Cursor, Zed).
- **CLI** `prism verify|plan|...` for scripts/CI.
- **Codex integration** via MCP or a Codex custom command calling the CLI.
- **Enforcement** as git hooks (pre-push/pre-commit) + a **Stop hook** for Claude Code that fires
  the gate when a session ends with staged changes — the literal "gate between generation and merge."

### Phase 3 — Web dashboard (a proof + measurement console, not "run history")
Primary GUI now that VS Code is dropped. Contents that earn their place:
1. **Merge-gate queue** — every run + verdict; the team review inbox (blocked / needs-review / accepted).
2. **Model-comparison view** — per run, how each model in the skeptic panel voted; which model
   catches what others miss; makes cross-model decorrelation visible + measurable (a live eval).
3. **Cost/quality ledger per provider** — $ + tokens by model, so devs tune the config.
4. **Eval trends** — divergence, grounding P/R, fleet-vs-single win rate over time.
5. **Project-memory browser** — invariants, danger zones, decision log across repos, with
   `/prism-prune` staleness flags.
Reuses `renderer/proof-packet.html` for the packet detail view.

## Assumptions & falsifiers
- Assumes MCP is available in the target hosts (true for Claude Code/Codex/Cursor today).
- Assumes open models via Ollama/vLLM are strong enough to be useful skeptics/grounding verifiers —
  **to be measured by `/prism-eval` on the multi-provider config**; if they're not, the local
  profile becomes "draft/judge on frontier, cheap grounding only" rather than all-local.
- Cross-model helps only if lineages genuinely disagree — the divergence metric + dashboard
  model-comparison view are the falsifier.

## Open questions for the human
1. Prism Core language: **TypeScript** (recommended) vs Python.
2. Dashboard hosting: local-first (reads `.prism/runs/`) vs hosted team service — start local?
3. Which open model(s) to default the `local` profile to (Qwen2.5-Coder / DeepSeek / Llama)?

## Telemetry
- divergence: n/a (planning doc, no fan-out run)
- models: draft=opus (this planning session) · skeptics=n/a
- decision: proof-layer reframe + model-agnostic Core + MCP/CLI distribution + dashboard console;
  VS Code dropped. Phase 0 + renderer shipped on `feat/proof-layer-and-model-agnostic`.
