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

