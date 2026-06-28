# Orchestration Playbook Skill

A set of [Claude Code](https://claude.com/claude-code) slash commands that turn a single
hard question into a **coordinated team of AI agents** — fanning out across diverse
perspectives, judging their disagreements, adversarially verifying the conclusions, and
looping until the answer converges.

Instead of asking one model once and trusting the first answer, you get a deliberation:
many agents reason in parallel from different angles, skeptics try to *refute* the key
claims, and only what survives makes it into the final output.

> **One sentence:** it makes Claude think like a team of experts arguing toward the
> right answer, instead of a single voice guessing at it.

---

## Why this exists

A single LLM pass has predictable failure modes:

- it anchors on the **obvious** answer and never stress-tests it,
- it **averages** conflicting considerations instead of resolving them,
- it states plausible-but-wrong claims **confidently**,
- it gives you a conclusion but not the **reasoning** you'd need to trust or learn from it.

This playbook attacks each of those directly:

| Failure mode | The fix in this skill |
|---|---|
| Anchoring on the obvious | An **adversary lens** is always in the panel, arguing the strongest case *against* |
| Averaging conflicts | A **judge** step that resolves contradictions and picks the better-supported side — never a merge |
| Confident-but-wrong claims | **Adversarial verification** — 3 skeptics try to refute each load-bearing claim; majority rules |
| Answer without reasoning | **Expert format** output: recommendation, *steelman of the rejected option*, assumptions, and what would change the answer |

---

## The four commands

| Command | Use it to… | What runs under the hood |
|---|---|---|
| **`/fusion-understand`** | Understand how existing code or a concept works | Parallel explorers (one per subsystem) → synthesized into one model + a `file:line` map. Builds/updates project memory. Read-only, fast. |
| **`/fusion-plan`** | Design a feature, change, or architecture decision | Reads project memory → adaptive lens panel → judge → grounding + adversarial verify → refinement loop → saved decision doc |
| **`/fusion-build`** | Stand up a new project from scratch | Frame the goal → architect the stack (verified) → decompose into a phased, dependency-checked roadmap that ships v1 first |
| **`/fusion-retro`** | Learn from a shipped plan | Compares what the plan PREDICTED vs what actually shipped → writes the lessons back into project memory |
| **`/fusion`** | Not sure which — let it decide | Auto-classifies the task into understand / plan / build and runs the right one |

All commands share the same primitives (below). The named commands are leaner, focused
entry points; `/fusion` is the catch-all router.

## What makes it different: it compounds

Most prompts and workflows are **stateless** (start from zero every time), **ungrounded**
(reason about your code from a shallow read), and **open-loop** (never learn if their advice
was right). This skill closes all three gaps — and that's the real differentiator:

- **Project memory** — `/fusion-understand` builds `.fusion/project-model.md`: a durable,
  evidence-cited model of *your* codebase (architecture, **invariants**, danger zones,
  decisions, lessons). Every later run reads it first, so the skill gets smarter about your
  project over time instead of re-deriving it.
- **Grounding verifier** — every claim about your code must cite `file:line`, and a verifier
  agent *re-opens those lines* to confirm. Hallucinated "your code does X" claims get struck.
- **Outcome loop** — after you ship, `/fusion-retro` compares predicted vs actual and banks
  the lesson back into memory. The next plan starts from what the last one got wrong.

Together: **stateful + grounded + self-improving** — a different category from one-shot tools.

---

## How it works — the building blocks

Every command is assembled from the same five moves:

1. **Fan-out** — launch N agents *in parallel*, each with a distinct lens or scope. The
   diversity rule: never give two agents a lens that would return the same brief. More
   agents only help when they see *different* things.
2. **Judge** — read every brief and produce structured analysis, **not** a blend:
   consensus, direct contradictions (+ which side is better supported), unique insights
   only one agent caught, and blind spots none addressed.
3. **Verify (adversarial)** — pull the conclusion's load-bearing claims; for each, spawn
   skeptics whose *only* job is to refute it. A claim a majority of skeptics can break is
   struck from the answer.
4. **Loop** — re-attack the draft in critique mode, fold in only the fixes that survive,
   and repeat until a round changes nothing material (convergence) — capped at 3 rounds.
5. **Persist** — for plan/build runs, save the converged result as a numbered markdown
   file in your project's `docs/` folder (never overwriting).

### The lens roster

- **Core (always):** first-principles · adversary · practitioner
- **Domain (added by relevance):** security/threat · regulatory/compliance ·
  data-integrity · cost/economics · UX/flow · simplicity/YAGNI · scale/ops · testability
- **Mandatory rule:** if the task moves money, holds funds, or touches auth/custody, both
  the **security** and **regulatory** lenses are forced into the panel.

### Fleet sizing (defaults)

- **Fan-out:** 6 agents (3 core + 3 domain); high-stakes tasks → 8
- **Verify:** top 4 load-bearing claims × 3 skeptics each
- **Loop:** hard cap 3 rounds; only *new* claims are re-verified each round
- **`quick` / `fast`:** 3 core lenses, no verify panel — the cheap path

### Expert-format output (plan & build)

Every plan/build answer is structured to teach the *reasoning*, not just hand over a verdict:

1. **Recommendation** — leads with the answer
2. **Why** — the load-bearing reasons
3. **Steelman of the rejected option** — its *strongest* case first, then why it still lost
4. **Assumptions & falsifiers** — what the answer rests on, and what would *change* it
5. **Open questions for the human** — the calls only you can make
6. **Grounded** — code claims cite `file:line`; external facts cite a source

---

## Install

Claude Code reads slash commands from `.claude/commands/`. Copy these in at whichever
scope you want:

```bash
# Clone
git clone https://github.com/Adityaakr/orchestration-playbook-skill.git
cd orchestration-playbook-skill

# Global — available in every project
mkdir -p ~/.claude/commands
cp commands/*.md ~/.claude/commands/

# OR per-project — available only inside one repo (and shareable via git)
mkdir -p /path/to/your-project/.claude/commands
cp commands/*.md /path/to/your-project/.claude/commands/
```

Restart Claude Code (or retype `/`) and the commands appear in the picker.

---

## Usage

```bash
# Understand an existing system (read-only, fast)
/fusion-understand explain how invoices get paid in this app end to end

# Plan a feature or make an architecture call (auto-loops, verifies, saves a doc)
/fusion-plan how should a user pay from their existing in-app balance instead of reconnecting a wallet?

# Build something new from scratch (frames -> architects -> phased roadmap)
/fusion-build a stablecoin payroll dApp on Arbitrum

# Let it route automatically
/fusion <anything>

# Force a fast, cheap pass on any planning question
/fusion-plan quick should we use embedded wallets or a custodial ledger?
```

Each run **states its plan before spending agents** — e.g.
`Mode: looped (spec-shaped) | Fleet: 8 agents` — so you always know what it's about to do.

---

## Cost & honesty notes

- These commands spawn **many parallel agents**. A deep `/fusion-plan` or `/fusion-build`
  run can use dozens of agent calls across its loop rounds — that's the point, but it's
  real token cost. Use `quick` for lightweight questions.
- More agents are only better when they're **diverse**. The commands enforce this with the
  diversity rule and an adaptive lens panel — they won't clone the same perspective N times.
- The skill is a **prompt**, not magic. If you ever see it skip a step, add
  `follow every step` to your message, or drop to `quick` so it doesn't over-orchestrate a
  simple ask.

---

## License

MIT — use it, fork it, adapt the lenses to your domain.
