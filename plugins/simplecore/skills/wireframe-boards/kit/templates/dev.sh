#!/usr/bin/env bash
# The board's development server. Builds once, rebuilds on every change to a screen, and serves
# the result at an address a browser can open.
#
#   ./dev.sh                  http://127.0.0.1:4173/
#   ./dev.sh --port 5000      another port, when that one is taken
#   ./dev.sh --open           open the browser as well
#   ./dev.sh --host 0.0.0.0   reachable from another machine on this network
#
# Everything after the name is handed to `wf.mjs serve` unchanged, and **no logic is added here**
# for the reason `wf.mjs` carries none: a board that grows its own tooling has to be migrated by
# hand every time the kit moves.
set -euo pipefail
exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wf.mjs" serve "$@"
