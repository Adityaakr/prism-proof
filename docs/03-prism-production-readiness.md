# Plan 03: Prism to production-grade

*Decision doc. `/prism-plan` (invoked via the understand wrapper) on 2026-06-30. Grounded in the*
*command playbooks, hooks, memory model, and eval from this repo. Written without em-dashes.*

## The framing that makes this real, not a demo

Prism's execution substrate is Claude Code's agent loop: subagents (`Task`), tools (Read/Grep/Glob/
Bash/Edit/Write), permission modes, hooks (`PreToolUse`), and the transcript JSONL each run already
writes. Prism itself is four things: markdown command playbooks in `commands/`, two bash hooks in
`hooks/`, the `.prism/` memory files, and the `eval/` fixtures. It has no daemon, no database, no
server.

That means every feature below is one of three kinds, and the plan is worthless if it does not say
which:

- **P (playbook/convention):** an edit to a `commands/*.md` playbook or a memory format. Cheap, ships
  today, no new runtime. Most trust and token wins are here.
- **S (committed script/tool):** real software committed to the repo and invoked from a playbook, the
  way `prism-gate.sh` already is. Bounded build. The index and the run-log live here.
- **H (needs an external harness):** true enforcement that Claude Code cannot do from inside a prompt
  (hard token caps, model-call interception, sandboxed execution). Flag these honestly; several are
  later-or-never.

> **Revised after a cross-tier critic pass (2026-06-30).** The first draft of this plan proposed a
> committed "Prism Index" as keystone. Both critics rejected it: a symbol/dep index committed to a
> markdown repo is stale the instant anyone edits code without re-running it, which is the project's
> own "stale cache is worse than none" lesson. The whole product today is ~1,041 lines of markdown +
> ~92 lines of bash + one 10 KB memory file. That is the yardstick. Anything adding more committed
> machinery than that to "support" it is suspect by default. The plan below is the revised, leaner
> version. See the CHANGELOG at the end for what fell.

Two keystones carry the plan. Both are cheap and additive:

1. **Evidence tiers + citation enforcement (P):** every load-bearing claim carries a citation and one
   of four tiers. The foundation for trust, articles, memory, and verification. Ships as a playbook
   convention today, no new runtime.
2. **The tiered safety guard (S):** rewrite `prism-guard.sh`'s flat regex into a reversibility
   classifier. The one piece of genuinely new committed software worth building, and the plan's only
   real safety gap.

Retrieval is NOT a keystone and NOT a committed index. Claude Code already ships ripgrep (always fresh,
zero sync). The Repo Map already gives structure with OID staleness. For symbol lookups, shell out
`ctags` on demand into the scratch dir per run, never committed. That gets ~80% of an index at ~10% of
the build and maintenance cost, with no staleness liability.

---

## Section 1: What production-grade Prism must be

Ten properties, each defined for Prism's actual substrate:

1. **Grounded under stale docs and stale memory.** Never asserts from recall. Every code claim re-reads
   a `file:line`; every memory claim carries a freshness stamp and is downgraded when its cited content
   moves. This already partly exists (`commands/prism.md` VERIFY, the Repo Map OID staleness).
2. **Evidence-justified.** Any output can show why it is true: the citation and the tier behind each
   load-bearing claim. Today only skeptic survival is labeled (`grounded` vs `cross-tier-survived`).
3. **Observable.** A run leaves a structured trace (what each agent saw, what was retrieved, where
   tokens went, where it failed), not just a chat transcript.
4. **Resumable and checkpointed.** A run that dies mid-way can restart from the last good phase, not
   from zero. Today a killed run is lost.
5. **Failure-aware.** Knows the difference between "could not verify" and "verified false," and stops or
   escalates instead of hallucinating past a gap.
6. **Efficient on large repos.** Retrieves spans, never dumps files. Cost scales with the task, not the
   repo size.
7. **Safe under partial failure.** One dead subagent degrades the run, it does not corrupt it. Results
   are filtered, not silently dropped as truth.
8. **Measurable.** Every claimed improvement is backed by a fixture and a metric. The eval harness
   already embodies this; it needs more fixtures.
9. **Reversible.** Every write is git-backed; every one-way door is gated. Already strong via
   `prism-guard.sh` plus branch-before-code.
10. **Deterministic enough to trust.** Same inputs plus same memory give a stable shape of answer (the
    format, the tiers, the gates), even if prose varies. Achieved through fixed playbook structure, not
    by pretending the model is deterministic.

The honest bar: production-grade Prism is **dependable artifacts and disciplined process**, not a
high-availability service. Aim there.

### Three foundational gaps the feature list does not fix (resolve these first)

The accuracy critic surfaced three gaps that sit UNDER the feature list. If unresolved, several features
build on sand:

1. **Team memory does not exist, and the repo contradicts itself about it.** `.gitignore:5` ignores all
   of `.prism/`, so every teammate starts with zero project memory and `git add .prism/project-model.md`
   is blocked. Yet `OVERVIEW.md:239` tells users to "commit `.prism/project-model.md` so it compounds."
   That is a direct contradiction in the shipped repo. The compounding-memory value proposition is
   defeated for any team until this is decided: is `.prism/` machine-private (current gitignore) or
   team-shared (commit a sanitized `project-model.md`, keep `user.md` and `runs/` private)? This is a
   product decision for the human, and it gates all of Section 6. Recommended: un-ignore
   `project-model.md` specifically (commit the code-truth layer), keep `user.md` and `.prism/runs/`
   ignored. Fix the OVERVIEW/gitignore contradiction either way.
2. **No version or upgrade path for Prism itself.** Commands are COPIED into `~/.claude/commands/`
   (`README.md:284-298`), so a copy drifts from source with no signal. Proof: five `prism-implement.md`
   line citations in the first draft of THIS doc were already stale by ~15 lines against the current repo.
   Fix: stamp each command with a version, add a `prism-version` check that compares installed vs source,
   and stop citing playbook line numbers in memory (cite section names, which do not drift).
3. **Concurrency: two runs race on `project-model.md`.** No lock, no write protocol. A `/prism-plan` and
   a `/prism-implement` in two sessions both read then write the file; last write wins, silently dropping
   the other's updates. The `.prism/runs/<id>/` namespacing handles per-run traces but leaves the shared
   memory file unprotected. Fix: a simple write protocol (append-only sections, or a lock file in
   `.prism/`, or a "memory is updated by one command at a time" rule with a stale-lock timeout).

These are cheaper to fix than most features and they unblock the rest. Do them in the MVP.

---

## Section 2: Features to add, ranked

Attributes per feature: function, problem, integration, why, reliability, tokens, difficulty, tier
(MVP or hardening), and kind (P/S/H).

**1. Retrieval discipline (ripgrep + Repo Map + on-demand ctags)** (P, MVP)
- Function: a playbook rule to LOCATE before reading. Query ripgrep (Grep/Glob, always fresh) and the
  existing Repo Map first; when a symbol-to-`file:line` lookup is needed, shell out `ctags -R` into the
  scratch dir for that run, never committed. Read spans, not whole files.
- Problem: flat exploration and full-file reads waste tokens and miss things on big repos.
- Integration: extends `commands/prism-understand.md` step 0 and the fan-out rule in `prism.md`.
- Why: gets ~80% of an index at ~10% of the cost, with no committed artifact to go stale.
- Reliability: high. Tokens: large reduction. Difficulty: low. (A committed symbol/dep index was the
  first draft's keystone; both critics killed it as stale-by-default. Build the ephemeral version.)

**2. Evidence tiers + citation enforcement** (P, MVP)
- Function: a fixed tier ladder (Section 7) tagged on every load-bearing claim; a verifier strikes or
  downgrades any uncited claim.
- Problem: today "grounded" is binary and trust is implicit.
- Integration: extends the VERIFY step in `prism.md`/`prism-plan.md`; tiers print in every artifact.
- Why: trust is the product. Reliability: high. Tokens: slight increase (worth it). Difficulty: low.

**3. Run log + checkpoint + resume** (S, MVP)
- Function: each run writes `.prism/runs/<id>/` (manifest, per-agent slices, tool calls, token spend,
  phase checkpoints). A resume reads the last checkpoint.
- Problem: killed runs lose everything; bad runs are undebuggable.
- Integration: a small `prism-run.sh` helper plus a playbook convention to write phase state.
- Why: observability and recoverability. Reliability: high. Tokens: neutral. Difficulty: medium.

**4. Unified stale detector** (P+S, MVP)
- Function: one freshness check across index, memory, and docs using git blob OIDs; stale entries are
  flagged and downgraded, never silently trusted.
- Problem: stale memory is worse than no memory.
- Integration: extends `commands/prism-prune.md` step 6 to all memory layers.
- Why: the rot guard. Reliability: high. Tokens: neutral. Difficulty: low.

**5. Eval expansion + regression gate** (P+S, MVP)
- Function: new fixtures (retrieval gold set, stale-doc trap, stale-memory, article-factuality) and a
  rule that a feature ships only if it moves its metric without regressing the battery.
- Problem: you cannot ship the rest safely without a net.
- Integration: extends `eval/` and `commands/prism-eval.md`.
- Why: lets everything else ship. Reliability: high. Tokens: n/a. Difficulty: medium.

**6. Budget controls via COUNTABLE caps** (P, MVP)
- Function: cap things the playbook can actually count and enforce: fan-out agents (<=8 without a stated
  reason), loop rounds (<=3), candidate files read before reranking, deep-read depth. Small on two-way
  doors, full on one-way.
- Problem: runaway fan-out (the eval saw a 5.5x runaway agent).
- Integration: extends the fleet-sizing block in `prism.md:33-40`.
- Why: cost trust. Honest limit: a hard TOKEN cap is NOT possible from inside a prompt (the model cannot
  see its running spend or halt itself at a ceiling). That needs an external harness (H). Do not claim
  token enforcement Prism cannot deliver. Reliability: medium. Tokens: large reduction. Difficulty: low.

**7. Context packer** (S, MVP, part of the Index)
- Function: assembles a budgeted context bundle of spans (not whole files), deduped, citation-preserving.
- Problem: full-file dumps blow context and bury signal.
- Integration: playbooks call the packer instead of Read on big files.
- Why: the token lever. Reliability: high. Tokens: large reduction. Difficulty: medium.

**8. Reranking** (S, hardening)
- Function: a cheap model (haiku) scores retrieval candidates before injection; keep top-k.
- Problem: lexical recall is noisy; injecting all candidates wastes tokens.
- Integration: sits between Index query and packer.
- Why: precision. Reliability: medium. Tokens: reduction. Difficulty: medium.

**9. Blast-radius / dependency-impact** (P, later, conditional)
- Function: before editing a symbol, grep its references (and `ctags`/LSP if available) to list what a
  change can break.
- Problem: edits land with unknown downstream impact.
- Integration: a pre-edit step in `prism-implement.md`; feeds danger zones in memory.
- Why: safe change. Build only if a fixture proves grep + on-demand ctags cannot answer impact questions.
  Do NOT build a committed dependency graph on reflex. Reliability: high. Tokens: neutral. Difficulty: medium.

**10. Targeted test selection** (S+P, hardening)
- Function: map changed symbols to the tests that exercise them; run those first.
- Problem: full suites are slow; no-suite changes ship blind.
- Integration: the run loop in `prism-implement.md:68-81` runs the impacted set, then the full suite.
- Why: faster, cheaper verification. Reliability: high. Tokens: neutral. Difficulty: medium.

**11. Failure classification + escalation** (P, hardening)
- Function: a taxonomy (missing-evidence, conflicting-evidence, tool-error, budget-exhausted,
  same-error-loop) with a defined action per class (retry / fallback / stop / escalate).
- Problem: today the agent can thrash or hallucinate past a gap.
- Integration: extends the STOP conditions in `prism-implement.md:80-81` and the handoff.
- Why: predictable failure. Reliability: high. Tokens: reduction. Difficulty: low.

**12. Policy / risk engine on the guard** (S, hardening)
- Function: classify every command as read-only / reversible-write / one-way-door; gate by class, not a
  flat regex.
- Problem: `prism-guard.sh:32` is a flat regex that is both too loose and too tight. It MISSES a plain
  local `git commit` on main (only `git push origin main` is caught), and it OVER-blocks legitimate
  commands like `rm -rf node_modules` (the regex is bare `rm -rf`). Tiering by reversibility fixes both.
- Integration: rewrites the guard's matching into risk tiers.
- Why: safer execution. Reliability: high. Tokens: n/a. Difficulty: medium.

**13. Model routing** (P, partly H, hardening)
- Function: cheap models for indexing/classifying/reranking, expensive only for synthesis and hard
  reasoning. Soft via subagent `model` param; the skeptic split already does this for tiers.
- Problem: paying opus rates for mechanical work.
- Integration: a routing rule in the building-blocks section of `prism.md`.
- Why: cost. Reliability: neutral. Tokens: large reduction. Difficulty: low (soft).

**14. Grounded article pipeline** (P, hardening)
- Function: articles draw only from a collected evidence set with citations and a fact-checker pass.
- Problem: docs can drift from reality.
- Integration: extends `commands/prism-write.md` to bind to the Section 7 evidence system.
- Why: trustworthy artifacts. Reliability: high. Tokens: neutral. Difficulty: medium.

**15. Contradiction detector** (P, hardening)
- Function: cross-check new claims against each other and against memory; flag conflicts.
- Problem: silent contradictions erode trust.
- Integration: a verifier sub-step in VERIFY.
- Why: consistency. Reliability: medium. Tokens: slight increase. Difficulty: medium.

**16. Caching / verified-artifact reuse** (S, hardening)
- Function: reuse a prior verified map/plan/bundle when its inputs (OIDs) are unchanged.
- Problem: re-deriving what was already proven.
- Integration: the run log and index cache key on OIDs.
- Why: token and time. Reliability: neutral. Tokens: reduction. Difficulty: medium.

Cut on purpose: trajectory-replay infrastructure (transcripts already exist, replay is reading them),
a vector database (lexical + symbol covers most engineering retrieval; add embeddings only if an eval
shows lexical recall failing), a general rules engine (the tiered guard is enough).

---

## Section 3: Reliability and failure handling

Explicit mechanisms, mapped to Prism:

- **Retries:** re-run a failed subagent once for a suspected flake (already in `prism-implement.md:91`).
  On a repeated identical failure, do NOT retry the same way: fan out 2-3 different hypotheses
  (`prism-implement.md:92-93`), apply the best-supported.
- **Timeouts:** give each subagent a wall-clock and token ceiling. On breach, mark its result partial,
  keep what it produced, continue with the rest. Never let one agent stall the run.
- **Partial-failure recovery:** `parallel`-style fan-out treats a dead agent as null and filters it; the
  run continues on survivors and says coverage was reduced. Never promote a missing result to "all clear."
- **Resumable runs + checkpoints:** after each phase, write `.prism/runs/<id>/checkpoint-N.json` (phase,
  inputs OIDs, outputs, open items). Resume reads the last checkpoint and re-runs only the unfinished tail.
- **Fallback models:** if an opus subagent errors after retry, fall back to sonnet for that slot, then to
  a single-agent path, then escalate. Record which tier actually ran in the run log.
- **Fallback retrieval:** Index hit is best; on miss, fall back to grep; on grep miss, fall back to a
  scoped full read. Log which path served each lookup so retrieval gaps are visible.
- **Stale-context detection:** before trusting any cached map/memory, compare cited OIDs to current; on
  drift, re-verify the affected entries before use.
- **When to stop instead of hallucinating:** if a load-bearing fact cannot reach at least the
  `code-verified` tier, mark it UNVERIFIED and stop or narrow scope. The done-signal is sacred
  (`prism-implement.md:133`); never lower it to pass.
- **When to escalate to human:** any one-way door, any surviving contradiction between strong-tier
  claims, budget exhaustion, or a milestone stuck after a strategy change and the iteration cap.
- **Missing evidence:** state the gap, define the closest proxy, lower the confidence tier, proceed only
  if the proxy is honest. Never fabricate the missing piece.
- **Conflicting evidence:** surface both sides with citations, pick the better-supported with the reason,
  never silently average (this is the existing JUDGE rule, `prism.md:98`).
- **Rollback and reversibility:** every milestone ships with its revert (git path); destructive actions
  are gated; mainnet/migrations are hard stops.

---

## Section 4: Observability and debugging

Do not build a ten-file run log. The critic pass cut it: Claude Code already writes a transcript JSONL
that records every tool call and result, so a separate `tools.json` is redundant, and a `tokens.json` is
fiction (the model cannot reliably self-report running token spend from inside a prompt). Write the
minimum that the transcript does NOT already give you:

- **`.prism/runs/<id>/checkpoint.json`** (one file, rewritten per phase): phase name, input OIDs,
  outputs so far, open items, and the per-claim tier table. This is what enables resume and is the only
  genuinely missing trace.
- **`decision.md`:** the EXPERT-FORMAT output you already produce.
- **the native transcript:** the raw trace of tool calls, slices each agent saw, and failures.

**Debugging a bad run, concretely:** open `checkpoint.json`, find the phase where it went wrong. If the
answer was wrong, look at the tier table for a load-bearing claim that was `unverified` rather than
`verified`. Read the transcript for that phase: did retrieval miss, forcing a guess? Was the fan-out
cosmetic (low divergence)? Did a lens get the wrong slice? Each points to a specific fix (re-ground,
re-route W1, raise the tier bar). This turns "the model was wrong" into "retrieval missed file X at phase 2."

---

## Section 5: Large-repo robustness

The Index (Section 2.1) is the answer. Mechanisms:

- **Incremental indexing:** rebuild only files whose git blob OID changed. Never full re-scan.
- **Repo map:** the cheap structural tier (already shipped: `commands/prism-understand.md` Repo Map).
- **Symbol-level retrieval:** tree-sitter or ctags gives symbol to `file:line`. Retrieve the function,
  not the file.
- **Dependency edges:** import graph for blast-radius and impact.
- **Semantic retrieval:** optional. Honest caveat: there is no native Anthropic embeddings endpoint, so
  this means a Voyage or local-model dependency. Defer it until an eval shows lexical + symbol recall is
  insufficient. Do not add a vector DB on reflex.
- **Reranking:** cheap-model scoring of candidates before injection.
- **Context bundles:** the packer assembles spans within a token budget, deduped.
- **Concern map and ownership map:** the W1 concern tags plus CODEOWNERS and `git blame` for "who owns
  this and what is it for."
- **Retrieval caching:** keyed on OID, stored under `.prism/index/cache`.
- **Per-task assembly:** build the bundle for THIS task, not a generic dump.
- **Test-impact mapping:** changed symbols to the tests that touch them.
- **Avoid full-file dumps:** only load a whole file when the task genuinely needs all of it; default to spans.

**When the repo is too large to fit:** never try to. Map structure cheaply, retrieve spans, hold only a
budgeted bundle. If a single artifact (a generated file, a lockfile) is huge, retrieve by symbol or skip.
If the task itself spans more than one context can hold, decompose into sub-tasks, give each its own bundle,
and carry a small shared summary artifact between them (the run log holds it). Relevance ranking sets
DEPTH, never inclusion, for audits (the rule already in the Repo Map).

---

## Section 6: Memory architecture for production

> **Revised: do NOT split into seven files.** The critic pass rejected fragmenting the single 10 KB
> `project-model.md` into seven files. `prism-prune` already re-verifies every `file:line` and re-stamps
> it, so the file does not rot unseen today. Seven files multiply the rot surface (a claim can go stale
> in a file the run did not load), add seven load decisions per run, and create seven merge targets. Keep
> ONE `project-model.md`. The "layers" below are HEADINGS within it, not files. The only split that earns
> itself is already done: global prefs in `~/.prism/user.md` vs per-repo memory. Add one new heading,
> `## Stale / quarantine`, for downgraded claims.

Treat the rows below as headings within the single `.prism/project-model.md`, each with its own rules:

| Layer | Belongs | Never | Update | Prune | Revalidate | Citation | Freshness |
|---|---|---|---|---|---|---|---|
| **truths** | stable invariants | speculation, secrets | append on new invariant | on FALSE move to stale | every prune | `file:line` mandatory | OID-stamped |
| **playbooks** | workflows, conventions | one-off task detail | on new pattern | when superseded | low | optional | low |
| **decisions (ADR)** | `docs/NN` links, the call + why | un-decided opinions | append only | never delete, archive | n/a | link to doc | dated |
| **open-questions** | unresolved, assumptions | resolved items | move out when answered | when answered | each retro | the question | dated |
| **stale/risky** | quarantined downgraded claims | anything trusted | on downgrade | purge after confirmed-false + recorded | aggressive | original + reason | OID + reason |
| **user-prefs** | `~/.prism/user.md` (global) | project-specific code facts | on durable signal | rarely | n/a | n/a | dated |
| **failure-patterns** | structured lessons | blame, narrative fluff | on each retro | never delete | n/a | the run id | dated |

**Preventing rot:** every code claim carries a `file:line` and a last-verified OID. `prism-prune`
re-verifies; a claim whose OID drifted is downgraded to **stale/risky**, not deleted (history is kept).
A claim that re-verifies clean gets a fresh stamp. Anything in stale/risky is treated as below
`memory-supported` tier until reconfirmed. This makes rot self-healing: bad memory loses trust automatically
rather than silently poisoning later runs.

---

## Section 7: Verification and trust layer

**The tier ladder, tagged on every load-bearing claim.** Four tiers, not eight. The critic pass cut the
eight-tier version: the distinctions that actually change what an engineer does are trust it /
trust-with-caveat / do not trust / it is false. `doc-supported` vs `memory-supported` and `inferred` vs
`speculative` are hair-splits nobody acts on differently.

1. **verified:** a command ran, a test passed, or a verifier re-opened the cited `file:line` and
   confirmed it. (Runtime and test evidence are the strongest form of this; note them when present.)
2. **supported:** an official doc, installed type def, or a fresh cited memory entry asserts it, not
   independently re-checked.
3. **unverified:** inferred from verified facts or plausible but unchecked. Must be labeled, never
   presented as fact.
4. **contradicted:** evidence is against it. Strike or flag loudly.

**Mechanisms:**
- **Grounding verifier:** re-opens `file:line` (exists today, `prism.md:110` onward).
- **Runtime/test verifier:** runs the thing (exists in `prism-implement.md`).
- **Unsupported-claim detector:** any load-bearing claim with no citation drops to speculative or is struck.
- **Contradiction detector:** cross-checks claims against each other and memory.
- **Verifier/judge agents:** the cross-tier skeptics (`prism.md:110-132`), reserved for load-bearing claims.
- **Per-artifact verification:** plan, implementation, article, and decision each carry a tier check
  appropriate to them (a plan claim is code-verified at best; an implementation claim should be
  test-or-runtime-verified).

**Surfacing:** inline tags on load-bearing claims plus a one-line evidence summary per artifact
("4 runtime-verified, 6 code-verified, 1 speculative, 0 contradicted"). Grounding always outranks
cross-tier survival (the existing invariant). Keep the ladder short enough that people actually read it;
do not invent fifteen tiers.

---

## Section 8: Multi-agent, only where it earns its keep

Anchored to the eval finding: the fleet loses on open-ended design and wins on defect-finding
(`EVAL-REPORT.md:84-100`). So:

**Single-agent stays default for:** simple lookups, single-file edits, well-scoped implements, doc writes,
and open-ended design synthesis (one coherent pass beats fragmented briefs).

**Multi-agent clearly worth it:**
- **Parallel evidence gathering on a large repo.** Roles: scoped specialists each reading a disjoint
  file slice. Boundary: each gets only its slice (token saver). Shared artifact: the run log and the
  bundle. Stop: each returns its brief. Worth-it signal: the slices were genuinely disjoint (high W2
  evidence divergence).
- **Adversarial verification / judge.** Roles: 2x opus + 1x sonnet skeptics refuting load-bearing claims.
  Boundary: just the claim and its citation. Stop: majority verdict. Worth-it: it changed the answer
  (measured by retro: did a `cross-tier-survived` claim later fail?).
- **Architecture comparison.** Roles: N independent attempts from different angles, then one judge.
  Boundary: the same brief, different lens. Stop: judge picks plus grafts. Worth-it: high conclusion
  divergence (real disagreement to resolve).
- **Grounded article fact-checking.** Roles: one writer, one fact-checker against the evidence set.
  Boundary: the evidence set only. Stop: zero unsupported load-bearing claims. Worth-it: the checker
  caught a claim the writer could not cite.

**Conditional activation:** plan critique only for one-way-door/high-stakes; disagreement-based review
only when the first pass reports low confidence. Everything else is single-agent.

**How to know it was worth invoking:** the divergence score plus a retro check. If fan-out divergence was
low AND the outcome was no better than a single pass, log it and shrink that path next time. This is the
self-correcting loop the eval already runs.

---

## Section 9: Token efficiency as a systems problem

Exact heuristics:

- **Retrieve before generate.** Never dump a file you have not first located a span in. Query the Index first.
- **Rerank before inject.** Load at most ~5 candidate spans, cheap-model rank, inject top 2-3.
- **Bundles, not dumps.** Never inject a file over ~400 lines without a span target.
- **Memory layering.** Load only the memory layer the task needs (an implement run does not load the ADR history).
- **Agent-specific slices.** Each subagent gets its concern's slice, never the whole repo (W1 already).
- **Cache reuse.** If a map/plan/bundle's input OIDs are unchanged, reuse the verified artifact.
- **Cheap models for mechanical work** (index, classify, rerank, summarize); **expensive only for synthesis
  and hard reasoning and the skeptic rigor slots.**
- **Incremental context growth.** Start with the smallest plausible bundle; expand only on a verified miss.
- **Proof-preserving compression.** When summarizing context, keep the citations so grounding survives.
- **Dedup.** Suppress the same span injected into multiple agents where one shared brief suffices.
- **Budget caps on COUNTABLE units.** Cap fan-out agents, loop rounds, and candidate files. A hard token
  cap is not enforceable from inside a prompt, so do not pretend; cap the things the playbook can count.
- **Dynamic allocation by difficulty.** Two-way door: 3 lenses, no verify. One-way door: full fleet plus
  verify. Already the fleet-sizing rule.

Heuristic targets to encode: cap fan-out at 8 without a stated reason; cap a single agent's cited file set
so divergence stays meaningful; reuse any artifact whose OIDs match.

---

## Section 10: Safety and execution controls

- **Sandboxing / permission levels:** map to Claude Code permission modes; default read-only, escalate
  explicitly for writes.
- **Dry-run / plan-before-execute:** already structural (`prism-plan`, the G0/G1 gates in `prism-ship.md`).
- **Destructive guardrails:** `prism-guard.sh` blocks one-way doors; upgrade to the tiered risk classifier
  (Section 2.12) so `rm -rf node_modules` is allowed while `rm -rf /` and `git push origin main` are gated.
- **Secret handling:** `prism-gate.sh` catches secrets in diffs; add a hard rule that `.prism/` never
  stores secrets, and the run log redacts.
- **Environment isolation:** testnet-first default, mainnet is a hard stop (already a user standing default).
- **Command risk classification:** the policy engine tiers every command.
- **Human approval gates:** G0 (scope), G1 (architecture), plus every one-way door.
- **Safe write patterns:** branch-before-code, smallest change, never overwrite an unread file (all present).
- **Revert plans:** each milestone ships with its undo.
- **Auditability:** the run log plus git history is the audit trail.

The gap to close: the guard's flat regex. Tiering it is the one real safety build.

---

## Section 11: Grounded article / HTML pipeline

This plugs into Section 7, it is not a content feature. Pipeline:

1. **Collect evidence** into an evidence set: code spans, test results, run logs, diffs, decisions,
   screenshots, command outputs. Each item gets an id, a source, and a tier.
2. **Draft from the set only.** The writer may reference only evidence ids. A claim with no backing id is
   not allowed into the facts.
3. **Separate facts from interpretation.** Facts cite an evidence id and a tier. Interpretation is labeled
   as such and never dressed as fact.
4. **Fact-check pass.** A checker agent re-verifies each factual claim against its evidence id; unsupported
   claims are struck or demoted to interpretation.
5. **Retain internal citations.** Keep a hidden claim-to-evidence map; optionally expose as footnotes or a
   sources toggle in the final HTML.
6. **Non-sloppy output.** The anti-slop rules already in `commands/prism-write.md` (human voice, no
   em-dashes, no decorative callout boxes).

The article command becomes: gather evidence, draft against ids, fact-check, render. Same discipline as a
plan, applied to prose.

---

## Section 12: Eval and regression system

Fixtures to maintain in `eval/`:
- **retrieval gold set:** queries to expected spans. Metric: precision/recall@k.
- **stale-doc trap:** a doc that contradicts the code. Metric: catch rate.
- **stale-memory set:** a memory entry whose cited code moved. Metric: downgrade rate.
- **plan-quality battery:** the existing 12 tasks; grow to 25+.
- **implementation-verification set:** acceptance criteria with a known pass/fail.
- **large-repo robustness:** a synthetic big repo; measure retrieval cost and miss rate.
- **token-cost-vs-quality:** the existing fleet-vs-single token multiple.
- **multi-vs-single:** the existing A/B.
- **article-factuality:** claims with known evidence. Metric: unsupported-claim rate.
- **failure-recovery:** kill a run mid-way; measure resume correctness.

Failure modes to track: hallucinated API, stale citation, lost-in-large-repo, synthesis loss, budget
overrun, faked-green. Metrics that matter most: retrieval recall@k, stale-trap catch rate, unsupported-claim
rate, token multiple, resume correctness.

**Deciding a feature helped:** run the full battery before and after. A feature ships only if it moves its
own target metric AND regresses nothing else. No fixture, no ship. This is the existing "measured, not
claimed" rule extended.

---

## Section 13: Production rollout plan

**Top 5 for production readiness (MVP), revised after the critic pass:**
1. Resolve the three foundational gaps: commit decision for `.prism/project-model.md` (+ fix the
   OVERVIEW/gitignore contradiction), a Prism version stamp + drift check, and a memory write protocol.
2. Evidence tiers (4) + citation enforcement.
3. Tiered safety guard (rewrite `prism-guard.sh` by reversibility).
4. One `checkpoint.json` per run for resume (NOT a ten-file run log).
5. Retrieval discipline (ripgrep + Repo Map + on-demand ctags) + extend `prism-prune` to the unified
   stale detector (it is ~80% there already) + add 3 eval fixtures so the rest can ship behind a gate.

**Next 5 for robustness hardening:**
6. Budget controls + dynamic allocation.
7. Blast-radius + targeted test selection.
8. Failure classification + escalation.
9. Tiered policy/risk engine on the guard.
10. Model routing.

**Next 5 for compounding advantage:**
11. Grounded article pipeline.
12. Reranking + (conditionally) semantic retrieval.
13. Caching / verified-artifact reuse.
14. Ownership maps + contradiction detection.
15. Retro driven by run-log replay.

**30-day roadmap:** the three foundational-gap fixes, evidence-tier convention (4 tiers) + the grounding
verifier as a citation enforcer, the tiered guard rewrite, `checkpoint.json` + resume, retrieval discipline
(ripgrep + on-demand ctags, no committed index), extend `prism-prune` to the unified stale detector, add 3
fixtures (retrieval gold, stale-doc, stale-memory). Ship behind the eval gate.

**90-day roadmap:** countable budget caps, failure classification + escalation, targeted test selection,
soft model routing, the grounded article pipeline, the full 25+ task battery plus article-factuality and
failure-recovery evals. Add reranking only if retrieval precision is a measured problem, and semantic
retrieval / embeddings only if an eval shows lexical + ctags recall failing (it brings an external Voyage
or local-model dependency, so the bar is high).

**Biggest engineering risks:** the Index is real software that must stay in sync; a stale index that is
trusted is worse than none (the same lesson as the Repo Map). Resume correctness is subtle. The embeddings
dependency (no native Anthropic endpoint) is a real external coupling, so defer it.

**Biggest product risks:** overengineering. Prism's value is grounded judgment, not infrastructure. Too many
tiers or labels become noise nobody reads. A heavy harness could make Prism slower and more brittle than the
playbooks it replaces.

**Biggest overengineering traps to refuse:** a vector DB before lexical+symbol is proven insufficient;
trajectory-replay infra when transcripts already exist; a general rules engine when a tiered 50-line guard
works; confidence tiers so granular they are ignored; multi-agent on paths the eval already showed
single-pass wins; a run-log so verbose it costs more to write than it saves.

---

## Net recommendation

Fix the three foundational gaps (team-memory decision, version/drift, concurrency), ship the two cheap
keystones (4-tier evidence + citation enforcement, and the tiered guard), add one `checkpoint.json` for
resume, and lean on ripgrep plus on-demand ctags for retrieval instead of a committed index. Gate
everything behind an expanded eval. That is the MVP. Refuse every committed-artifact feature until a
fixture forces it. Prism is already strong at grounded judgment; production-grade means making that
judgment **observable, resumable, evidence-tiered, and team-safe**, without turning a sharp set of
playbooks into a brittle framework with a database it does not admit it has.

## CHANGELOG (what the critic pass changed)

The first draft proposed a committed symbol/dependency Index as keystone, a 10-file run log, an 8-tier
evidence ladder, a 7-file memory split, and token-budget enforcement. A cross-tier critic pass
(2x opus overengineering + 1x sonnet accuracy) overturned most of it:

- **Killed the committed Index.** Stale-by-default, the project's own worst lesson. Replaced with
  ripgrep + Repo Map + on-demand ephemeral ctags. The dependency graph is cut until a fixture forces it.
- **Run log 10 files to 1.** `tools.json` duplicates the native transcript; `tokens.json` is fiction.
  Kept one `checkpoint.json` for resume.
- **Evidence tiers 8 to 4** (verified / supported / unverified / contradicted).
- **Memory 7 files to 1** with a `## Stale / quarantine` heading; the layers are sections, not files.
- **Budget relabeled** to countable caps; deleted the token-enforcement claim Prism cannot deliver.
- **Five stale `prism-implement.md` citations corrected** (off by ~15 lines), plus the grounding-verifier
  and JUDGE citations. The drift itself is evidence for gap 2 (no self-versioning).
- **Three foundational gaps added** that the feature list missed: team memory (and the real
  OVERVIEW/gitignore contradiction), Prism self-versioning, and concurrent-run memory races.

Open risk not closed: whether `.prism/` should be team-shared is a product call only the human can make,
and it gates Section 6.

## Telemetry
- divergence: 0.85 (evidence 0.95, conclusion 0.60) | threshold 0.30 UNCALIBRATED. This was a
  draft-then-critique fan-out, not competing recommendations; the two critics owned disjoint concerns
  (overengineering vs accuracy) and converged on "less committed infrastructure."
- models: draft=opus · critics=2x-opus+1x-sonnet (cross-tier; version axis unavailable)
- claims: current-state citations corrected to `grounded` after the accuracy critic re-read the files;
  "committed index is net-negative" `cross-tier-survived` (both critics, plus the project's Repo Map lesson)
- fleet: 2 critics (after a single-pass synthesis draft, per the eval's "shrink the default" finding)

> Cross-tier verification reduces instance- and tier-level error correlation but not shared-lineage blind
> spots. Treat cross-tier survival as weaker evidence than grounding.
