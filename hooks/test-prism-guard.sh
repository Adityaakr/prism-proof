#!/usr/bin/env bash
# test-prism-guard.sh — behavior tests for prism-guard.sh (the done-signal for the v2 rewrite).
# Each case: <expected exit> <::> <command>. 0 = allowed, 2 = blocked.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
guard="$here/prism-guard.sh"

run() { # command -> exit code, feeding the PreToolUse JSON the hook expects
  python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command":sys.argv[1]}}))' "$1" \
    | bash "$guard" >/dev/null 2>&1
  echo $?
}

pass=0; fail=0
check() {
  local want="$1" cmd="$2"
  local got; got=$(run "$cmd")
  if [ "$got" = "$want" ]; then
    pass=$((pass+1)); printf '  ok   [want %s] %s\n' "$want" "$cmd"
  else
    fail=$((fail+1)); printf '  FAIL [want %s got %s] %s\n' "$want" "$got" "$cmd"
  fi
}

echo "ALLOW (exit 0): reversible commands"
check 0 'npm install'
check 0 'rm -rf node_modules'
check 0 'rm -rf dist build'
check 0 'rm -rf .next/cache'
check 0 'rm -rf coverage'
check 0 'git commit -m "wip"'
check 0 'rm -rf / # PRISM_OK'

echo "BLOCK (exit 2): one-way doors"
check 2 'git push origin main'
check 2 'git push --force'
check 2 'npm publish'
check 2 'forge script Deploy.s.sol --broadcast'
check 2 'cast send 0xabc --value 1'
check 2 'git reset --hard HEAD~3'
check 2 'supabase db push'

echo "BLOCK (exit 2): dangerous deletes"
check 2 'rm -rf /'
check 2 'rm -rf ~'
check 2 'rm -rf $HOME'
check 2 'rm -rf *'
check 2 'rm -rf .'
check 2 'rm -rf ..'
check 2 'rm -rf /usr/local/bin'
check 2 'rm -rf --no-preserve-root /'

echo
echo "result: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
