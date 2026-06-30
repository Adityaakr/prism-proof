# Project Model — Prism (prism-claude-code)

*Durable, evidence-cited model of THIS repo. Every Prism run reads this first.*
*Last updated: 2026-06-30 by `/prism-plan` (added Decision log entry 01 + lesson). Created same day by `/prism-understand`.*

---

## What this repo IS
Prism is a **multi-agent orchestration toolkit for Claude Code** — a set of slash-command
playbooks + enforcement hooks + an eval harness. It is NOT an application; it is tooling that
turns one LLM pass into a fan-out → judge → adversarial-verify → loop → persist pipeline. The
repo is self-hosting: it uses Prism to reason about Prism, and its eval battery tests Prism on
its own internals.

## Architecture (components → how they connect)
- **`commands/*.md` (10 commands)** — the user-facing surface, installed to `~/.claude/commands`
  or `<repo>/.claude/commands`. The lifecycle: `prism-understand` → `prism-plan` → `prism-build`
  → `prism-implement` → `prism-feedback` → `prism-retro`, plus `prism-prune` / `prism-eval` (meta),
  `prism-ship` (drives the whole lifecycle autonomously), and `prism` (auto-router).
  - Router classifies ARCHETYPE (understand/plan/build) + MODE (looped/single) + FLEET size by
    stakes (two-way door → 3 lenses; one-way → 8 + verify) — `commands/prism.md:24-40`.
- **Deliberation Engine** — shared primitives reused by the heavy commands
  (`OVERVIEW.md:40-77`): fan-out w/ differential context → divergence score → judge → verify
  (grounding + cross-tier skeptics) → loop (cap 3) → persist + telemetry.
- **Enforcement hooks (`hooks/`)** — real Claude Code hooks, not prompts:
  - `prism-guard.sh` — `PreToolUse` Bash hook; blocks one-way doors unless `# PRISM_OK` token
    present (`hooks/prism-guard.sh:29,32`); exit 2 = block.
  - `prism-gate.sh` — user-run integrity gate for `/prism-implement` milestones; greps the diff
    for faked-green builds, deleted assertions, hardcoded secrets, debug leftovers
    (`hooks/prism-gate.sh:22-35`); exit 1 = findings.
- **Memory — two layers** (`OVERVIEW.md:103-119`):
  - Project: `.prism/project-model.md` (THIS file) — per-repo, about the CODE. Git-ignored.
  - User: `~/.prism/user.md` — global, about the HUMAN (Persona Protocol + standing defaults).
    Ships sanitized as `user.example.md`; real profile git-ignored.
- **Eval harness (`eval/` + `/prism-eval`)** — fixtures with ground truth + a task battery that
  measure whether the fleet beats one pass. Results in `eval/results/`, synthesized in
  `EVAL-REPORT.md`.
- **Docs** — `README.md` (power-toolbox framing), `OVERVIEW.md` (closed-system framing),
  `ARTICLE-BRIEF.md` (editorial: "honest enough to recommend its own reduction"),
  `architecture.excalidraw` (editable diagram).

## Invariants (rules the code/system relies on — each cited)
- **Cross-tier, NOT cross-model.** The sub-agent `model` param selects by TIER only (2× Opus +
  1× Sonnet skeptics); docs must never say "cross-model" — `OVERVIEW.md:91-93`.
- **Grounding outranks cross-tier survival** in every confidence signal — `OVERVIEW.md:96-98`.
- **No fabricated eval numbers.** Unrun sections report `NOT RUN`; every number traces to a real
  sub-agent's reported `subagent_tokens` — `EVAL-REPORT.md:24-26`, `OVERVIEW.md:134-135`.
- **Guard bypass is a known hole:** `prism-guard.sh:32` does NOT block a local `git commit`, so the
  branch-before-code default is the only thing keeping the agent off `main` — `EVAL-REPORT.md:90-92`.
- **Divergence threshold is uncalibrated** (placeholder 0.30) until `/prism-eval` sets it from data
  — `OVERVIEW.md:65`.
- Every line about code in any decision doc must carry a `file:line` citation — house rule across
  all commands.

## Conventions
- **Doc auto-sync:** `scripts/sync-docs.sh` regenerates two marker-delimited regions from the filesystem:
  the command index in `README.md` (`<!-- prism:commands -->`) and the docs index in `OVERVIEW.md`
  (`<!-- prism:docs -->`). `hooks/prism-docs-sync.sh` is a git pre-commit hook that runs it and re-stages,
  so add/remove a command or doc and the indexes update on commit. CAVEAT: `.git/hooks/pre-commit` is a
  per-clone symlink (not committed); a fresh clone must run `ln -sf ../../hooks/prism-docs-sync.sh
  .git/hooks/pre-commit`. The script never writes prose (no slop); narrative stays human.
- Each command is a self-contained markdown playbook with YAML frontmatter (`description`,
  `allowed-tools`) — see `commands/prism.md:1-4`.
- `*.example.*` files are the shipped sanitized templates; real `user.md` and `.prism/` are
  git-ignored (`.gitignore:4-5`).
- Commands open with Layer 0: read `~/.prism/user.md`, follow Persona Protocol, greet once.
- Project-internal eval tasks live in `eval/battery/battery.md`; fixtures with planted ground
  truth in `eval/fixtures/`.

## Danger zones
- **`hooks/prism-guard.sh`** — security-sensitive; the regex (`:32`) is the allowlist of blocked
  one-way doors. Editing it changes what the agent can do unsupervised. Known gap: local commits.
- **`commands/prism.md`** — the router; a prior eval found a math error in its skeptic-decisiveness
  rationale (`EVAL-REPORT.md:86-89`). Reason carefully about majority-of-3 logic here.
- **`EVAL-REPORT.md` / eval numbers** — the credibility of the whole project rests on these being
  honest. Never smooth a caveat or invent a number.

## Decision log
- **2026-06-30 — Three improvements plan** → [`docs/01-prism-three-improvements.md`](../docs/01-prism-three-improvements.md).
  Add (1) big-codebase capability, (2) a clean-code "Craft floor", (3) a new `/prism-write` command.
  Recommended build order 3 → 2 → 1. Established design constraints (now treat as invariants for these features):
  - Repo Map caches STRUCTURE only, is a navigation hint never an authority; staleness via git blob OIDs,
    not file-count; relevance ranking allocates DEPTH not INCLUSION (breadth sweep preserved for audits).
  - Craft floor is qualitative prose subordinate to "conform first"; NO `prism-gate.sh` heuristics, NO numeric
    line cap, never refactor neighbors inline; type/doc discipline delegated to existing lint/strict done-signal.
  - `/prism-write` grounds every doc claim in real files; JetBrains is a real default (proceeds silently);
    only the HTML article asks once, and only if no `brand.md` and no user-specified style; summary reuses
    retro's git-diff, comments default to the craft floor.
  Open questions for `/prism-retro` to check: build order, Feature-1 monorepo scope-now-or-later, whether
  comments deserve a first-class mode, gate-stays-untouched. Closes eval battery Tasks 5 + 10 (`eval/battery/battery.md:13,18`).
- **2026-06-30 — Feature 3 IMPLEMENTED** on branch `feat/prism-write` (uncommitted). New `commands/prism-write.md`
  (96 lines, em-dash-free), README + OVERVIEW tables bumped to eleven commands. User chose build order
  3 → 2 → 1, and Feature-1 scope = structure-cache + sizing-gate first (monorepo as follow-up). Lesson
  banked below re: the em-dash self-catch.
- **2026-06-30 — Feature 2 (Craft floor) IMPLEMENTED** on branch `feat/prism-write` (uncommitted). Added a
  qualitative clean-code floor to `prism-implement.md` (new §0 bullet at :36, done-definition at :57,
  readability self-review, adversarial readability question, Guardrail at :134), `prism-build.md` (greenfield
  sets+records the standard; CONFORM branch matches the repo's quality bar), and `prism-ship.md` BUILD LOOP
  step d. Per the skeptic pass: NO `prism-gate.sh` changes, NO numeric line cap, never refactor neighbors
  inline.
- **2026-06-30 — Feature 1 (Repo Map: structure-cache + sizing-gate) IMPLEMENTED** on branch
  `feat/prism-write` (uncommitted). `prism-understand.md` gets a SIZE & MAP pre-flight (step 0) + a
  "Repo Map" section defining `.prism/repo-map.md` (structure + low-confidence concern tags + git-OID
  fingerprint). `prism.md` differential-context caches the bucketing scan to `.prism/repo-map.md` as a
  non-authoritative hint and ranks for DEPTH not inclusion. `prism-prune.md` step 6 re-buckets on OID
  drift. `OVERVIEW.md` 5b documents it. Closes eval Task 5 (concern-map staleness). DEFERRED per user:
  full monorepo mode (eval Task 10) — only manifest-root detection is present, not per-package build
  orchestration. All three planned features now implemented; nothing committed.

## Docs
- `docs/01-prism-three-improvements.md` — the plan (decision doc) for the three features.
- `docs/02-whats-new-article.html` — `/prism-write` article-mode output about the three features.
  Style chosen by user: warm monochrome, system fonts, technical direction; self-contained (inline SVG,
  no network). First real test-drive of the new `/prism-write` command (run as the playbook, since it is
  not yet installed as a global skill).
- `docs/03-prism-production-readiness.md` — production-grade plan (13 sections). Single-pass draft then a
  2-critic cross-tier pass that overturned the committed-Index keystone. MVP = 3 foundational-gap fixes +
  4-tier evidence/citations + tiered guard + checkpoint.json + ripgrep/ctags retrieval, gated by eval.
- `docs/04-path-to-production-grade.md` — the honest "why not 9.8" scorecard. Gives each of 8 gaps an
  OBJECTIVE done-bar (planned != done), and names the ceiling: battle-tested/category-defining is earned
  by real use + a hardened, re-run eval, not by features. Recommendation: do evidence-converting work
  first (land evidence tiers, make the memory decision, RUN on real large repos, re-run the eval) before
  building more machinery.

- **2026-06-30 — Production MVP shipping** on branch `feat/production-mvp`. Built + verified:
  (1) tiered safety guard `hooks/prism-guard.sh` v2 (risk tiers; allows `rm -rf node_modules`, blocks
  absolute/home/wildcard deletes + one-way doors; nudges commit-on-main) with `hooks/test-prism-guard.sh`
  (22/22 pass). (2) `scripts/prism-version.sh` + `VERSION` (hash-based drift check; detects MISSING/
  DRIFTED/STALE). (3) Evidence 4-tier ladder + citation enforcement, retrieval discipline, and CHECKPOINT
  convention added to `commands/prism.md` building blocks. (4) Monorepo nearest-manifest-wins detection in
  `prism-build.md` + `prism-implement.md`. (5) Memory decision MADE: `.gitignore` now shares
  `project-model.md` + `repo-map.md`, keeps `user.md` + `runs/` private; write-protocol note in the MEMORY
  block. STILL OPEN: live large-repo validation (needs a real external repo; cannot be done solo).

## Open questions (for prism-retro)
- **Is `.prism/` team-shared or machine-private?** `.gitignore:5` ignores it (private), but
  `OVERVIEW.md:239` tells users to commit `project-model.md` (shared). Direct contradiction; gates the
  whole memory architecture. Product decision for Aditya. Recommended: un-ignore `project-model.md`,
  keep `user.md` + `runs/` private.

## Lessons  (for prism-retro; never delete)
- 2026-06-30 (`/prism-write` test-drive): the article first shipped with decorative callout boxes
  (uppercase rust labels, panel backgrounds). User flagged them as AI-slop. Fixed the artifact AND the
  command: `commands/prism-write.md` now bans visual slop (callout boxes, Note/Important panels, badge
  clutter) in BOTH the voice rules (:48) and article mode (:75). Lesson: anti-slop is a LAYOUT rule, not
  just a prose rule; bake taste corrections into the command, not just the one artifact. See also
  [[the em-dash self-catch]].
- The 4-task eval pilot showed Fleet 3–0; the 12-task run reversed it to Single 5–3 (4 ties) at
  ~4.6× cost. Small samples lie — the harness runs ≥12 and reports a Wilson CI for this reason
  (`EVAL-REPORT.md:80-82`). The fleet's real edge is **defect-finding**, not open-ended design.
- 2026-06-30 (`/prism-plan` for docs/01): ran a LEAN config (3 grounding explorers + 3 cross-tier
  skeptics, not the 8-lens fleet) on open-ended design, per the eval's "shrink the default" finding.
  The 3-skeptic pass materially changed 2 of 3 feature designs (killed a stale-cache-as-authority,
  a noisy gate heuristic, a default-vs-ask contradiction). Measured signal: skeptics earn their cost
  when there is a concrete design decision to refute, matching `EVAL-REPORT.md:84-100`.
- 2026-06-30 (`/prism-plan` for docs/03): again single-pass draft + 2-critic pass. The critics overturned
  my OWN keystone: I proposed a committed symbol/dep Index; both killed it as stale-by-default (same
  lesson as the Repo Map skeptic). Cuts: 10-file run log to 1, 8 tiers to 4, 7 memory files to 1, token
  enforcement deleted (impossible from inside a prompt). The accuracy critic caught 5 stale
  `prism-implement.md` citations in my draft (off ~15 lines) — proof that Prism has no self-versioning and
  that citing playbook line numbers is fragile (cite section names instead). Lesson: my first-draft
  instinct over-builds committed infrastructure for what is a markdown tool; the fleet earned its cost on
  defect-finding here, exactly as the eval predicts.
- 2026-06-30 (`/prism-write` build): I wrote the anti-em-dash command and it shipped with 13 em-dashes
  (inherited persona boilerplate + mode-label separators). A `grep -c "—"` self-check caught it before
  the user did. Lesson: when a doc rule is mechanically checkable, RUN the check on the artifact; do not
  trust that you followed your own rule. The persona-block boilerplate carries em-dashes across all commands.
