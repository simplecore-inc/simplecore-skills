#!/usr/bin/env bash
# Run every Python test suite the simplecore plugin ships, each from the
# working directory its imports expect, and print one count line per suite.
# Exit status is non-zero when any suite fails or cannot be run.
#
# The Node suites run on their own, from the repository root:
#   node plugins/simplecore/skills/board-to-app/scripts/bta.mjs gates
#   node plugins/simplecore/skills/korean-docs/scripts/l10n.mjs rules --test
# and the wireframe kit's `node wf.mjs gates` runs from a board folder (README, Development).
#
#   plugins/simplecore/scripts/test.sh          # every suite
#   plugins/simplecore/scripts/test.sh -v       # also print each suite's full output
set -u

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
plugin="$(dirname "$here")"
verbose=0
[ "${1:-}" = "-v" ] && verbose=1

# name | directory to run from | discover arguments
suites=(
  "bidkit|$plugin/scripts|-s bidkit/tests -t ."
  "slide-decks checks|$plugin/skills/slide-decks/scripts/checks/tests|-s ."
  "proposal-writing|$plugin/skills/proposal-writing/scripts/tests|-s ."
  "svg-diagrams docfigures|$plugin/skills/svg-diagrams/scripts/docfigures/tests|-s ."
)

failed=0
for entry in "${suites[@]}"; do
  IFS='|' read -r name dir discover <<<"$entry"
  if [ ! -d "$dir" ]; then
    printf '✖ %-24s directory missing: %s\n' "$name" "$dir"
    failed=1
    continue
  fi
  start=$(date +%s)
  # shellcheck disable=SC2086
  out="$(cd "$dir" && python3 -m unittest discover $discover 2>&1)"
  status=$?
  secs=$(( $(date +%s) - start ))
  ran="$(printf '%s\n' "$out" | sed -n 's/^Ran \([0-9]*\) tests\{0,1\}.*/\1/p' | tail -1)"
  verdict="$(printf '%s\n' "$out" | grep -E '^(OK|FAILED)' | tail -1)"
  if [ "$status" -eq 0 ] && [ -n "$ran" ] && [ "$ran" -gt 0 ]; then
    mark='✔'
  else
    mark='✖'
    failed=1
  fi
  printf '%s %-24s ran %s · %s · %ss\n' "$mark" "$name" "${ran:-0}" "${verdict:-no result (exit $status)}" "$secs"
  if [ "$verbose" -eq 1 ] || [ "$mark" = '✖' ]; then
    printf '%s\n' "$out" | sed 's/^/    /'
  fi
done

exit "$failed"
