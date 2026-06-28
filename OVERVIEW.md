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
5. **Compounding memory** — each run makes the next one smarter about *this* project.
6. **Enforced, not requested** — critical safety guards are real hooks the model can't bypass.
7. **Measured, not claimed** — the harness can prove (or disprove) its own value, and is willing to recommend shrinking itself.
8. **Honest over reassuring** — flag uncertainty, label confidence, report what held up *and* what broke.

## 4. The nine commands
Prism is a lifecycle, each stage its own command:

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

### 5e. Project Memory — the compounding layer
`.prism/project-model.md` holds an evidence-cited model of the codebase: architecture, **invariants**
(each cited), conventions, danger zones, a **file concern map** (for W1), a decision log, and lessons.
`/prism-understand` builds it; plan/build/implement read it first; retro and implement write to it;
prune keeps it true. This is what makes Prism stateful.

### 5f. Enforcement layer — prompts become hard rules
Two real Claude Code hooks convert "the model should" into "the system enforces":
- **`prism-guard.sh`** — a `PreToolUse` hook that **blocks one-way doors** (force-push, publish,
  deploy, DB migration, `rm -rf`, mainnet tx) unless the user approves with a `# PRISM_OK` token.
- **`prism-gate.sh`** — an integrity check in `/prism-implement` that catches faked-green builds
  (skipped/deleted tests), hardcoded secrets, and leftover debug.

### 5g. Proof harness — `/prism-eval` + `eval/fixtures/`
Prism can test its own core bet. Fixtures with ground truth feed four measurements:
- **Grounding precision/recall** against known invariants + injected false/stale claims.
- **Fleet-vs-single win-rate** via blind preference A/B over a task battery (cross-tier judges, token-multiple).
- **Injected-flaw detection** — fleet vs single-pass as reviewers of a planted bug.
- **Find-the-floor** — a config sweep (2-lens / 4-lens / 8-lens) reporting the *minimal* config that
  still beats single-pass. The harness is explicitly allowed to recommend **"shrink the default."**
Numbers exist only when `/prism-eval` is actually run; unrun sections report `NOT RUN` — never fabricated.

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
   ║ invariants · conventions · danger zones · decisions · lessons · file-concern map      ║
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
- **Designed > proven, but closing.** The eval harness exists and has produced its first real result
  (the Sonnet skeptic detected a planted auth-bypass at full parity with Opus — so the split is
  *proven not-harmful*, though not yet proven *better* than 3× Opus on harder flaws). Most headline
  metrics still report `NOT RUN` until `/prism-eval` is run on an expanded battery.
- **Cost & latency.** Deep runs spawn dozens of agents; use `quick` for light tasks. The find-the-floor
  sweep exists precisely to stop the harness from being bigger than it needs to be.

## 9. How to use it
Install: copy `commands/*.md` into `~/.claude/commands/` (global) or a repo's `.claude/commands/`
(shared). Wire the hooks from `settings.example.json`. Then invoke `/prism-*` from any project. Each
run states its plan (`Archetype | Mode | Stakes | Fleet: N agents`) and prints a divergence line before
spending agents.

---

*For a drop-in file that generates a written article about Prism, see [`ARTICLE-BRIEF.md`](ARTICLE-BRIEF.md).*
