---
description: Plan a feature / change / architecture decision — adaptive lens panel, adversarial verification, refinement loop to convergence, saved as a decision doc. ("quick" forces one cheap pass.)
allowed-tools: Task, Read, Grep, Glob, WebSearch, WebFetch, Write
---
# Fusion · Plan: $ARGUMENTS

You are the ORCHESTRATOR. Do NOT answer from your own knowledge alone. Run the
deliberation below, judge the agents, and synthesize. You choreograph and judge.

## 0. Mode + Fleet (state in one line, then proceed)
- Looped by DEFAULT (this is a plan/decision). "quick"/"fast" → single-pass, no verify panel.
- Cost guard: a single verifiable fact → just answer, say fusion wasn't needed.
- Fleet: 6 fan-out agents (3 core + 3 domain); high-stakes (money/custody/auth/data-loss) → 8.
  Verify: top 4 load-bearing claims × 3 skeptics. Loop: hard cap 3 rounds, re-verify only NEW claims.
State: `Mode: Y (rule fired) | Fleet: N agents`.

## 0.5 Seed from project memory (do this BEFORE fan-out)
Read `.fusion/project-model.md` if it exists, and feed its Architecture / Invariants /
Danger zones / Lessons into every fan-out agent's context. This is what makes fusion get
smarter about THIS project over time — don't re-derive what's already known. If the file is
missing or looks stale/thin, say so and reason from the code directly (and consider running
`/fusion-understand` first). Never violate a recorded invariant without explicitly flagging it.

## 1. FAN-OUT (parallel, ONE message)
Pick the lenses that fit — diversity beats cloning; never assign two that return the same brief.
- core (always): first-principles · adversary · practitioner
- domain (by relevance): security/threat · regulatory/compliance · data-integrity · cost/economics · UX/flow · simplicity/YAGNI · scale/ops · testability
- MANDATORY: task moves money / holds funds / touches auth or custody → include BOTH security AND regulatory.
Each agent gets the full question + its lens, plus Read/Grep/Glob if it touches the repo
(one gets WebSearch/WebFetch if current facts matter). Returns a TIGHT brief: answer, 2–3
load-bearing reasons, confidence (low/med/high), where it's unsure. State which lenses you picked.

## 2. JUDGE
Structured analysis, NOT a merge: consensus (higher confidence) · contradictions + which
side is better supported · unique insights only one caught · blind spots none addressed.

## 3. Draft v1 — EXPERT FORMAT
1. Recommendation (lead with it). 2. Why (load-bearing reasons). 3. Steelman of the rejected
option — its STRONGEST case, then why you still passed (no strawmen). 4. Assumptions &
falsifiers — what it rests on + what would CHANGE the answer. 5. Open questions for the human
(risk tolerance, business pref, budget). 6. Grounded — code claims cite `file:line`, facts cite a source.

## 4. VERIFY (parallel) — two checks
**4a. Grounding check.** Every claim the draft makes about the codebase MUST cite `file:line`.
Spawn one verifier agent that RE-OPENS each cited line and confirms it actually says what the
claim asserts. Strike or correct any claim whose citation doesn't check out. This makes
hallucinated "your code does X" claims structurally impossible. Report verified vs struck.
**4b. Adversarial check.** Pull the draft's load-bearing claims. For the top 4, spawn 3 skeptic
subagents each whose ONLY job is to REFUTE (default "refuted" if uncertain; concrete
counterexample required). ≥2 of 3 refute → claim is FALSE: strike it, fix what depended on it.
Report survivors/casualties.

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
MEMORY: append a one-line entry to the **Decision log** in `.fusion/project-model.md` (the
decision + a link to the saved doc), and add any NEW invariant the plan establishes (cited).
Note the open questions/assumptions there too — `fusion-retro` will check them later.
