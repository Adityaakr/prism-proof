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

