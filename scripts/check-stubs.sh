#!/usr/bin/env bash
# ── Stub Detection Quality Gate ───────────────────────────────────────
# Greps for TODO, FIXME, "placeholder", "coming soon", "not yet implemented"
# in .ts and .tsx source files (excluding test files).
# Exits non-zero if any stubs found.
# Usage: bash scripts/check-stubs.sh
# ───────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Patterns to detect — these indicate incomplete/stub code
PATTERNS=(
    "TODO"
    "FIXME"
    "placeholder"
    "coming soon"
    "not yet implemented"
)

# Build the grep pattern (case-insensitive)
GREP_PATTERN=""
for pattern in "${PATTERNS[@]}"; do
    if [ -n "$GREP_PATTERN" ]; then
        GREP_PATTERN="$GREP_PATTERN|"
    fi
    GREP_PATTERN="${GREP_PATTERN}$pattern"
done

# Directories to scan (same as file-size check + packages for thoroughness)
DIRS=(
    "workers/api/src"
    "apps/web/src"
    "packages"
)

violations=0
results_file=$(mktemp)

for dir in "${DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        continue
    fi

    # Search .ts/.tsx files, exclude test/spec files
    find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' \) \
        ! -name '*.test.*' \
        ! -name '*.spec.*' \
        -print0 2>/dev/null | xargs -0 grep -inEI "$GREP_PATTERN" \
        -l 2>/dev/null >>"$results_file" || true
done

if [ -s "$results_file" ]; then
    echo -e "${RED}❌ Stubs/TODOs detected in the following files:${NC}"
    echo ""
    # Sort and deduplicate (use process substitution to avoid subshell)
    while IFS= read -r file; do
        # Show the actual offending lines with line numbers
        while IFS= read -r line; do
            rel_path="${file#"$PWD"/}"
            echo -e "${YELLOW}  ${rel_path}:${line}${NC}"
        done < <(grep -inEI "$GREP_PATTERN" "$file")
        violations=$((violations + 1))
    done < <(sort -u "$results_file")
fi

rm -f "$results_file"

if [ "$violations" -gt 0 ]; then
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  STUBS DETECTED: ${violations} file(s) contain incomplete code  ${NC}"
    echo -e "${RED}  Resolve all TODOs, FIXMEs, and placeholders before   ${NC}"
    echo -e "${RED}  committing.                                         ${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Stub check passed — no TODOs, FIXMEs, or placeholders found${NC}"
fi
