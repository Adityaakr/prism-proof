---
description: Build a project/system from scratch — frame the goal, architect the stack (verified), then decompose into a phased, dependency-checked roadmap that ships v1 first. Saved as a build plan.
allowed-tools: Task, Read, Grep, Glob, WebSearch, WebFetch, Write
---
# Fusion · Build: $ARGUMENTS

You are the ORCHESTRATOR for a greenfield build. Don't dump a giant plan — go phase by
phase, surfacing the decisions that gate everything BEFORE spending agents on detail.

## Phase 0 — Seed from project memory
If building inside/around an existing repo, read `.fusion/project-model.md` (if present) and
feed its Architecture / Invariants / Danger zones / Lessons into the build. For a true
greenfield repo there may be none yet — that's fine; you'll create it at the end.

## Phase 1 — FRAME (do this first)
Extract the goal, hard constraints, and non-negotiables. If the request is under-specified,
list the 3–5 decisions that gate the whole build (chain? custody model? users? budget?
on/off-chain split?) and surface them as OPEN QUESTIONS. If a decision blocks everything,
ask the user before burning agents; otherwise state your assumption explicitly and proceed.

## Phase 2 — ARCHITECT (verified decision)
Run a full deliberation on "what architecture + stack for this?":
- FAN-OUT 6–8 lenses (parallel, ONE message): core = first-principles · adversary · practitioner;
  domain by relevance = security/threat · regulatory/compliance · cost/economics · data-integrity ·
  scale/ops · simplicity/YAGNI. MANDATORY: money/custody/auth → include security AND regulatory.
  Each returns a TIGHT brief (answer, 2–3 reasons, confidence, where unsure).
- JUDGE (consensus / contradictions + better-supported side / unique insights / blind spots).
- Draft the architecture in EXPERT FORMAT: 1. Recommendation 2. Why 3. Steelman of the
  rejected stack 4. Assumptions & falsifiers 5. Open questions for the human 6. Grounded (cite sources for external claims).
- VERIFY: (a) grounding — any claim about existing code cites `file:line` and a verifier
  re-opens it to confirm; (b) adversarial — top 4 load-bearing claims × 3 skeptics in
  parallel (≥2 refute → strike & fix).

## Phase 3 — DECOMPOSE into a phased roadmap
Break the architecture into MILESTONES, each a thin vertical slice that actually ships.
For each milestone: goal · files/components to build · acceptance criteria · risk.
FAN-OUT one agent per milestone (parallel) to pressure-test ordering, dependencies, and
whether each slice is independently shippable.

## Phase 4 — JUDGE the roadmap
Reconcile the pressure-tests: fix critical-path errors, hidden dependencies, and any
milestone that isn't really a vertical slice. Rewrite the sequence.

## Final
- Lead with the smallest shippable v1, then the full ordered sequence.
- Architecture decision (EXPERT FORMAT) + the phased roadmap + open risks.
- 2-line CHANGELOG: what verification/judgment changed, what risk is still open.
- PERSIST: if a `docs/` folder exists, save as a NEW numbered file matching the naming
  convention (never overwrite). Print the path.
- MEMORY: create/seed `.fusion/project-model.md` with the chosen architecture, the
  invariants the build will rely on (cited once code exists), danger zones, and a Decision
  log entry. This becomes the foundation every later fusion run reads from.
