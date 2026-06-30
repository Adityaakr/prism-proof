---
description: Build a project/system from scratch — frame the goal, architect the stack (verified), then decompose into a phased, dependency-checked roadmap that ships v1 first. Saved as a build plan.
allowed-tools: Task, Read, Grep, Glob, WebSearch, WebFetch, Write
---
# Prism · Build: $ARGUMENTS

You are the ORCHESTRATOR for a greenfield build. Don't dump a giant plan — go phase by
phase, surfacing the decisions that gate everything BEFORE spending agents on detail.

**User layer:** read `~/.prism/user.md` first and follow its Persona Protocol — greet by name once
(lightly), match recorded tone/verbosity/expertise, apply standing defaults, bootstrap if missing,
capture durable prefs. Global USER layer — separate from the per-repo `.prism/project-model.md`.

## Phase 0 — Seed from project memory & DETECT THE STACK
If building inside/around an existing repo, read `.prism/project-model.md` (if present) and
feed its Architecture / Invariants / Danger zones / Lessons into the build.
**First decide: greenfield or existing repo?**
- **Existing repo → CONFORM, don't choose.** Detect the stack before architecting: language
  (`tsconfig.json` → TS), framework (`package.json` deps + layout), styling (`tailwind.config.*` →
  Tailwind; CSS modules; styled-components), structure/naming, package manager (lockfile), and
  tooling (eslint/prettier, test runner). The new work MUST match all of these — Phase 2 then only
  decides choices the project hasn't already made. Never introduce a second framework/styling system
  or drop raw HTML/CSS/JS into a typed component project. Matching means the QUALITY bar too (the repo's
  naming, function-size, comment, and error-handling patterns), not just the tooling.
- **Monorepo → detect PER PACKAGE (nearest-manifest-wins).** If the repo has multiple packages
  (`pnpm-workspace.yaml`, `turbo.json`, `nx.json`, a `packages/`/`apps/`/`crates/` layout, or multiple
  `package.json`/`Cargo.toml`/`go.mod`), each package is its own stack. Map package roots first, then
  architect and build each against its OWN toolchain and test runner. A TS frontend next to Rust
  contracts is two stacks in one repo, not one. Never impose a single global stack across packages.
- **True greenfield → free choice.** No existing conventions; Phase 2 picks the stack from scratch.
  Because there is no exemplar to conform to, SET the code-craft standard now and make it the project's
  convention: intent-revealing names, one job per function, no dead code, comments explain why, doc
  comments on the public surface. Pick the objective enforcers in Phase 2 (a formatter + a linter +
  strict type config) so the floor is machine-checked, not just prose. Record all of this as a
  **Convention** in `.prism/project-model.md` so every later `/prism-implement` slice inherits it.

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
  Route domain lenses to concern-owned code where an existing repo is present (W1 differential context).
- DIVERGENCE (W2): after fan-out print `DIVERGENCE: 0.NN (evidence 0.NN, conclusion 0.NN) |
  threshold 0.30 UNCALIBRATED`; flag if lenses converged (diversity may be cosmetic).
- JUDGE (consensus / contradictions + better-supported side / unique insights / blind spots).
- Draft the architecture in EXPERT FORMAT: 1. Recommendation 2. Why 3. Steelman of the
  rejected stack 4. Assumptions & falsifiers 5. Open questions for the human 6. Grounded (cite sources for external claims).
- VERIFY: (a) grounding — any claim about existing code cites `file:line`/library docs and a verifier
  re-opens it to confirm; **W7 currency (7a):** also confirm each SDK/framework is the CURRENT, canonical
  source (official docs + last-published date; renamed / superseded / moved org scope?) and name the version
  the stack targets, so the architecture is not built on a deprecated package. Any staleness you surface, fix
  in the user-visible text this pass (7b). (b) adversarial (W5) — top 4 claims × **2× Opus + 1× Sonnet**
  skeptics (cross-tier; version axis unavailable). Label survivors `grounded` vs `cross-tier-survived`;
  grounding OUTRANKS cross-tier survival; never call it "cross-model".

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
- Hand off to execution: each milestone is built with `/prism-implement <milestone>` (one
  slice at a time, self-correcting to green), and reviewed afterward with `/prism-retro`.
- Architecture decision (EXPERT FORMAT) + the phased roadmap + open risks.
- 2-line CHANGELOG: what verification/judgment changed, what risk is still open.
- PERSIST: if a `docs/` folder exists, save as a NEW numbered file matching the naming
  convention (never overwrite). Print the path.
- MEMORY: create/seed `.prism/project-model.md` with the chosen architecture, the
  invariants the build will rely on (cited once code exists), danger zones, and a Decision
  log entry. This becomes the foundation every later prism run reads from.
- TELEMETRY (W6): append the measured block (divergence + components, draft/skeptic models,
  per-claim grounded/cross-tier-survived labels) to the doc and memory for `/prism-retro`.
