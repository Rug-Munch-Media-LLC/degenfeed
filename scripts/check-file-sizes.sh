#!/bin/bash
# ─── File size pre-commit check ─────────────────────────────────────────
# Warns when staged source files exceed 2000 lines.
# Non-blocking — surfaces large-file debt without blocking commits.

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

THRESHOLD=2000
FOUND=0

# Get staged source files
STAGED=$(git diff --cached --name-only --diff-filter=ACM \
    -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.json' '*.css' 2>/dev/null || true)

if [ -z "$STAGED" ]; then
    exit 0
fi

while IFS= read -r file; do
    if [ ! -f "$file" ]; then
        continue
    fi
    LINES=$(wc -l <"$file")
    if [ "$LINES" -gt "$THRESHOLD" ]; then
        if [ "$FOUND" -eq 0 ]; then
            echo -e "${YELLOW}[check-file-sizes] Files exceeding ${THRESHOLD} lines:${NC}"
        fi
        echo -e "  ${RED}$file${NC}: ${LINES} lines"
        FOUND=$((FOUND + 1))
    fi
done <<<"$STAGED"

if [ "$FOUND" -gt 0 ]; then
    echo -e "${YELLOW}[check-file-sizes] $FOUND file(s) exceed ${THRESHOLD} lines. Consider splitting.${NC}"
fi

exit 0
