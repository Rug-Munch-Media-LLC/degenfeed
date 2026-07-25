#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# security-scan.sh — Security scanning for DegenFeed
#
# Runs: gitleaks, npm audit, env exposure check, file permission audit
# Usage: ./scripts/security-scan.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXIT_CODE=0
REPORT="${ROOT_DIR}/security-scan-report.txt"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee "$REPORT"
echo "  DegenFeed — Security Scan" | tee -a "$REPORT"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')" | tee -a "$REPORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$REPORT"

# ── 1. Gitleaks ──────────────────────────────────────────────────────────
echo "" | tee -a "$REPORT"
echo "▶ 1/4: Gitleaks secret scan..." | tee -a "$REPORT"
if command -v gitleaks &>/dev/null; then
    cd "$ROOT_DIR"
    if gitleaks detect --no-git --source . -v 2>&1 | tee -a "$REPORT"; then
        echo "  ✓ No secrets detected" | tee -a "$REPORT"
    else
        echo "  ✕ Secrets detected! Review findings above." | tee -a "$REPORT"
        EXIT_CODE=1
    fi
else
    echo "  ⚠ gitleaks not installed. Skipping." | tee -a "$REPORT"
fi

# ── 2. npm audit ─────────────────────────────────────────────────────────
echo "" | tee -a "$REPORT"
echo "▶ 2/4: npm audit..." | tee -a "$REPORT"
cd "$ROOT_DIR"
if npm audit 2>&1 | tail -20 | tee -a "$REPORT"; then
    echo "  ✓ No vulnerabilities found" | tee -a "$REPORT"
else
    echo "  ⚠ Vulnerabilities found (review above)" | tee -a "$REPORT"
fi

# ── 3. .env file exposure ───────────────────────────────────────────────
echo "" | tee -a "$REPORT"
echo "▶ 3/4: .env file exposure check..." | tee -a "$REPORT"
FOUND_ENV=0
while IFS= read -r -d '' envfile; do
    if git check-ignore "$envfile" &>/dev/null; then
        echo "  ✓ Gitignored: $envfile" | tee -a "$REPORT"
    else
        echo "  ✕ NOT gitignored: $envfile" | tee -a "$REPORT"
        FOUND_ENV=1
    fi
done < <(find "$ROOT_DIR" -name ".env*" -not -path "*/node_modules/*" -print0 2>/dev/null || true)

if [ "$FOUND_ENV" -eq 0 ]; then
    echo "  ✓ All .env files properly gitignored" | tee -a "$REPORT"
else
    echo "  ✕ Some .env files are exposed!" | tee -a "$REPORT"
    EXIT_CODE=1
fi

# ── 4. File permission audit ────────────────────────────────────────────
echo "" | tee -a "$REPORT"
echo "▶ 4/4: File permission audit..." | tee -a "$REPORT"
SUSPICIOUS=0
while IFS= read -r -d '' file; do
    perms=$(stat -f "%Lp" "$file" 2>/dev/null || stat -c "%a" "$file" 2>/dev/null || echo "000")
    if [ "$perms" != "000" ] && [ "${perms#0}" -gt 755 ] 2>/dev/null; then
        echo "  ⚠ World-writable: $file ($perms)" | tee -a "$REPORT"
        SUSPICIOUS=1
    fi
done < <(find "$ROOT_DIR" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -name "*.sh" -print0 2>/dev/null | head -200 || true)

if [ "$SUSPICIOUS" -eq 0 ]; then
    echo "  ✓ File permissions look normal" | tee -a "$REPORT"
fi

# ── Summary ──────────────────────────────────────────────────────────────
echo "" | tee -a "$REPORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$REPORT"
if [ "$EXIT_CODE" -eq 0 ]; then
    echo "  ✓ Security scan passed" | tee -a "$REPORT"
else
    echo "  ✕ Security scan found issues" | tee -a "$REPORT"
fi
echo "  Report: $REPORT" | tee -a "$REPORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$REPORT"

exit "$EXIT_CODE"
