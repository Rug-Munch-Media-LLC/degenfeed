#!/bin/bash
# ─── Stub / placeholder check — pre-commit guard ────────────────────────
# Warns about TODO/FIXME/HACK/XXX markers in staged files.
# Non-blocking — allows commit but surfaces tech debt.

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get staged files that match our source extensions
STAGED=$(git diff --cached --name-only --diff-filter=ACM \
    -- '*.ts' '*.tsx' '*.js' '*.jsx' 2>/dev/null || true)

if [ -z "$STAGED" ]; then
    exit 0
fi

# Check for stub/placeholder markers
FOUND=0
while IFS= read -r file; do
    if [ ! -f "$file" ]; then
        continue
    fi
    MATCHES=$(grep -n 'TODO\|FIXME\|HACK\|XXX' "$file" 2>/dev/null || true)
    if [ -n "$MATCHES" ]; then
        if [ "$FOUND" -eq 0 ]; then
            echo -e "${YELLOW}[check-stubs] WARNING: Stub markers found (non-blocking):${NC}"
        fi
        echo "$MATCHES" | while IFS= read -r line; do
            echo -e "  ${RED}$file${NC}: $line"
        done
        FOUND=$((FOUND + 1))
    fi
done <<<"$STAGED"

if [ "$FOUND" -gt 0 ]; then
    echo -e "${YELLOW}[check-stubs] $FOUND file(s) with stub markers. Review before shipping.${NC}"
fi

exit 0
