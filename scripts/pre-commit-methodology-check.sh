#!/bin/bash
# RugMunch Methodology Leak Detection — Pre-Commit Hook
# Blocks commits that contain internal hostnames, IPs, gopass paths, or methodology
# Canonical source: standards/scripts/pre-commit-methodology-check.sh
# Installed per-repo: scripts/pre-commit-methodology-check.sh
#
# DESIGN NOTE: This script defines the forbidden patterns as REGEXES for detection.
# The patterns themselves appear in this file and .gitleaks.toml because those are
# scanner definitions — NOT actual leaks. Both files are excluded from scanning.
# See: .gitleaks.toml allowlist for the gitleaks-side exclusion.

set -euo pipefail

# Files that are explicitly allowed to contain these patterns because they are
# security scanner definitions (the detector, not the detected)
EXEMPT_FILES=(
  "scripts/pre-commit-methodology-check.sh"
  ".gitleaks.toml"
)

# Patterns are assembled from fragments so this public guard never
# enumerates the real internal names it protects (self-leak fix, TOP-100 #11).
_P1=$(printf '%s' "tal" "os"); _P2=$(printf '%s' "hyd" "ra"); _P3=$(printf '%s' "cinna" "box")
FORBIDDEN_PATTERNS=(
  # Internal hostnames (fragment-assembled: <name>.rugmunch.io)
  "\${_P1}\\.rugmunch\\.io"
  "\${_P2}\\.rugmunch\\.io"
  "\${_P3}\\.rugmunch\\.io"
  'ssh netcup'
  'ssh contabo'
  "ssh \${_P1}"
  "ssh \${_P2}"
  "root@\${_P1}"

  # Internal IPs (Tailscale CGNAT range 100.64.0.0/10 — pattern classes)
  '100\.6[4-9]\.'
  '100\.7[0-9]\.'
  '100\.8[0-9]\.'
  '100\.9[0-9]\.'
  '100\.1[01][0-9]\.'

  # Secret management paths
  'gopass show rmi/'
  'gopass.*rmi/'

  # Internal filesystem paths
  '/root/backend/'
  '/root/frontend/'
  '/root/\.hermes/'
  '/srv/work/repos.*\.git'
  '/srv/pryscraper'
  '/srv/walletpress'
  '/srv/data/'
  '/var/www/rmi'

  # Methodology keywords (high-signal — never in public code)
  'proprietary.*algorithm'
  'internal.*methodology'
  'competitor.*analysis.*method'
  'our.*scraping.*target'
  'production.*deploy.*root@'
)

# Check if a file is in the exempt list
is_exempt() {
  local f="$1"
  for exempt in "${EXEMPT_FILES[@]}"; do
    if [ "$f" = "$exempt" ]; then
      return 0
    fi
  done
  return 1
}

FOUND=0
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
  echo "✅ Methodology check: clean (no staged files)"
  exit 0
fi

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  # Check each staged file, excluding exempt scanner definition files
  while IFS= read -r file; do
    if is_exempt "$file"; then
      continue
    fi
    if grep -lq "$pattern" "$file" 2>/dev/null; then
      echo "❌ FORBIDDEN PATTERN: $pattern"
      echo "   Found in: $file"
      FOUND=1
    fi
  done <<< "$STAGED_FILES"
done

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "🚫 COMMIT BLOCKED: Methodology leak detected."
  echo "   These patterns reveal internal infrastructure or methods."
  echo "   See: standards/METHODOLOGY-PROTECTION.md"
  echo ""
  echo "   If this is a false positive, use:"
  echo "   git commit --no-verify  (with Lead approval)"
  exit 1
fi

echo "✅ Methodology check: clean"
exit 0
