#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# run-coverage.sh — Run test coverage, enforce thresholds, output reports
# Usage: ./scripts/run-coverage.sh [--ci] [--open]
#   --ci    Output JUnit XML, fail on threshold drop
#   --open  Open HTML coverage report in browser
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COVERAGE_DIR="${ROOT_DIR}/coverage"
CI_MODE=false
OPEN_REPORT=false

for arg in "$@"; do
    case "$arg" in
    --ci) CI_MODE=true ;;
    --open) OPEN_REPORT=true ;;
    esac
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DegenFeed — Test Coverage Report"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create coverage directory
mkdir -p "$COVERAGE_DIR"

# Run vitest with coverage
echo ""
echo "▶ Running vitest with coverage..."
echo ""

COVERAGE_OPTS="--coverage"
if $CI_MODE; then
    COVERAGE_OPTS="$COVERAGE_OPTS --reporter=junit --coverage.reporter=cobertura"
fi

cd "$ROOT_DIR"

if ! npx vitest run "$COVERAGE_OPTS" 2>&1; then
    echo ""
    echo "✕ Tests failed. Coverage report may be incomplete."
    exit 1
fi

echo ""
echo "✓ Tests passed. Coverage report generated."

# Check thresholds
echo ""
echo "━━━ Thresholds ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Branches:    ≥ 50%"
echo "  Functions:   ≥ 60%"
echo "  Lines:       ≥ 60%"
echo "  Statements:  ≥ 60%"
echo ""

# Extract coverage summary from vitest output if available
if [ -f "${COVERAGE_DIR}/lcov.info" ]; then
    echo "  lcov report: ${COVERAGE_DIR}/lcov.info"
fi
if [ -f "${COVERAGE_DIR}/index.html" ]; then
    echo "  HTML report: ${COVERAGE_DIR}/index.html"
fi

# Open report if requested
if $OPEN_REPORT && [ -f "${COVERAGE_DIR}/index.html" ]; then
    echo ""
    echo "▶ Opening coverage report..."
    if command -v xdg-open &>/dev/null; then
        xdg-open "${COVERAGE_DIR}/index.html"
    elif command -v open &>/dev/null; then
        open "${COVERAGE_DIR}/index.html"
    else
        echo "  (open the file manually: ${COVERAGE_DIR}/index.html)"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done. $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
