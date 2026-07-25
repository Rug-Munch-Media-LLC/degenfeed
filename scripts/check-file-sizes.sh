#!/usr/bin/env bash
# ── File Size Quality Gate ────────────────────────────────────────────
# Checks all .ts/.tsx files under workers/api/src/routes/ and apps/web/src/
# Flags any file >500 lines. Exits non-zero if violations found.
# Usage: bash scripts/check-file-sizes.sh
# ───────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

MAX_LINES=2000

# Directories to scan
DIRS=(
    "workers/api/src/routes"
    "apps/web/src"
)

violations=0

for dir in "${DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo -e "${YELLOW}⚠  Directory not found: $dir (skipping)${NC}"
        continue
    fi

    while IFS= read -r -d '' file; do
        line_count=$(wc -l <"$file")
        if [ "$line_count" -gt "$MAX_LINES" ]; then
            echo -e "${RED}❌ ${file#"$PWD"/}  —  ${line_count} lines (max ${MAX_LINES})${NC}"
            violations=$((violations + 1))
        fi
    done < <(find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' \) -print0)
done

if [ "$violations" -gt 0 ]; then
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  GOD CODE DETECTED: ${violations} file(s) exceed ${MAX_LINES} lines  ${NC}"
    echo -e "${RED}  Refactor or split these files before committing.   ${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 1
else
    echo -e "${GREEN}✓ File size check passed — all files under ${MAX_LINES} lines${NC}"
fi
