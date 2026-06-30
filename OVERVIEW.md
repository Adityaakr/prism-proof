# Prism — Overview, Features & Architecture

> White light enters a prism and splits into a full spectrum. One question enters Prism and
> splits into a spectrum of expert perspectives, then recombines into one verified answer.

## 1. What it is
**Prism is a multi-agent orchestration harness for [Claude Code](https://claude.com/claude-code)** —
a set of slash commands that turn a single hard question or task into a coordinated team of AI
agents that fan out across diverse perspectives, judge their disagreements, adversarially verify
their conclusions, and loop until the answer converges — while *remembering* the project,
*grounding* every claim in real code, *enforcing* safety with hard hooks, and **measuring whether
the deliberation actually beats a single careful pass**.

## 2. The problem it solves
A single LLM pass has predictable failure modes:
- **Anchoring** — it locks onto the obvious answer and never stress-tests it.
- **Averaging** — it blends conflicting considerations instead of resolving them.
- **Confident hallucination** — plausible-but-wrong claims, especially about your own code or a library's API.
- **No reasoning trail** — a conclusion, not the *why* you'd need to trust or learn from it.
- **Statelessness** — it starts from zero every session and never learns whether its advice was right.
- **Unenforced safety** — "be careful" is just text the model may ignore in a long session.
- **Unfalsifiable value** — most "multi-agent" tools never check whether the extra agents helped at all.

Prism is architected to attack each of these directly — and to *measure* the last one.

## 3. Core philosophy
1. **Diversity over cloning** — more agents help *only* if they see different things; lenses get different *evidence*, not just different prompts.
2. **Judge, don't merge** — resolve contradictions and pick the better-supported side; averaging dilutes the correct answer.
3. **Adversarial, decorrelated verification** — skeptics from a *different tier* try to refute load-bearing claims; only survivors make the final cut.
4. **Grounded, not asserted** — every claim about code or an API is checked against a source, never recall.
5. **Compounding memory, two layers** — a per-project *code* model and a global *user* model; each run makes the next one smarter about both *this* project and *this* person.
6. **Enforced, not requested** — critical safety guards are real hooks the model can't bypass.
7. **Measured, not claimed** — the harness can prove (or disprove) its own value, and is willing to recommend shrinking itself.
8. **Honest over reassuring** — flag uncertainty, label confidence, report what held up *and* what broke.

## 4. The eleven commands
Prism is a lifecycle, each stage its own command — plus one that drives the whole thing:

| Command | Purpose | Method |
|---|---|---|
| `/prism-understand` | Map existing code or a concept | Parallel explorers → one synthesized model + `file:line` map; builds project memory. Read-only. |
| `/prism-plan` | Design a feature/change/architecture decision | Differential fan-out → divergence score → judge → grounding + cross-tier verify → refinement loop → saved decision doc |
| `/prism-build` | Stand up a new project (or build into one) | Detect & conform to the existing stack → architect (verified) → phased, dependency-checked roadmap |
| `/prism-implement` | Turn a milestone into working code | Detect stack → verify-don't-guess → write → run tests → fix loop until green. Never fakes a pass. |
| `/prism-feedback` | Adversarially stress-test a target | Confirm what it is + who owns it → active probes (your code) or passive assessment (third-party) → reproduced findings |
| `/prism-retro` | Learn from a shipped plan | Compares predicted vs actual + consumes telemetry → writes *measured* lessons back into memory |
| `/prism-prune` | Keep memory trustworthy | Re-verifies cited invariants against live code; prunes/corrects stale entries |
| `/prism-eval` | Prove the fleet beats one pass | Divergence threshold, grounding P/R, fleet-vs-single win-rate, injected-flaw detection, find-the-floor |
| `/prism-write` | Write human docs for what you built | README · change summary · retroactive code comments · a clean self-contained HTML article with an architecture diagram. Grounded in real files, human voice, no slop, no em-dashes. JetBrains style by default; asks for the article only. |
| `/prism-ship` | **Idea → working dapp, one command** | Drives the whole lifecycle autonomously: frame (asks its own gating Qs) → architect → decompose → build each milestone in self-correcting loops → attack with the full feedback fleet → retro/converge. Generates its own follow-up work; loops until done. Pauses only at scope, the approved architecture, and irreversible one-way doors. Cost-tuned: lean fleet to design, full fleet to attack. |
| `/prism` | Router | Auto-classifies the task and runs the right stage |

## 5. Architecture

### 5a. The shared "Deliberation Engine"
The heavy commands (plan/build/implement/feedback) are assembled from the same primitives, in order:

1. **Fan-out with differential context (W1).** Launch N agents in parallel, each a distinct *lens*.
   Core lenses (first-principles, adversary, practitioner) stay holistic; **domain lenses are routed
   to the slice of code their concern owns** (security → auth/keys/custody, regulatory →
   money-movement, data-integrity → schema/ledger, cost → fees/infra, UX → user flows). Lenses
   therefore *see different code*, not just read different prompts. Each brief reports the exact
   `file:line` anchors it examined.
2. **Divergence score (W2).** Immediately measure whether the lenses actually split or just cosplayed
   splitting: `0.6 · (1 − mean Jaccard overlap of cited file:line sets) + 0.4 · (conclusion
   disagreement)`. It prints every run and **flags when diversity is cosmetic** — a falsifier on the
   harness's own premise.
3. **Judge.** Structured analysis — consensus, contradictions (+ which side wins), unique insights,
   blind spots — *not* a merge.
4. **Verify — two checks.**
   - *Grounding:* every code claim cites `file:line` (a verifier re-opens it) and every library/API
     claim is checked against installed type defs or official docs — not memory.
   - *Cross-tier adversarial:* for each load-bearing claim, **2× Opus + 1× Sonnet** skeptics try to
     refute it (≥2 of 3 kills it). Different tiers share fewer blind spots than identical models.
5. **Loop.** Re-attack the draft in critique mode, fold in only fixes that survive, repeat until a
   round changes nothing material (convergence) — capped at 3 rounds.
6. **Persist + telemetry.** Save to `docs/`, update memory, and attach a measured telemetry block
   (divergence, model pool, per-claim survival mode).

### 5b. Differential context (W1) — making diversity real
The stated philosophy is "diversity over cloning," but same-context-different-prompt is one model in
costumes. W1 routes each domain lens to concern-owned code (cached as a "file concern map" in memory),
so the divergence metric has something real to measure.

**Scale handling (the Repo Map).** On a medium-or-larger repo, `/prism-understand` builds
`.prism/repo-map.md`: the directory tree, the workspace/manifest roots, and a low-confidence concern
tagging, fingerprinted by git blob OIDs (`git ls-files -s`), not a file count. A size gate picks the
strategy (small repo: flat explorers; large/monorepo: map the structure first, then rank areas to
allocate explorer *depth*, never to exclude code from an audit). The map is a navigation hint and never
an authority: lenses still open their own slice, no claim is grounded on the map alone, and `/prism-prune`
re-buckets on OID drift so the routing does not silently run on a stale map.

**Retrieval discipline + resume.** Across all commands, reading follows locate-before-read: query ripgrep
and the Repo Map first, shell out `ctags` on demand for symbols (never a committed index), and read spans
rather than whole files. Multi-phase runs write one `.prism/runs/<id>/checkpoint.json` so a killed run
resumes from the last phase instead of from zero. On a big repo the size gate in `/prism-understand`
(small / medium / large) picks the strategy automatically, so the user just runs the command as usual.

### 5c. Divergence metric (W2) — the falsifier
The cheapest, most diagnostic signal: if the lenses cite the *same* files and reach the *same*
conclusion, the fleet added nothing. Evidence overlap (Jaccard of `file:line` sets) is weighted
heaviest because it directly tests whether W1 worked. Threshold is **uncalibrated (placeholder 0.30)**
until `/prism-eval` sets it from data.

### 5d. Cross-tier verification (W5) — honest decorrelation
Same-model skeptics share the model's blind spots: three Opus instances miss a confident
hallucination the same way. Prism runs a fixed **2× Opus (rigor) + 1× Sonnet (independence)** split,
with majority rule (≥2 of 3) so the lone Sonnet can't sink a good claim but *can* be the deciding vote
on a flaw both Opus slots missed. **Honest limits, recorded in telemetry:**
- The sub-agent `model` parameter selects by **tier only** — so this is **cross-tier, not
  cross-version** and **never "cross-model."**
- Surviving claims are labeled `grounded` (re-checked against live code) vs `cross-tier-survived`
  (skeptics didn't object), and **grounding outranks cross-tier survival** in every confidence signal.
- Every decision doc carries: *"Cross-tier verification reduces instance- and tier-level error
  correlation but not shared-lineage blind spots. Treat cross-tier survival as weaker evidence than
  grounding."*

**Evidence tiers (surfaced on every load-bearing claim).** Those labels roll up into four tiers a reader
acts on: `verified` (a command ran, a test passed, or a verifier re-opened the cited `file:line`),
`supported` (an official doc or fresh cited memory, not re-checked; includes `cross-tier-survived`),
`unverified` (inferred or unchecked, never shown as fact), and `contradicted` (struck or flagged). A
load-bearing claim with no citation is `unverified` by definition, and each artifact prints a one-line
evidence summary (e.g. "4 verified, 6 supported, 1 unverified").

**Currency + audience grounding (W7).** Correctness alone (is it true, does it compile) misses how
OUTWARD-FACING work fails, so W7 runs alongside the normal grounding check on every command:
- **7a source currency.** Confirming an SDK/API/symbol EXISTS is not enough; confirm it is the CURRENT,
  canonical source (official docs + the registry's last-published date; renamed, superseded, or moved org
  scope?), name the version it targets, and verify which name/ID space a value lives in (SDK param vs
  protocol enum vs wire format) before "correcting" it.
- **7b apply-now.** A rename or stale term that a verifier surfaces is fixed in the user-visible text the
  same pass; "found, graded low, deferred" just means the reviewer finds it later.
- **7c audience lens.** Whenever the artifact is outward-facing (article, README, post, pitch), one lens
  reads it AS a senior engineer from the target ecosystem: it scopes overclaims and absolutes ("nothing to
  deploy", "fully private"), adds the insider nuance they expect (public-vs-private, trust boundaries,
  testnet caveats), and flags anything signaling the author does not actually use the thing. Correctness
  lenses do not cover this. Findings report as FIX / SOFTEN / HOLD. Lives in `/prism-feedback`,
  `/prism-write`, and `/prism-plan`; 7a/7b travel with every grounded run.

### 5e. Memory — two compounding layers
Prism keeps **two** durable memories with different lifetimes, deliberately kept separate so neither
pollutes the other:

- **Project memory — `.prism/project-model.md`** (per-repo, about the *code*). An evidence-cited
  model: architecture, **invariants** (each cited), conventions, danger zones, a **file concern map**
  (for W1), a decision log, and lessons. `/prism-understand` builds it; plan/build/implement read it
  first; retro and implement write to it; prune keeps it true. This is what makes Prism stateful *per
  project*.
- **User memory — `~/.prism/user.md`** (global, about the *human*). A **Persona Protocol** plus a
  profile: how to address you, your tone/verbosity/expertise, and **standing defaults** Prism applies
  without being re-told (testnet-first, branch-before-code, commit-only-when-asked, ground-don't-recall).
  Every command reads it first, greets you by name, adapts, and **captures durable preferences and
  corrections** as they surface — honesty over flattery, never a yes-man. If it's missing, Prism
  bootstraps it from `git config user.name` (asking once if needed), so a freshly-installed copy
  greets *whoever* is at the keyboard. Ships as a sanitized `user.example.md`; the real profile stays
  machine-local (git-ignored), like `settings.example.json`.

**Sharing decision (resolved).** `.gitignore` now SHARES the code-truth layer (`.prism/project-model.md`
and `.prism/repo-map.md`) so project understanding compounds across clones and teammates, while keeping
`user.md` and per-run traces (`.prism/runs/`) machine-private. A write protocol (append to the right
section, re-read before editing, respect a short-lived `.memory.lock`) keeps two concurrent runs from
clobbering memory.

### 5f. Enforcement & safety tooling — prompts become hard rules
Real Claude Code hooks plus committed scripts convert "the model should" into "the system enforces":
- **`prism-guard.sh` (v2, risk-tiered)**: a `PreToolUse` hook that classifies each Bash command by
  reversibility. RED one-way doors (force-push, push-to-main, publish, deploy, DB migration, mainnet tx,
  destructive git, and dangerous recursive deletes of root / home / absolute / wildcard paths) are
  BLOCKED unless approved with `# PRISM_OK`. Reversible deletes like `rm -rf node_modules` are allowed,
  and a `git commit` on main gets a branch-first nudge. Behavior is pinned by `hooks/test-prism-guard.sh`
  (22 cases), so the rules do not silently regress.
- **`prism-gate.sh`** — an integrity check in `/prism-implement` that catches faked-green builds
  (skipped/deleted tests), hardcoded secrets, and leftover debug.
- **`scripts/prism-version.sh` + `VERSION`** — a drift check. Commands are copied into
  `~/.claude/commands`, so a copy can drift from source silently; this compares installed vs source by
  content and reports MISSING / DRIFTED / STALE.

### 5g. Proof harness — `/prism-eval` + `eval/fixtures/`
Prism can test its own core bet. Fixtures with ground truth feed four measurements:
- **Grounding precision/recall** against known invariants + injected false/stale claims.
- **Fleet-vs-single win-rate** via blind preference A/B over a task battery (cross-tier judges, token-multiple).
- **Injected-flaw detection** — fleet vs single-pass as reviewers of a planted bug.
- **Find-the-floor** — a config sweep (2-lens / 4-lens / 8-lens) reporting the *minimal* config that
  still beats single-pass. The harness is explicitly allowed to recommend **"shrink the default."**
Numbers exist only when `/prism-eval` is actually run; unrun sections report `NOT RUN` — never fabricated.

### 5g-bis. Clean-code floor (the Craft floor)
Conforming to an existing codebase was already covered (detect the stack, match its naming and lint).
The gap was greenfield: with nothing to match, there was no quality standard, so code could compile,
pass tests, conform structurally, and still be unmaintainable. The Craft floor fills that gap in
`/prism-build`, `/prism-implement`, and `/prism-ship`: intent-revealing names, one job per function,
no dead code, comments that explain why, and "leave the file at least as readable as you found it." It
sits under the "conform first" rule and governs only the code that is yours to write. Deliberately
small after a skeptic pass: no numeric line cap (it breaks long cohesive units), no heuristic checks
bolted onto `prism-gate.sh` (a gate that cries wolf gets ignored), and type and doc discipline are left
to the project's strict and lint config, which the done-signal already enforces. New code is never an
excuse to refactor messy neighbors inline; that is logged as a follow-up.

### 5h. The lifecycle & engine (architecture diagram)
```
   USER ──► /prism (router) ──► understand ─► plan/build ─► implement ─► feedback ─► retro
                                    │             │             │           │          │
                                    ▼             ▼             ▼           ▼          ▼
   ┌──────────────────────────  DELIBERATION ENGINE  ───────────────────────────────────┐
   │ fan-out (DIFFERENTIAL context) → DIVERGENCE score → judge →                         │ ⟲
   │ verify [ grounding + (2×Opus + 1×Sonnet) cross-tier skeptics ] → loop → persist     │ converge
   └─────────────────────────────────────────────────────────────────────────────────────┘
                          ▲ read                                    write ▼ (+ telemetry)
   ╔══════════════ PROJECT MEMORY (.prism/project-model.md) ═══════════════════════════════╗
   ║ invariants · conventions · danger zones · decisions · lessons · repo map (sizing+OID)  ║
   ╚═══════════════════════════════════════════════════════════════════════════════════════╝
   ENFORCEMENT (hooks):  prism-guard → blocks one-way doors   ·   prism-gate → blocks faked-green
   PROOF (/prism-eval):  divergence threshold · grounding P/R · fleet-vs-single · find-the-floor
```

## 6. How a run works (worked example)
For `/prism-plan how should users pay from their existing balance?`:
1. **Classify** — plan-shaped, high-stakes (money) → looped, 8-lens fleet. Reads project memory.
2. **Differential fan-out** — 8 lenses; security reads the auth/custody files, regulatory the
   money-movement paths, data-integrity the ledger/schema — each on *its own* code. Briefs report
   the `file:line` sets they examined.
3. **Divergence** — `DIVERGENCE: 0.62 (evidence 0.71, conclusion 0.48) | threshold 0.30 UNCALIBRATED`.
   High → the lenses genuinely diverged; the fleet is doing real work (if it were low, it flags "cosmetic").
4. **Judge** — reconcile agreement, contradictions (+ who's better supported), unique catches, blind spots.
5. **Draft** in expert format: recommendation → why → steelman of the rejected option → assumptions &
   falsifiers → open questions → grounded citations.
6. **Verify** — grounding (re-open cited lines + check any SDK API vs its docs) + 2×Opus/1×Sonnet
   skeptics per load-bearing claim; label survivors `grounded` vs `cross-tier-survived`.
7. **Loop** — critique rounds until convergence (≤3).
8. **Persist** — save to `docs/NN-*.md`, update memory, attach the telemetry block. `/prism-retro`
   later compares predicted vs actual and banks a *measured* lesson.

## 7. What makes it different
Most "AI workflows" are **stateless, ungrounded, open-loop, unenforced, and unfalsifiable**. Prism
closes all five:
- **Stateful** — project memory compounds across runs.
- **Grounded** — code and API claims re-verified against sources, never recall.
- **Self-improving** — the retro loop banks measured predicted-vs-actual lessons.
- **Enforced** — hooks make safety a hard rule, not a hope.
- **Falsifiable** — the divergence metric + `/prism-eval` can prove the fleet's value *or* recommend shrinking it.

It's not a single clever prompt — it's a *system* where the pieces compose, covering the full arc:
understand → decide → build → ship → attack → learn, with a meter on whether the orchestration earns its cost.

## 8. Honest limitations
- **Prompt-defined, not infrastructure.** Prism rides on Claude Code's agent loop; the orchestration
  lives in prompts the model follows (the hooks are the enforced exception).
- **Cross-tier, not cross-model.** Decorrelation uses a different *tier* (Sonnet), not a different
  model lineage — version-pinning sub-agents isn't available here, and that limit is recorded in
  telemetry, never hidden. A genuinely independent reasoner would close the adversarial hole further;
  that's outside the Claude-only constraint.
- **Measured, and the result is humbling.** `/prism-eval` was run for real on a 12-task design
  battery. **A single careful Opus pass beat the 8-lens fleet 5–3 (4 ties) at ~4.6× lower token
  cost** (Wilson 95% CI [0.19, 0.68]). On open-ended design the fleet does *not* earn its cost — its
  one real edge is **defect-finding** (all 3 fleet wins were a lens catching a concrete cited bug,
  including real bugs in Prism's own files). Verdict: **shrink the default; reserve the fleet for
  review/defect-finding** — though the result is confounded (hand-synthesis quality, defect-free
  domain, single judge) so it's *shrink-leaning, not proven*. Full write-up: [`EVAL-REPORT.md`](EVAL-REPORT.md).
  This is the harness doing its job: a proof tool that can tell you to shrink itself.
- **Cost & latency.** Deep runs spawn dozens of agents; use `quick` for light tasks. The find-the-floor
  sweep exists precisely to stop the harness from being bigger than it needs to be.

## 9. How to use it
Install: copy `commands/*.md` into `~/.claude/commands/` (global) or a repo's `.claude/commands/`
(shared). Wire the hooks from `settings.example.json`. Then invoke `/prism-*` from any project. Each
run states its plan (`Archetype | Mode | Stakes | Fleet: N agents`) and prints a divergence line before
spending agents.

**Two ways to drive it:**
- **Step by step** (recommended for real, high-stakes work): `/prism-understand` → `/prism-plan quick`
  → `/prism-implement` (per milestone) → `/prism-feedback` (full fleet) → `/prism-retro`. You
  checkpoint between stages.
- **One command** (`/prism-ship <idea>`): drives the entire lifecycle autonomously, pausing only at
  scope, the approved architecture, and irreversible one-way doors. Most powerful, least-proven —
  try it on a small throwaway idea first.

**Evidence-tuned defaults:** use the LEAN/`quick` config for design decisions (the eval showed the
full fleet doesn't beat a careful pass there at ~5× cost) and the FULL fleet for `/prism-feedback`
and code review (where it measurably earns its cost). The hooks and project memory are the
proven-strong parts; keep them on.

**Memory sharing, stated honestly:** `.prism/` is gitignored by default (`.gitignore`), so project
memory is machine-local and does NOT compound across a team as shipped. To share it, un-ignore
`.prism/project-model.md` specifically and commit it, while keeping `user.md` and `.prism/runs/`
private. Whether memory should be team-shared or private is a real decision, not a default; it is the
first open question in the production-readiness plan below.

## 10. Production-readiness: what shipped, what is left
The plan is [`docs/03-prism-production-readiness.md`](docs/03-prism-production-readiness.md); the honest
scorecard with a done-bar per gap is [`docs/04-path-to-production-grade.md`](docs/04-path-to-production-grade.md).
The framing throughout: Prism is markdown playbooks plus hooks plus memory, not a runtime, so
production-grade means dependable artifacts and disciplined process, not uptime.

**Shipped (built, tested where testable, on main):**
- **Tiered safety guard** (`prism-guard.sh` v2): risk-classified, allows reversible `rm -rf node_modules`,
  blocks dangerous deletes + one-way doors, nudges commit-on-main. Pinned by `hooks/test-prism-guard.sh` (22 cases).
- **Version + drift check** (`scripts/prism-version.sh` + `VERSION`): hash-based, flags MISSING / DRIFTED / STALE installed commands.
- **Four-tier evidence ladder** (verified / supported / unverified / contradicted) + citation enforcement (5d).
- **Retrieval discipline + checkpoint resume** (5b).
- **Monorepo nearest-manifest-wins** detection in `/prism-build` and `/prism-implement`.
- **Memory decision made**: the code-truth layer is git-shared, `user.md` + `runs/` stay private (5e), with a write protocol.

**Still open (the one that matters):** live large-repo validation. Every shipped item above is wired in
and self-activates, but they are playbook instructions and tested scripts, not yet run against a real
>1000-file repo. That validation is what turns "shipped" into "battle-tested," and it is the next step.

## 11. Documents
<!-- prism:docs -->
- [`01-prism-three-improvements.md`](docs/01-prism-three-improvements.md): Plan 01: Three Prism improvements (big codebases, clean code, /prism-write)
- [`02-whats-new-article.html`](docs/02-whats-new-article.html): Three things we added to Prism
- [`03-prism-production-readiness.md`](docs/03-prism-production-readiness.md): Plan 03: Prism to production-grade
- [`04-path-to-production-grade.md`](docs/04-path-to-production-grade.md): Plan 04: The 9.8 gap, and what "done" means for each item

_Auto-generated by `scripts/sync-docs.sh`; do not edit by hand._
<!-- /prism:docs -->

These two indexes (the command index in the README and the document list above) are kept in sync
automatically by `scripts/sync-docs.sh`, run on every commit via a git pre-commit hook. Add or remove a
command or a doc and the indexes update themselves. The narrative stays human, on purpose.

---

*For a drop-in file that generates a written article about Prism, see [`ARTICLE-BRIEF.md`](ARTICLE-BRIEF.md).*
