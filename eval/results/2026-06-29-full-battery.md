# /prism-eval — FULL 12-task battery: fleet vs single-pass

**Date:** 2026-06-29 · **Supersedes** the 4-task pilot (`2026-06-29-pilot.md`), whose 3–0 fleet
lead did NOT survive more data. **Method:** live orchestration this session (~110 sub-agents).
Every number is from an agent actually run; token costs are reported `subagent_tokens`. No
metric estimated or fabricated.

## Protocol
- **Fleet (A):** 6 differential lenses (Opus) → my orchestrator synthesis. Fleet tokens = Σ of the
  6 lens agents (synthesis/judge not counted — symmetric, conservative bias).
- **Single (B):** 1 careful Opus pass, no fan-out.
- **Judge:** 1 blind Sonnet, labels stripped, A/B order alternated, told to ignore length. **No
  position-swap, no dual judge** (a real limitation — see caveats).

## Per-task results
| # | Task | Winner | Fleet tok | Single tok |
|---|------|--------|-----------|-----------|
| 1 | skeptic ratio | **Fleet** | 140,394 | 25,837 |
| 2 | divergence weights | **Fleet** | 148,165 | 29,200 |
| 3 | prune policy | Tie | 131,444 | 28,406 |
| 4 | branch policy | **Fleet** | 125,437 | 26,794 |
| 5 | low-divergence behaviour | **Single** | 124,624 | 26,985 |
| 6 | concern-map invalidation | Tie | 137,312 | 30,265 |
| 7 | rm -rf guard | **Single** | 123,765 | 27,297 |
| 8 | telemetry storage | **Single** | 148,523 | 36,267 |
| 9 | loop convergence | **Single** | 125,478 | 32,037 |
| 10 | monorepo stack | **Single** | 136,933 | 28,698 |
| 11 | eval judge | Tie | 105,159 † | 24,402 |
| 12 | staging probes | Tie | 105,937 ‡ | 24,570 |

† one B11 lens agent ran away to **305,069 tok** (10× peers) — excluded from the sum as an
anomaly; *including* it pushes the overall token multiple from 4.6× to ~5.5×. (A real finding:
fan-out has tail-cost risk.) ‡ B12 ran 5 lenses, not 6 (protocol slip).

## Aggregate (the headline)
- **Record: Fleet 3 wins · Single 5 wins · 4 ties** (n=12).
- **Fleet win-rate (ties = 0.5): 0.42.** **Wilson 95% CI: [0.19, 0.68].** Centered BELOW 0.5;
  interval includes 0.5. The point estimate favours the **single pass**.
- **Token multiple: ~4.6×** (excl. the runaway agent; ~5.5× incl.).

## The one sentence that matters
**Over 12 harness-design tasks a single careful Opus pass beat the 8-lens fleet 5–3 (4 ties) at
~4.6× lower token cost — so on open-ended design questions the fleet does NOT earn its cost, and
the default should shrink.** BUT this result is materially confounded (below), so the honest
verdict is "shrink-leaning, not proven," and the pilot's 3–0 was small-sample noise.

## Why the pilot's fleet lead reversed (the real pattern)
The fleet's 3 wins ALL came from a lens catching a concrete cited defect the single missed
(tasks 1, 2, 4 — including real bugs in prism.md). On the remaining open-design tasks the single
pass's one coherent deep reasoning chain matched or beat 6 fragmented briefs + lossy synthesis —
and twice the SINGLE found the defect the fleet missed (task 7: the live `rm -fr /` guard bypass;
task 9: using divergence to tell real vs lazy convergence). So: **the fleet's edge is concentrated
in grounded defect-finding, not general design quality.**

## Caveats that bound this result (read before trusting it)
1. **Synthesis confound (biggest).** The "fleet answer" was MY inline hand-synthesis of 6 briefs
   under heavy multi-task context load — and it had real defects (task 8 under-represented the
   fleet's majority view; task 10 carried a copy-paste typo). Some single "wins" reflect my
   degraded synthesis, not the fleet method's ceiling. In a real Prism run the synthesis is a
   fresh focused model pass — likely better. **This understates the fleet.**
2. **Domain confound.** All 12 are Prism-internal design questions; most have no hidden planted
   defect. The fleet's measured advantage (pilot) was defect-finding — under-represented here.
   Does not cover codebase-spanning or multi-file tasks where differential context should help most.
3. **Verbosity (per task 11's own finding).** Single passes were often longer/more thorough than
   my terser syntheses; even with "ignore length," any residual length bias favoured the SINGLE.
4. **Judge noise.** Single Sonnet judge, n=1/task, no position-swap, no dual-judge — uncontrolled.
5. **N=12.** CI [0.19, 0.68] is wide.

## Step status
- **Grounding P/R (W3):** 1.00 / 1.00 on the (easy) fixture — RUN (see pilot file).
- **Divergence threshold (calibration):** `UNCALIBRATED` — per-task divergence scores were not
  computed numerically; NOT RUN.
- **Find-the-floor 2/4/8-lens sweep (W6):** NOT RUN as a formal sweep — but the full-battery result
  is already evidence that the 8-lens default doesn't beat single on open design, i.e. it points
  toward shrinking.
- **Decorrelation case (does Sonnet earn its slot):** BLOCKED — fixtures too easy.

## Recommendation
On open-ended design questions, **shrink the default** — an 8-lens fleet at ~5× cost did not beat
one careful pass. RESERVE the fleet for **grounded defect-finding / review** tasks, where the
pilot showed its real edge (a lens catching a cited bug). The highest-value cheap upgrade is to
fix the synthesis step (it was this experiment's bottleneck) and add position-swap + dual-judge
before trusting any future win-rate.
