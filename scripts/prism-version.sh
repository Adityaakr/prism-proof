#!/usr/bin/env bash
# prism-version.sh — report the Prism version and detect drift between an installed copy and source.
#
# Prism's commands are COPIED into ~/.claude/commands (or a repo's .claude/commands), so a copy can
# drift from the source repo with no signal. This is the drift signal. It compares by content (cmp),
# which catches any edit, not just a version-string mismatch.
#
#   bash scripts/prism-version.sh                 # print version
#   bash scripts/prism-version.sh --check [dir]   # compare source commands to an install dir
#                                                 # (default: ~/.claude/commands)

set -uo pipefail
repo="$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
version="$(cat "$repo/VERSION" 2>/dev/null || echo unknown)"

case "${1:-}" in
  ""|--version)
    echo "prism $version"
    ;;
  --check)
    dir="${2:-$HOME/.claude/commands}"
    echo "prism $version - drift check against: $dir"
    if [ ! -d "$dir" ]; then
      echo "  install dir not found (nothing installed there): $dir"
      exit 0
    fi
    drift=0; checked=0
    for f in "$repo"/commands/*.md; do
      [ -e "$f" ] || continue
      name="$(basename "$f")"; inst="$dir/$name"; checked=$((checked + 1))
      if [ ! -f "$inst" ]; then
        echo "  MISSING: $name (in source, not installed)"; drift=$((drift + 1)); continue
      fi
      cmp -s "$f" "$inst" || { echo "  DRIFTED: $name (installed copy differs from source)"; drift=$((drift + 1)); }
    done
    for inst in "$dir"/prism*.md; do
      [ -e "$inst" ] || continue
      name="$(basename "$inst")"
      [ -f "$repo/commands/$name" ] || { echo "  STALE: $name (installed, removed from source)"; drift=$((drift + 1)); }
    done
    echo "  checked $checked source commands; $drift drift issue(s)."
    [ "$drift" -eq 0 ] && echo "  in sync"
    ;;
  *)
    echo "usage: prism-version.sh [--version | --check [install-dir]]" >&2
    exit 2
    ;;
esac
