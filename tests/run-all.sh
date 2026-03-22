#!/bin/bash
# Run ALL Home Server tests (shortcut for ./tests/run.sh full)
# Usage:
#   ./tests/run-all.sh
#   TEST_URL=http://rpi:5555 ./tests/run-all.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/run.sh" full
