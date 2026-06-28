# Prism — Overview, Features & Architecture

> White light enters a prism and splits into a full spectrum. One question enters Prism and
> splits into a spectrum of expert perspectives, then recombines into one verified answer.

## 1. What it is
**Prism is a multi-agent orchestration harness for [Claude Code](https://claude.com/claude-code)** —
a set of slash commands that turn a single hard question or task into a coordinated team of AI
agents that fan out across diverse perspectives, judge their disagreements, adversarially verify
their conclusions, and loop until the answer converges — while *remembering* the project,
*grounding* every claim in real code, and *enforcing* safety with hard hooks.

## 2. The problem it solves
A single LLM pass has predictable failure modes:
- **Anchoring** — it locks onto the obvious answer and never stress-tests it.
- **Averaging** — it blends conflicting considerations instead of resolving them.
- **Confident hallucination** — it states plausible-but-wrong claims, especially about your own codebase.
- **No reasoning trail** — it gives a conclusion, not the *why* you'd need to trust or learn from it.
- **Statelessness** — it starts from zero every session and never learns whether its advice was right.
- **Unenforced safety** — "be careful" is just text the model may ignore in a long session.

Prism is architected to attack each of these directly.

## 3. Core philosophy
1. **Diversity over cloning** — more agents help *only* if they see different things; never run two identical perspectives.
2. **Judge, don't merge** — resolve contradictions and pick the better-supported side; averaging dilutes the correct answer.
3. **Adversarial verification** — skeptics actively try to *refute* load-bearing claims; only survivors make the final cut.
4. **Grounded, not asserted** — every claim about code cites `file:line` and is re-checked.
5. **Compounding memory** — each run makes the next one smarter about *this* project.
6. **Enforced, not requested** — critical safety guards are real hooks the model can't bypass.
7. **Honest over reassuring** — flag uncertainty, label confidence, report what held up *and* what broke.

## 4. Features — the eight commands
Prism is a lifecycle, each stage its own command:

| Command | Purpose | Method |
|---|---|---|
| `/prism-understand` | Map existing code or a concept | Parallel explorers → one synthesized model + `file:line` map; builds project memory. Read-only. |
| `/prism-plan` | Design a feature/change/architecture decision | Reads memory → adaptive lens panel → judge → grounding + adversarial verify → refinement loop → saved decision doc |
| `/prism-build` | Stand up a new project from scratch | Frame goal → architect (verified) → decompose into a phased, dependency-checked roadmap that ships v1 first |
| `/prism-implement` | Turn a milestone into working code | Write → run tests → diagnose → fix loop until green. Regression-safe, never fakes a pass, escalates instead of thrashing |
| `/prism-feedback` | Adversarially stress-test a target | Confirms what the target is + who owns it → active probes (your code) or passive assessment (third-party) → reproduced, severity-ranked findings |
| `/prism-retro` | Learn from a shipped plan | Compares predicted vs actual → writes lessons back into memory |
| `/prism-prune` | Keep memory trustworthy | Re-verifies cited invariants against live code; prunes/corrects stale entries |
| `/prism` | Router | Auto-classifies the task and runs the right stage |

## 5. Architecture

### 5a. The shared "Deliberation Engine"
The heavy commands (plan/build/implement/feedback) are all assembled from the same five primitives:
1. **Fan-out** — launch N agents in parallel, each with a distinct *lens*. Lens roster: core
   (first-principles, adversary, practitioner) + domain lenses added by relevance (security,
   regulatory, data-integrity, cost, UX, simplicity, scale, supply-chain). Mandatory rule:
   anything touching money/custody/auth forces the security AND regulatory lenses in.
2. **Judge** — read all briefs and produce structured analysis (consensus, contradictions + which
   side wins, unique insights, blind spots) — *not* a merge.
3. **Verify** — two checks: **grounding** (every code claim cites `file:line`; a verifier re-opens
   those lines to confirm) and **adversarial** (for the top load-bearing claims, spawn 3 skeptics
   each whose only job is to refute; ≥2 of 3 refuting kills the claim).
4. **Loop** — re-attack the draft in critique mode, fold in only fixes that survive, repeat until
   a round changes nothing material (convergence) — capped at 3 rounds.
5. **Persist** — save the converged output to `docs/` and update project memory.

### 5b. Adaptive budget (resource intelligence)
Fleet size scales to **reversibility**: a two-way-door decision (a refactor) gets 3 lenses; a
one-way door (money, migration, public API) gets 8 lenses + full verification. It won't burn 40
agents on something you can undo in a commit.

### 5c. Project Memory — the compounding layer
A durable file, `.prism/project-model.md`, holds an evidence-cited model of the codebase:
**architecture, invariants** (the silent rules code relies on, each cited), conventions, danger
zones, a decision log, and lessons. `/prism-understand` builds it; plan/build/implement *read it
first*; retro and implement *write to it*; prune *keeps it true*. This is what makes Prism
stateful — it accumulates understanding of *your* project instead of re-deriving it every run.

### 5d. Enforcement layer — prompts become hard rules
Two real Claude Code hooks convert "the model should" into "the system enforces":
- **`prism-guard.sh`** — a `PreToolUse` hook on the Bash tool. It runs before every shell command
  and **blocks one-way doors** (force-push, publish, deploy, DB migration, `rm -rf`, mainnet
  transactions) unless the user explicitly approves with a `# PRISM_OK` token. The model cannot bypass it.
- **`prism-gate.sh`** — an integrity check run during `/prism-implement` that catches the classic
  cheat of faking a green build (skipped/deleted tests), plus hardcoded secrets and leftover debug.

### 5e. The lifecycle
```
              ┌─────────────────────────────────────────────┐
              │                                             │
   USER ──► /prism (router) ──► understand ─► plan/build ─► implement ─► feedback ─► retro
                                    │             │            │           │          │
                                    ▼             ▼            ▼           ▼          ▼
                          ┌──────────────  DELIBERATION ENGINE  ──────────────┐
                          │   fan-out → judge → verify(ground+skeptics) → loop │ ⟲ converge
                          └────────────────────────────────────────────────────┘
                                    ▲ read                        write ▼
                          ╔═══════════ PROJECT MEMORY (.prism/project-model.md) ═══════════╗
                          ║  invariants · conventions · danger zones · decisions · lessons ║
                          ╚═════════════════════════════════════════════════════════════════╝
       ENFORCEMENT (hooks): prism-guard blocks one-way doors · prism-gate blocks faked-green builds
```

## 6. How a run works (worked example)
For `/prism-plan how should users pay from their existing balance?`:
1. **Classify** — plan-shaped, high-stakes (money) → looped mode, 8-lens fleet. Reads project memory.
2. **Fan-out** — 8 agents in parallel: first-principles, adversary, practitioner, security,
   regulatory, data-integrity, cost, UX. Each returns a tight brief (answer, reasons, confidence, uncertainties).
3. **Judge** — reconcile: where they agree, where they contradict (and who's better supported),
   what only one caught, what all missed.
4. **Draft** in expert format: recommendation → why → **steelman of the rejected option** →
   assumptions & **falsifiers** (what would change the answer) → open questions for the human → grounded citations.
5. **Verify** — grounding check (re-open cited `file:line`) + 3 skeptics per load-bearing claim; strike what they refute.
6. **Loop** — critique rounds until convergence (≤3).
7. **Persist** — save to `docs/NN-*.md`, update memory's decision log + new invariants.

## 7. What makes it different
Most "AI workflows" are **stateless, ungrounded, open-loop, and unenforced**. Prism closes all four gaps:
- **Stateful** — project memory compounds across runs.
- **Grounded** — citations re-verified against real code.
- **Self-improving** — the retro loop banks predicted-vs-actual lessons.
- **Enforced** — hooks make safety a hard rule, not a hope.

It's not a single clever prompt — it's a *system* where the pieces compose, covering the full arc:
understand → decide → build → ship → attack → learn.

## 8. Honest limitations
- **Prompt-defined, not infrastructure.** Prism rides on Claude Code's agent loop; the
  orchestration logic lives in prompts the model follows (the hooks are the exception — those are enforced).
- **Cost & latency.** Deep multi-agent runs spawn dozens of agents; they're slow and token-heavy. Use the `quick` path for light tasks.
- **Adherence vs. length.** A long skill can be partially skipped by the model; enforcement hooks exist precisely to backstop the most important guards.
- **Proven vs. designed.** It's strongly designed and improves through real use (the feedback
  command was already tuned from its first live run), but reliability is earned task by task, not declared.

## 9. How to use it
Install: copy `commands/*.md` into `~/.claude/commands/` (global) or a repo's `.claude/commands/`
(shared). Wire the hooks from `settings.example.json`. Then invoke `/prism-*` from any project.
Each run states its plan (`Archetype | Mode | Stakes | Fleet: N agents`) before spending agents.

---

*For a drop-in file that generates a written article about Prism, see [`ARTICLE-BRIEF.md`](ARTICLE-BRIEF.md).*
