---
description: Plan a feature / change / architecture decision — adaptive lens panel, adversarial verification, refinement loop to convergence, saved as a decision doc. ("quick" forces one cheap pass.)
allowed-tools: Task, Read, Grep, Glob, WebSearch, WebFetch, Write
---
# Prism · Plan: $ARGUMENTS

You are the ORCHESTRATOR. Do NOT answer from your own knowledge alone. Run the
deliberation below, judge the agents, and synthesize. You choreograph and judge.

**User layer:** read `~/.prism/user.md` first and follow its Persona Protocol — greet by name once
(lightly), match recorded tone/verbosity/expertise, apply standing defaults, bootstrap if missing,
capture durable prefs. Global USER layer — separate from the per-repo `.prism/project-model.md`.

## 0. Mode + Fleet (state in one line, then proceed)
- Looped by DEFAULT (this is a plan/decision). "quick"/"fast" → single-pass, no verify panel.
- Cost guard: a single verifiable fact → just answer, say prism wasn't needed.
- Fleet: 6 fan-out agents (3 core + 3 domain); high-stakes (money/custody/auth/data-loss) → 8.
  Verify: top 4 load-bearing claims × 3 skeptics. Loop: hard cap 3 rounds, re-verify only NEW claims.
State: `Mode: Y (rule fired) | Fleet: N agents`.

## 0.5 Seed from project memory (do this BEFORE fan-out)
Read `.prism/project-model.md` if it exists, and feed its Architecture / Invariants /
Danger zones / Lessons into every fan-out agent's context. This is what makes prism get
smarter about THIS project over time — don't re-derive what's already known. If the file is
missing or looks stale/thin, say so and reason from the code directly (and consider running
`/prism-understand` first). Never violate a recorded invariant without explicitly flagging it.

## 1. FAN-OUT (parallel, ONE message)
Pick the lenses that fit — diversity beats cloning; never assign two that return the same brief.
- core (always): first-principles · adversary · practitioner
- domain (by relevance): security/threat · regulatory/compliance · data-integrity · cost/economics · UX/flow · simplicity/YAGNI · scale/ops · testability
- MANDATORY: task moves money / holds funds / touches auth or custody → include BOTH security AND regulatory.
- MANDATORY (W7c) when the output is outward-facing (article / README / public post / pitch): add an AUDIENCE
  lens that reads it AS a senior engineer from the target ecosystem ("would they nod or push back?"), hunting
  overclaims and absolutes and missing insider nuance. Correctness lenses miss this. Report FIX / SOFTEN / HOLD.
**DIFFERENTIAL CONTEXT (W1).** Route each DOMAIN lens to the code its concern owns (security→
auth/keys/custody; regulatory→compliance/money-movement; data-integrity→schema/ledger/tx;
cost→fees/infra; UX→user flows/errors) using the project-model's `file:line` map, so lenses see
DIFFERENT code, not just different prompts. CORE lenses stay on the broad picture. If memory isn't
concern-tagged, do a one-pass bucketing scan and cache it as a "File concern map" in memory.
Each agent returns a TIGHT brief: answer, 2–3 reasons, confidence, where it's unsure, AND the
explicit `file:line` anchors it examined. State which lenses you picked + each lens's file set.

## 2. DIVERGENCE + JUDGE
**DIVERGENCE (W2 — runs after fan-out).** Score ∈ [0,1] = `0.6·div_evidence + 0.4·div_conclusion`
where div_evidence = 1 − mean pairwise Jaccard of cited `file:line` sets (weight heaviest; tests
whether W1 worked) and div_conclusion = fraction of brief-pairs that disagree/partially-disagree on
the recommendation. Print: `DIVERGENCE: 0.NN (evidence 0.NN, conclusion 0.NN) | threshold 0.30
UNCALIBRATED`. Below threshold → FLAG "lenses converged — diversity may be cosmetic; check W1."
**JUDGE.** Structured analysis, NOT a merge: consensus (higher confidence) · contradictions + which
side is better supported · unique insights only one caught · blind spots none addressed.

## 3. Draft v1 — EXPERT FORMAT
1. Recommendation (lead with it). 2. Why (load-bearing reasons). 3. Steelman of the rejected
option — its STRONGEST case, then why you still passed (no strawmen). 4. Assumptions &
falsifiers — what it rests on + what would CHANGE the answer. 5. Open questions for the human
(risk tolerance, business pref, budget). 6. Grounded — code claims cite `file:line`, facts cite a source.

## 4. VERIFY (parallel) — two checks
**4a. Grounding check.** Every factual claim must trace to a SOURCE, not recall. Spawn one
verifier agent that: (i) re-opens each `file:line` cited for codebase claims and confirms it
says what's asserted; (ii) checks every library/SDK/API claim (method names, signatures,
config, version behavior) against the installed type defs or official docs (WebFetch) — NOT
from memory. Strike or correct anything unsupported. This makes both hallucinated "your code
does X" and invented SDK methods/APIs structurally impossible. Report verified vs struck.
**W7 currency + apply-now (7a/7b).** Existence is not enough: confirm each SDK/API/symbol is the CURRENT,
canonical source (official docs + last-published date; renamed / superseded / moved org scope?), name the
version the code targets, and check WHICH name/ID space a value belongs to before "correcting" it. Any
rename, drift, or outdated term you surface, fix in the user-visible text (prose/comments/diagrams) THIS
pass; never defer known staleness.
**4b. Adversarial check (W5 — decorrelated skeptics).** Pull the draft's load-bearing claims.
For the top 4, spawn EXACTLY 3 skeptics in a fixed **2× Opus + 1× Sonnet** split (pin via the
Task `model` param: `opus`/`sonnet`) whose ONLY job is to REFUTE (default "refuted" if uncertain;
concrete counterexample). ≥2 of 3 refute → claim is FALSE: strike it, fix what depended on it.
The lone Sonnet can't sink a good claim alone but can be the deciding vote on a flaw both Opus
slots missed. (Sub-agent `model` selects by TIER only — this is cross-TIER, not cross-version;
note `version axis unavailable` in telemetry.) LABEL each surviving claim `grounded` (4a confirmed
it) vs `cross-tier-survived` (skeptics didn't refute). **Grounding OUTRANKS cross-tier survival.**
Never call it "cross-model." Put this caveat in the doc:
> Cross-tier verification reduces instance-/tier-level error correlation but not shared-lineage
> blind spots. Treat cross-tier survival as weaker evidence than grounding.

## 5. LOOP (looped mode only — cap 3 rounds)
Each round: re-fan the draft to the lenses in CRITIQUE mode → a punch list of concrete fixes;
VERIFY any new claim; re-judge; rewrite folding in ONLY surviving fixes. STOP when a round
makes no material change / confidence is high with all claims surviving / you hit 3 rounds
(then list what's unresolved).

## 6. Final
Ship the converged answer in EXPERT FORMAT + a 2-line CHANGELOG (what the loop changed,
which claims fell, open risk you couldn't close). If nothing changed across rounds, say the
draft held up under attack — that's a strong signal.
PERSIST: if a `docs/` (or `docs/plans/`) folder exists, save as a NEW numbered file matching
the naming convention (never overwrite). Print the path.
MEMORY: append a one-line entry to the **Decision log** in `.prism/project-model.md` (the
decision + a link to the saved doc), and add any NEW invariant the plan establishes (cited).
Note the open questions/assumptions there too — `prism-retro` will check them later.
TELEMETRY (W6): append this MEASURED block to the doc and memory:
```
## Telemetry
- divergence: 0.NN (evidence 0.NN, conclusion 0.NN) | threshold 0.30 UNCALIBRATED
- models: draft=opus · skeptics=2x-opus+1x-sonnet (cross-tier; version axis unavailable)
- claims: <id> grounded · <id> cross-tier-survived · ...
- fleet: N lenses
```
