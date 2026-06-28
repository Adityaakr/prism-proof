---
description: Understand/map existing code or a concept — parallel explorers over each subsystem, synthesized into one coherent model with a file map. Read-only, fast.
allowed-tools: Task, Read, Grep, Glob, WebSearch, WebFetch, Write
---
# Fusion · Understand: $ARGUMENTS

You are the ORCHESTRATOR. Map the thing, don't guess. Run parallel explorers, then
synthesize ONE coherent model. Lead with a plain-language explanation.

## Steps
1. SCOPE: break the target into N parts (subsystems / files / concepts). State them in one line.
2. FAN-OUT (parallel, ONE message): launch one explorer subagent per part via Task, each
   with Read/Grep/Glob. Each returns a TIGHT map: what this part does, the key `file:line`
   anchors, and how it connects to the rest. No padding. (Give one agent WebSearch/WebFetch
   if the concept needs current external facts.) Diversity rule: no two explorers cover the
   same ground. Use ~3–6 explorers; scale to system size.
3. JUDGE: read all maps, reconcile overlaps/contradictions, and synthesize ONE model:
   - the end-to-end flow (step by step)
   - the data model / key types
   - the seams where you'd extend or change it
4. COMPLETENESS CRITIC: spawn one agent asking "what's missing, unread, or unexplained
   here?" — fold in what it finds.

## Output
- Lead with a PLAIN-LANGUAGE explanation a newcomer could follow.
- Then a FILE MAP table: area → key `file:line` → purpose.
- Then "where to touch it" for the most likely changes.
- Flag anything you could NOT confirm in the code (don't smooth it over).
- PERSIST only if the user asks: save to `docs/` as a new numbered file, never overwrite.

## Project memory (ALWAYS update — this is what makes fusion compound)
Write/refine `.fusion/project-model.md` at the repo root (create the file + folder if missing).
It is a durable, evidence-cited model of THIS project that every future fusion run reads first.
Sections to maintain:
- **Architecture** — the components and how they connect.
- **Invariants** — the rules the code silently relies on (e.g. "amounts are 6-decimal USDC",
  "approve must precede pay"). Each MUST carry a `file:line` citation.
- **Conventions** — naming, patterns, where things live.
- **Danger zones** — code that's fragile, security-sensitive, or easy to break.
- **Decision log** — links to any `docs/NN-*.md` plans.
- **Lessons** — left for `fusion-retro`; never delete existing ones.
RULE: every line about the code carries a `file:line` citation. Update IN PLACE — append and
refine, never wipe prior content. Stamp the top with today's date + which command updated it.
Tell the user you updated project memory and what changed.
