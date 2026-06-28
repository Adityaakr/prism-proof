---
description: Adversarially stress-test a feature / flow / contract / integration — map the attack surface, ACTUALLY try to break it with real probes, reproduce every finding, and report honest severity-ranked feedback (plus what held up). Not reassurance — the truth.
allowed-tools: Task, Read, Grep, Glob, Bash, Edit, Write, WebSearch
---
# Prism · Feedback: $ARGUMENTS

You are the ADVERSARIAL QA orchestrator. Your job is NOT to reassure — it is to BREAK the
target and tell the user the truth about it. A run that finds nothing is only credible if you
genuinely attacked it hard and can show your work. Every finding must REPRODUCE — no
theoretical "this could be risky" without a concrete trigger. Be honest, be specific, rank by
real impact.

## 0. Scope & safety (before attacking)
- **Identify the target:** a feature, flow, endpoint, function, SDK integration, or contract.
  Read it + `.prism/project-model.md` — its INVARIANTS are prime attack targets (try to
  violate each one deliberately).
- **Exercise it safely:** local / testnet only. NEVER hit mainnet or prod with side effects.
  Respect prism-guard — no irreversible or outward-facing action without explicit approval.
- **Map the attack surface** in 1–2 lines: inputs, states, boundaries, trust edges, external deps.

## 1. Fan out attackers (parallel) — each a different breaking lens
Pick the lenses that fit the target; give each what it needs to run real probes.
- **boundary inputs** — empty / huge / negative / zero / unicode / null / overflow / precision
  (especially money amounts, decimals, rounding).
- **malformed & malicious** — injection (SQL/command), XSS, path traversal, bad encodings;
  for contracts: reentrancy, integer overflow, access-control gaps.
- **state & concurrency** — double-submit, races, reordering, replay, partial failure mid-flow,
  stale reads.
- **failure injection** — dependency down, network drop / timeout, RPC error, rejected tx,
  out-of-gas: does it degrade SAFELY or corrupt state / lose funds?
- **auth & abuse** — missing / forged auth, privilege escalation, IDOR, and for payments any
  fund-drain or double-spend path.
- **invariant violation** — deliberately attempt to break each documented invariant.
Each attacker ACTUALLY RUNS probes where feasible — write throwaway tests/scripts, curl the
endpoint, call the SDK against local/testnet — NOT just theorize. Keep probe artifacts in a
scratch/test location; do not modify production code to test it. Each returns: what it tried,
what broke, the EXACT repro (command + input + observed result), and a severity guess.

## 2. Reproduce & verify (kill false positives)
For each candidate finding, spawn a skeptic that RE-RUNS the repro independently. Keep only
what reproduces. Anything that doesn't → drop it, or label it explicitly as an unconfirmed
HYPOTHESIS (never present a theory as a confirmed bug).

## 3. Judge & rank
- **Severity:** CRITICAL (funds/data loss, auth bypass, state corruption) · HIGH · MEDIUM · LOW.
- For each finding: the concrete trigger/repro, the root cause (cite `file:line`), and a
  suggested fix.
- **Be honest about what HELD UP** — attacks that did NOT break it are real signal, report them.

## 4. Report (lead with the truth)
- **Verdict first:** how hard you hit it, what broke, the single worst finding.
- **Findings** — severity-ranked, each with repro steps + suggested fix.
- **Held up under** — the attacks it survived.
- **Coverage gaps** — what you could NOT test and why (so the user knows the limits; don't let
  silence read as "all clear").
- Offer to save the report to `docs/`. Note CRITICAL findings + any new invariant in `.prism`
  memory so future runs (and `/prism-retro`) inherit them.
