---
description: Close the loop — compare what a fusion plan PREDICTED against what actually shipped, then write the lessons back into project memory so future runs are smarter. This is what makes fusion learn.
allowed-tools: Task, Read, Grep, Glob, Bash, Write
---
# Fusion · Retro: $ARGUMENTS

You are the ORCHESTRATOR running a post-implementation retrospective. The point is not to
re-plan — it's to find the GAP between what fusion predicted and what reality did, and bank
the lesson so the next plan starts smarter. Be honest; a retro that finds nothing wrong is
usually a retro that didn't look hard enough.

## Inputs
- Which plan to review: a `docs/NN-*.md` plan and/or the relevant Decision-log entry in
  `.fusion/project-model.md`. If the user named one, use it; otherwise pick the most recent
  plan and confirm.
- What actually happened: the real diff/code. Use git (`Bash`: `git log`, `git diff`) and
  Read/Grep the implementation that shipped.

## Steps
1. **Extract predictions.** From the plan, pull its explicit claims: the recommendation, the
   assumptions, the falsifiers ("what would change the answer"), the predicted risks, and the
   open questions it left for the human.
2. **Observe reality (parallel).** FAN-OUT agents to gather what actually shipped: the code
   that got written (`file:line`), what diverged from the plan, what broke or had to be
   reworked, and whether any falsifier actually triggered.
3. **Judge the gap.** For each prediction, mark: CONFIRMED (predicted right), MISSED (a
   problem the plan didn't foresee), or WRONG (the plan asserted something reality disproved).
   For every MISSED/WRONG, find the ROOT CAUSE — which lens should have caught it? what
   assumption was unsafe? was an invariant violated?
4. **Bank the lessons.** Append to the **Lessons** section of `.fusion/project-model.md`
   (create if missing), dated. Each lesson: what we predicted, what happened, the root cause,
   and the CONCRETE adjustment for next time (e.g. "always run the regulatory lens on payout
   flows", "invariant: settlement is idempotent — `Settle.sol:88`"). Also correct any now-false
   invariant or danger-zone note in memory.

## Output
- A short scorecard: N predictions → X confirmed / Y missed / Z wrong.
- The 2–3 highest-value lessons, plainly stated.
- Exactly what changed in `.fusion/project-model.md` (so the next run inherits it).
- If the plan held up well, say so — that's a real signal the process is calibrated.
