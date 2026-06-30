#!/usr/bin/env bash
# prism-guard.sh — Claude Code PreToolUse hook (matcher: Bash). v2, risk-tiered.
#
# ENFORCES the "stop at one-way doors" guard that /prism-implement only *promises*
# to follow. The model cannot bypass this; it runs before the Bash tool executes.
#
# v2 classifies a command by REVERSIBILITY instead of a flat allow/deny list:
#   RED    one-way door (deploy, publish, force-push, push-to-main, db migrate,
#          mainnet tx, destructive git, dangerous recursive delete) -> BLOCK (exit 2)
#   YELLOW reversible but worth a nudge (commit on main/master) -> WARN, still allow
#   GREEN  everything else, including reversible deletes of ephemeral build dirs
#          (node_modules, dist, build, .next, target, ...) -> allow silently
#
# This fixes two v1 problems: it no longer blocks `rm -rf node_modules` (a common,
# reversible command), and it nudges `git commit` on main toward branch-before-code.
#
# Override: append  # PRISM_OK  to the command (explicit user approval).
# Exit 0 = allow.  Exit 2 = block (stderr is shown to the model so it asks the user).
#
# Wire it up in settings.json:
#   "hooks": { "PreToolUse": [ { "matcher": "Bash",
#     "hooks": [ { "type": "command", "command": "bash ~/.claude/hooks/prism-guard.sh" } ] } ] }

set -uo pipefail
input=$(cat)

cmd=$(printf '%s' "$input" | python3 -c 'import sys,json
try:
    d=json.load(sys.stdin); print(d.get("tool_input",{}).get("command",""))
except Exception:
    print("")' 2>/dev/null || true)

[ -z "$cmd" ] && exit 0

# Explicit, user-granted override escape hatch.
case "$cmd" in *PRISM_OK*) exit 0 ;; esac

block() {
  {
    echo "prism-guard BLOCKED a one-way-door command:"
    echo "    $cmd"
    echo
    echo "$1"
    echo
    echo "Per the prism harness you must confirm with the USER before running it."
    echo "If the user explicitly approves, re-issue with a trailing approval token:"
    echo "    $cmd   # PRISM_OK"
  } >&2
  exit 2
}

# --- RED: irreversible or outward-facing one-way doors ---
red='git push[^|]*(--force|-f( |$)|\+)|git push[^|]*( origin)? (main|master)( |$)|npm publish|yarn publish|pnpm publish|vercel[^|]*--prod|netlify deploy[^|]*--prod|gh release create|gh repo delete|supabase db push|supabase db reset|prisma migrate deploy|prisma migrate reset|drizzle-kit push|forge create|forge script[^|]*--broadcast|cast send|git reset --hard|git clean -[a-z]*f|drop +(table|database)|truncate +table'
if printf '%s' "$cmd" | grep -iEq "$red"; then
  block "This is irreversible or outward-facing (deploy / publish / force-push / push-to-main / db migration / mainnet tx / destructive git)."
fi

# --- RED: dangerous recursive deletes (root, home, parent, wildcard, absolute) ---
# A recursive rm whose target is /, an absolute system path, ~, $HOME, *, ., or .. is a one-way
# door. A recursive rm of a RELATIVE name (node_modules, dist, build/foo) is reversible -> allowed.
if printf '%s' "$cmd" | grep -iEq 'rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*[[:space:]]'; then
  case "$cmd" in *"--no-preserve-root"*) block "This rm uses --no-preserve-root." ;; esac
  if printf '%s' "$cmd" | grep -iEq 'rm[[:space:]]+(-[a-zA-Z]+[[:space:]]+)*((\*|\.|\.\.|~|\$HOME|\$\{HOME\})([[:space:]]|$)|(~|\$HOME|\$\{HOME\})/|/)'; then
    block "This rm -rf targets a dangerous path (root, an absolute path, home, parent, wildcard, or the current dir). Reversible deletes of named project dirs (node_modules, dist, ...) are allowed."
  fi
fi

# --- YELLOW: reversible but worth a nudge (do NOT block) ---
if printf '%s' "$cmd" | grep -iEq '(^|[[:space:]&;])git[[:space:]]+commit'; then
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  case "$branch" in
    main|master)
      echo "prism-guard: committing on '$branch'. Prism's default is branch-before-code; consider a feature branch (this is a nudge, not a block)." >&2
      ;;
  esac
fi

exit 0
