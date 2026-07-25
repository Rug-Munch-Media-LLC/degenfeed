#!/bin/bash
# check-deps.sh — Dependency Health Monitor
#
# Scans the monorepo for dependency health issues:
#   1. Checks `pnpm outdated` for upgradable packages
#   2. Checks `pnpm audit` for vulnerabilities
#   3. Compares versions against latest npm releases
#   4. Flags packages with major version bumps available
#   5. Flags EOL packages (Node.js, etc.)
#   6. Outputs a health score 0–100
#   7. Writes JSON report to dependency-report.json
#
# Usage: bash scripts/check-deps.sh
# Output: dependency-report.json + human-readable summary

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
export REPORT_FILE="${REPO_DIR}/dependency-report.json"
TMPDIR="$(mktemp -d)"
export TMPDIR
trap 'rm -rf "$TMPDIR"' EXIT

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo "=============================================="
echo "  DegenFeed — Dependency Health Check"
echo "  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "=============================================="
echo ""

# ─── Helper: fetch latest version from npm ────────────────────────────────
fetch_latest_version() {
    local pkg="$1"
    curl -s "https://registry.npmjs.org/${pkg}/latest" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','unknown'))" 2>/dev/null || echo "unknown"
}

# ─── Helper: semver comparison (returns "major" | "minor" | "patch" | "none") ─
semver_diff() {
    local current="$1"
    local latest="$2"

    # Strip leading ^ ~
    current="${current#^}"
    current="${current#~}"
    current="${current#>=}"

    # Parse semver
    local c_major c_minor c_patch l_major l_minor l_patch
    c_major="$(echo "$current" | cut -d. -f1 | sed 's/[^0-9]*//g')"
    c_minor="$(echo "$current" | cut -d. -f2 | sed 's/[^0-9]*//g')"
    c_patch="$(echo "$current" | cut -d. -f3 | sed 's/[^0-9]*//g')"
    l_major="$(echo "$latest" | cut -d. -f1 | sed 's/[^0-9]*//g')"
    l_minor="$(echo "$latest" | cut -d. -f2 | sed 's/[^0-9]*//g')"
    l_patch="$(echo "$latest" | cut -d. -f3 | sed 's/[^0-9]*//g')"

    [[ -z "$c_major" ]] && c_major=0
    [[ -z "$c_minor" ]] && c_minor=0
    [[ -z "$c_patch" ]] && c_patch=0
    [[ -z "$l_major" ]] && l_major=0
    [[ -z "$l_minor" ]] && l_minor=0
    [[ -z "$l_patch" ]] && l_patch=0

    if [[ "$l_major" -gt "$c_major" ]]; then
        echo "major"
        return
    fi
    if [[ "$l_minor" -gt "$c_minor" ]]; then
        echo "minor"
        return
    fi
    if [[ "$l_patch" -gt "$c_patch" ]]; then
        echo "patch"
        return
    fi
    echo "none"
}

# ─── Step 1: pnpm outdated ────────────────────────────────────────────────
echo -e "${CYAN}[1/6] Checking pnpm outdated...${NC}"

cd "$REPO_DIR"
OUTDATED_JSON="$TMPDIR/outdated.json"
pnpm outdated --format=json 2>/dev/null >"$OUTDATED_JSON" || true

OUTDATED_COUNT=0
OUTDATED_PKGS=()
if [[ -s "$OUTDATED_JSON" ]]; then
    # Parse JSON output
    while IFS=$'\t' read -r pkg current wanted latest; do
        [[ -z "$pkg" ]] && continue
        OUTDATED_COUNT=$((OUTDATED_COUNT + 1))
        OUTDATED_PKGS+=("{\"package\":\"$pkg\",\"current\":\"$current\",\"wanted\":\"$wanted\",\"latest\":\"$latest\"}")
        echo -e "  ${YELLOW}$pkg${NC}: $current → $latest"
    done < <(python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for pkg, info in data.items():
        print(f'{pkg}\t{info.get(\"current\",\"?\")}\t{info.get(\"wanted\",\"?\")}\t{info.get(\"latest\",\"?\")}')
except:
    pass
" <"$OUTDATED_JSON" 2>/dev/null || true)
fi

if [[ "$OUTDATED_COUNT" -eq 0 ]]; then
    echo -e "  ${GREEN}All packages up to date.${NC}"
fi
echo ""

# ─── Step 2: pnpm audit ───────────────────────────────────────────────────
echo -e "${CYAN}[2/6] Running pnpm audit...${NC}"

AUDIT_JSON="$TMPDIR/audit.json"
pnpm audit --json 2>/dev/null >"$AUDIT_JSON" || true

VULN_CRITICAL=0
VULN_HIGH=0
VULN_MODERATE=0
VULN_LOW=0
VULN_INFO=0
VULN_TOTAL=0

if [[ -s "$AUDIT_JSON" ]]; then
    VULN_CRITICAL=$(python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    m=d.get('metadata',d).get('vulnerabilities',{})
    print(m.get('critical',0))
except: print(0)
" <"$AUDIT_JSON" 2>/dev/null || echo 0)

    VULN_HIGH=$(python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    m=d.get('metadata',d).get('vulnerabilities',{})
    print(m.get('high',0))
except: print(0)
" <"$AUDIT_JSON" 2>/dev/null || echo 0)

    VULN_MODERATE=$(python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    m=d.get('metadata',d).get('vulnerabilities',{})
    print(m.get('moderate',0))
except: print(0)
" <"$AUDIT_JSON" 2>/dev/null || echo 0)

    VULN_LOW=$(python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    m=d.get('metadata',d).get('vulnerabilities',{})
    print(m.get('low',0))
except: print(0)
" <"$AUDIT_JSON" 2>/dev/null || echo 0)

    VULN_INFO=$(python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    m=d.get('metadata',d).get('vulnerabilities',{})
    print(m.get('info',0))
except: print(0)
" <"$AUDIT_JSON" 2>/dev/null || echo 0)

    VULN_TOTAL=$((VULN_CRITICAL + VULN_HIGH + VULN_MODERATE + VULN_LOW + VULN_INFO))
fi

echo -e "  Critical: ${RED}$VULN_CRITICAL${NC} | High: ${RED}$VULN_HIGH${NC} | Moderate: ${YELLOW}$VULN_MODERATE${NC} | Low: $VULN_LOW | Info: $VULN_INFO"
echo ""

# ─── Step 3: npm registry version comparison ──────────────────────────────
echo -e "${CYAN}[3/6] Comparing against latest npm releases...${NC}"

MAJOR_BUMPS=()
MINOR_BUMPS=()
PATCH_BUMPS=()

# Get all direct dependencies from root package.json
DEPS=$(python3 -c "
import json
with open('$REPO_DIR/package.json') as f:
    d = json.load(f)
deps = {}
for section in ['dependencies', 'devDependencies']:
    for pkg, ver in d.get(section, {}).items():
        if pkg != '@degenfeed' and not pkg.startswith('@degenfeed/'):
            deps[pkg] = ver
for pkg in sorted(deps.keys()):
    print(f'{pkg}|{deps[pkg]}')
")

echo "$DEPS" | while IFS='|' read -r pkg current_ver; do
    [[ -z "$pkg" ]] && continue
    latest_ver=$(fetch_latest_version "$pkg")
    [[ "$latest_ver" == "unknown" ]] && continue

    diff_type=$(semver_diff "$current_ver" "$latest_ver")
    case "$diff_type" in
    major)
        echo -e "  ${RED}MAJOR${NC} $pkg: $current_ver → $latest_ver"
        echo "MAJOR|$pkg|$current_ver|$latest_ver" >>"$TMPDIR/bumps.txt"
        ;;
    minor)
        echo -e "  ${YELLOW}minor${NC} $pkg: $current_ver → $latest_ver"
        echo "MINOR|$pkg|$current_ver|$latest_ver" >>"$TMPDIR/bumps.txt"
        ;;
    patch)
        echo -e "  ${GREEN}patch${NC} $pkg: $current_ver → $latest_ver"
        echo "PATCH|$pkg|$current_ver|$latest_ver" >>"$TMPDIR/bumps.txt"
        ;;
    esac
done

MAJOR_COUNT=$(grep -c "^MAJOR" "$TMPDIR/bumps.txt" 2>/dev/null || echo 0)
MINOR_COUNT=$(grep -c "^MINOR" "$TMPDIR/bumps.txt" 2>/dev/null || echo 0)
PATCH_COUNT=$(grep -c "^PATCH" "$TMPDIR/bumps.txt" 2>/dev/null || echo 0)
echo ""

# ─── Step 4: EOL package detection ────────────────────────────────────────
echo -e "${CYAN}[4/6] Checking for EOL packages...${NC}"

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null || echo "unknown")
echo -e "  Node.js: $NODE_VERSION"

# Known EOL packages / versions
EOL_PKGS=()
# Check for packages with known EOL status
if grep -q '"left-pad"' "$REPO_DIR/package.json" 2>/dev/null; then
    EOL_PKGS+=("left-pad")
fi
# Check Python version if applicable
if command -v python3 &>/dev/null; then
    PY_VERSION=$(python3 --version 2>/dev/null || echo "unknown")
fi

# Detect packages that have been deprecated
python3 -c "
import json, subprocess, sys
with open('$REPO_DIR/package.json') as f:
    d = json.load(f)
deps = {}
for section in ['dependencies', 'devDependencies']:
    for pkg, ver in d.get(section, {}).items():
        if pkg != '@degenfeed' and not pkg.startswith('@degenfeed/'):
            deps[pkg] = ver

deprecated = []
for pkg in sorted(deps.keys()):
    try:
        info = subprocess.run(
            ['npm', 'view', pkg, 'deprecated', '--json'],
            capture_output=True, text=True, timeout=10
        )
        if info.stdout and info.stdout.strip() not in ('', 'null', 'undefined'):
            deprecated.append({'package': pkg, 'current': deps[pkg], 'deprecated_message': info.stdout.strip()})
    except:
        pass

if deprecated:
    with open('$TMPDIR/deprecated.json', 'w') as f:
        json.dump(deprecated, f)
    for d in deprecated:
        print(f\"DEPRECATED|{d['package']}|{d['current']}|{d['deprecated_message']}\")
" 2>/dev/null >>"$TMPDIR/eol.txt" || true

EOL_COUNT=$(wc -l <"$TMPDIR/eol.txt" 2>/dev/null || echo 0)
if [[ "$EOL_COUNT" -gt 0 ]]; then
    while IFS='|' read -r status pkg ver msg; do
        [[ -z "$pkg" ]] && continue
        echo -e "  ${RED}DEPRECATED${NC} $pkg@$ver: $msg"
    done <"$TMPDIR/eol.txt"
else
    echo -e "  ${GREEN}No deprecated packages found.${NC}"
fi
echo ""

# ─── Step 5: Health score calculation ─────────────────────────────────────
echo -e "${CYAN}[5/6] Calculating health score...${NC}"

# Base: 100
# Deductions: outdated (-2 each), vulnerabilities (-10 critical, -5 high, -2 moderate), major bumps (-3 each), EOL (-15 each)
SCORE=100
SCORE=$((SCORE - (OUTDATED_COUNT * 2)))
SCORE=$((SCORE - (VULN_CRITICAL * 10)))
SCORE=$((SCORE - (VULN_HIGH * 5)))
SCORE=$((SCORE - (VULN_MODERATE * 2)))
SCORE=$((SCORE - (MAJOR_COUNT * 3)))
SCORE=$((SCORE - (EOL_COUNT * 15)))
[[ "$SCORE" -lt 0 ]] && SCORE=0

if [[ "$SCORE" -ge 80 ]]; then
    echo -e "  Health Score: ${GREEN}$SCORE/100${NC}"
elif [[ "$SCORE" -ge 50 ]]; then
    echo -e "  Health Score: ${YELLOW}$SCORE/100${NC}"
else
    echo -e "  Health Score: ${RED}$SCORE/100${NC}"
fi
echo ""

# ─── Step 6: Generate JSON report ─────────────────────────────────────────
echo -e "${CYAN}[6/6] Writing JSON report...${NC}"

# Write intermediate data files for Python processing
echo "$SCORE" >"$TMPDIR/score.txt"
echo "$NODE_VERSION" >"$TMPDIR/node_version.txt"
echo "$OUTDATED_COUNT" >"$TMPDIR/outdated_count.txt"
echo "$VULN_CRITICAL" >"$TMPDIR/vuln_critical.txt"
echo "$VULN_HIGH" >"$TMPDIR/vuln_high.txt"
echo "$VULN_MODERATE" >"$TMPDIR/vuln_moderate.txt"
echo "$VULN_LOW" >"$TMPDIR/vuln_low.txt"
echo "$VULN_INFO" >"$TMPDIR/vuln_info.txt"
echo "$VULN_TOTAL" >"$TMPDIR/vuln_total.txt"
echo "$MAJOR_COUNT" >"$TMPDIR/major_count.txt"
echo "$MINOR_COUNT" >"$TMPDIR/minor_count.txt"
echo "$PATCH_COUNT" >"$TMPDIR/patch_count.txt"
echo "$EOL_COUNT" >"$TMPDIR/eol_count.txt"

python3 <<'PYEOF'
import json
import os

TMPDIR = os.environ.get('TMPDIR', '/tmp')
REPORT_FILE = os.environ['REPORT_FILE']

def read_val(filename, default=0):
    path = os.path.join(TMPDIR, filename)
    try:
        with open(path) as f:
            return f.read().strip()
    except:
        return str(default)

report = {
    'timestamp': os.popen('date -u -Iseconds').read().strip(),
    'repo': 'degenfeed-web',
    'health_score': int(read_val('score.txt')),
    'node_version': read_val('node_version.txt'),
    'summary': {
        'outdated_packages': int(read_val('outdated_count.txt')),
        'vulnerabilities': {
            'critical': int(read_val('vuln_critical.txt')),
            'high': int(read_val('vuln_high.txt')),
            'moderate': int(read_val('vuln_moderate.txt')),
            'low': int(read_val('vuln_low.txt')),
            'info': int(read_val('vuln_info.txt')),
            'total': int(read_val('vuln_total.txt')),
        },
        'version_bumps': {
            'major': int(read_val('major_count.txt')),
            'minor': int(read_val('minor_count.txt')),
            'patch': int(read_val('patch_count.txt')),
        },
        'eol_packages': int(read_val('eol_count.txt')),
    },
}

# Load outdated packages
outdated_path = os.path.join(TMPDIR, 'outdated.json')
try:
    with open(outdated_path) as f:
        data = json.load(f)
        report['outdated_packages'] = [{'package': pkg, **info} for pkg, info in data.items()]
except:
    report['outdated_packages'] = []

# Load vulnerabilities
audit_path = os.path.join(TMPDIR, 'audit.json')
try:
    with open(audit_path) as f:
        data = json.load(f)
    if isinstance(data, dict):
        audit = data.get('audit', data)
        vulns = []
        for vuln_id, v in audit.get('vulnerabilities', {}).items():
            vulns.append({
                'id': vuln_id,
                'severity': v.get('severity', 'unknown'),
                'title': v.get('title', ''),
                'via': v.get('via', []),
                'fix_available': v.get('fixAvailable', False),
            })
        report['vulnerabilities'] = vulns[:50]
except:
    report['vulnerabilities'] = []

# Load version bumps
bumps_path = os.path.join(TMPDIR, 'bumps.txt')
try:
    bumps = []
    with open(bumps_path) as f:
        for line in f:
            parts = line.strip().split('|')
            if len(parts) >= 4:
                bumps.append({'type': parts[0], 'package': parts[1], 'current': parts[2], 'latest': parts[3]})
    report['version_bumps'] = bumps
except:
    report['version_bumps'] = []

# Load EOL packages
deprecated_path = os.path.join(TMPDIR, 'deprecated.json')
try:
    with open(deprecated_path) as f:
        eol_data = json.load(f)
    report['eol_packages'] = [{'package': e['package'], 'current': e['current'], 'message': e['deprecated_message']} for e in eol_data]
except:
    report['eol_packages'] = []

with open(REPORT_FILE, 'w') as f:
    json.dump(report, f, indent=2)

print(f'  Report written to {REPORT_FILE} ({len(json.dumps(report))} bytes)')
PYEOF

echo ""
echo "=============================================="
echo "  Dependency Health Check Complete"
echo "  Score: $SCORE/100"
echo "  Report: $REPORT_FILE"
echo "=============================================="
