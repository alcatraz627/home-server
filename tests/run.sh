#!/bin/bash
# Home Server Test Runner
# Usage:
#   ./tests/run.sh              # Run basic smoke tests only
#   ./tests/run.sh full         # Run all tests (basic + comprehensive)
#   ./tests/run.sh api          # Run only API tests
#   ./tests/run.sh integration  # Run only integration tests
#   ./tests/run.sh platform     # Run only platform-specific tests
#   ./tests/run.sh files        # Run tests for a specific module
#   TEST_URL=http://pi:5555 ./tests/run.sh  # Test against remote server

set -euo pipefail

BASE_URL="${TEST_URL:-http://localhost:5555}"
MODE="${1:-basic}"
PASS=0
FAIL=0
SKIP=0
ERRORS=""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Home Server Test Runner${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  Server:  ${BASE_URL}"
echo -e "  Mode:    ${MODE}"
echo -e "  Time:    $(date)"
echo -e "${CYAN}───────────────────────────────────────────────────${NC}"
echo ""

# Check server is running
if ! curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/system" | grep -q "200"; then
  echo -e "${RED}ERROR: Server not responding at ${BASE_URL}${NC}"
  echo "Start the server first: npm run dev"
  exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

run_test() {
  local file="$1"
  local name=$(basename "$file" .test.ts)
  printf "  %-30s " "$name"

  if TEST_URL="$BASE_URL" npx tsx "$file" > /tmp/hs-test-output-$$.txt 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASS++))
  else
    local exit_code=$?
    if grep -q "SKIP" /tmp/hs-test-output-$$.txt 2>/dev/null; then
      echo -e "${YELLOW}SKIP${NC}"
      ((SKIP++))
    else
      echo -e "${RED}FAIL${NC}"
      ((FAIL++))
      ERRORS="$ERRORS\n  ${RED}✗ $name${NC}: $(tail -3 /tmp/hs-test-output-$$.txt 2>/dev/null | tr '\n' ' ')"
    fi
  fi
  rm -f /tmp/hs-test-output-$$.txt
}

# ── Basic Tests (smoke tests — fast, non-destructive) ──────────────────────
BASIC_TESTS=(
  "tests/api/system.test.ts"
  "tests/api/processes.test.ts"
  "tests/api/browse.test.ts"
  "tests/api/tailscale.test.ts"
  "tests/api/wifi.test.ts"
  "tests/api/peripherals.test.ts"
  "tests/api/apps.test.ts"
  "tests/api/speedtest.test.ts"
  "tests/api/health.test.ts"
  "tests/api/status.test.ts"
  "tests/api/databases.test.ts"
  "tests/api/docker.test.ts"
)

# ── Comprehensive Tests (CRUD, destructive, slow) ──────────────────────────
COMPREHENSIVE_TESTS=(
  "tests/api/files.test.ts"
  "tests/api/tasks.test.ts"
  "tests/api/backups.test.ts"
  "tests/api/keeper.test.ts"
  "tests/api/bookmarks.test.ts"
  "tests/api/kanban.test.ts"
  "tests/api/wol.test.ts"
  "tests/api/dns.test.ts"
  "tests/api/dns-trace.test.ts"
  "tests/api/clipboard.test.ts"
  "tests/api/benchmarks.test.ts"
  "tests/api/screenshots.test.ts"
  "tests/api/notes.test.ts"
  "tests/api/notifications.test.ts"
  "tests/api/services.test.ts"
  "tests/api/logs.test.ts"
  "tests/api/network.test.ts"
  "tests/api/ports.test.ts"
  "tests/api/audit.test.ts"
  "tests/api/terminal-pin.test.ts"
)

# ── Integration Tests ──────────────────────────────────────────────────────
INTEGRATION_TESTS=(
  "tests/integration/terminal.test.ts"
  "tests/integration/file-stream.test.ts"
  "tests/integration/lights.test.ts"
  "tests/integration/pages.test.ts"
)

# ── Platform Tests ─────────────────────────────────────────────────────────
PLATFORM_TESTS=(
  "tests/platform/macos.test.ts"
  "tests/platform/linux.test.ts"
)

run_group() {
  local label="$1"
  shift
  local tests=("$@")

  echo -e "${CYAN}── $label ──${NC}"
  for test in "${tests[@]}"; do
    if [ -f "$test" ]; then
      run_test "$test"
    fi
  done
  echo ""
}

case "$MODE" in
  basic)
    run_group "Basic (Smoke Tests)" "${BASIC_TESTS[@]}"
    ;;
  full)
    run_group "Basic (Smoke Tests)" "${BASIC_TESTS[@]}"
    run_group "Comprehensive (CRUD)" "${COMPREHENSIVE_TESTS[@]}"
    run_group "Integration" "${INTEGRATION_TESTS[@]}"
    run_group "Platform" "${PLATFORM_TESTS[@]}"
    ;;
  api)
    run_group "All API Tests" "${BASIC_TESTS[@]}" "${COMPREHENSIVE_TESTS[@]}"
    ;;
  integration)
    run_group "Integration Tests" "${INTEGRATION_TESTS[@]}"
    ;;
  platform)
    run_group "Platform Tests" "${PLATFORM_TESTS[@]}"
    ;;
  *)
    # Specific module: run tests matching the name
    found=0
    for test in tests/api/*.test.ts tests/integration/*.test.ts tests/platform/*.test.ts; do
      if [ -f "$test" ] && echo "$test" | grep -qi "$MODE"; then
        run_test "$test"
        found=1
      fi
    done
    if [ "$found" -eq 0 ]; then
      echo -e "${RED}No tests found matching '$MODE'${NC}"
      echo "Available: basic, full, api, integration, platform, or a module name"
      exit 1
    fi
    echo ""
    ;;
esac

# ── Summary ────────────────────────────────────────────────────────────────
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed: $PASS${NC}  ${RED}Failed: $FAIL${NC}  ${YELLOW}Skipped: $SKIP${NC}"
if [ -n "$ERRORS" ]; then
  echo -e "\n  Failures:"
  echo -e "$ERRORS"
fi
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"

exit $FAIL
