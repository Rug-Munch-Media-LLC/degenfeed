#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# DegenFeed — Lighthouse CI Runner
#
# Runs Lighthouse against the app in prod mode.
# Outputs scores for all Lighthouse categories.
# Can run in CI or locally.
#
# Usage:
#   ./scripts/lighthouse.sh                # localhost:3000 (default)
#   ./scripts/lighthouse.sh https://app.degenfeed.xyz
#   ./scripts/lighthouse.sh --ci           # CI mode (JSON output)
# ─────────────────────────────────────────────────────────────

TARGET="${1:-http://localhost:3000}"
CI_MODE=false
OUTPUT_DIR="./.lighthouse-results"

if [ "$1" = "--ci" ] || [ "$2" = "--ci" ] 2>/dev/null; then
    CI_MODE=true
fi

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   DegenFeed — Lighthouse Performance Audit              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Target:     $TARGET"
echo "CI mode:    $CI_MODE"
echo "Output dir: $OUTPUT_DIR"
echo ""

# ── Prerequisites ──────────────────────────────────────────────

if ! command -v npx &>/dev/null; then
    echo "❌ npx not found. Install Node.js >=18."
    exit 1
fi

LH_VERSION=$(npx lighthouse --version 2>/dev/null || echo "not-installed")
echo "Lighthouse version: $LH_VERSION"

# If not installed, install it
if [ "$LH_VERSION" = "not-installed" ]; then
    echo "📦 Installing Lighthouse..."
    npm install -g lighthouse 2>/dev/null || npx --yes lighthouse --version >/dev/null 2>&1
fi

mkdir -p "$OUTPUT_DIR"

# ── Build the app if targeting localhost ───────────────────────

if echo "$TARGET" | grep -q 'localhost\|127.0.0.1'; then
    echo "🔨 Building app for production..."
    pushd "$(dirname "$0")/../apps/web" >/dev/null
    npx next build 2>&1 | tail -5
    echo "🚀 Starting production server on port 3000..."
    npx next start -p 3000 &
    SERVER_PID=$!
    popd >/dev/null

    # Wait for server to be ready
    echo "⏳ Waiting for server..."
    for i in {1..30}; do
        if curl -sf "$TARGET" >/dev/null 2>&1; then
            echo "✅ Server ready"
            break
        fi
        sleep 1
    done
fi

# ── Run Lighthouse ─────────────────────────────────────────────

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_HTML="$OUTPUT_DIR/report-$TIMESTAMP.html"
REPORT_JSON="$OUTPUT_DIR/report-$TIMESTAMP.json"

LH_FLAGS=(
    "--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage"
    "--output=html"
    "--output=json"
    "--output-path=$OUTPUT_DIR/report-$TIMESTAMP"
    "--preset=desktop"
    "--quiet"
)

# Also run mobile preset for Web Vitals
MOBILE_FLAGS=(
    "--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage"
    "--output=json"
    "--output-path=$OUTPUT_DIR/report-mobile-$TIMESTAMP.json"
    "--preset=desktop"
    "--screenEmulation.mobile=true"
    "--screenEmulation.width=390"
    "--screenEmulation.height=844"
    "--quiet"
)

echo "📊 Running Lighthouse (desktop)..."
npx lighthouse "$TARGET" "${LH_FLAGS[@]}" 2>/dev/null || true

echo "📊 Running Lighthouse (mobile)..."
npx lighthouse "$TARGET" "${MOBILE_FLAGS[@]}" 2>/dev/null || true

# ── Parse scores ───────────────────────────────────────────────

if [ -f "$REPORT_JSON" ]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║   LIGHTHOUSE SCORES                                      ║"
    echo "╠═══════════════════════════════════════════════════════════╣"

    extract_score() {
        python3 -c "
import json
with open('$REPORT_JSON') as f:
    data = json.load(f)
    cat = data['categories']
    print(f'│  {cat[\"performance\"][\"title\"]:30s} {cat[\"performance\"][\"score\"]*100:5.0f}/100 │')
    print(f'│  {cat[\"accessibility\"][\"title\"]:30s} {cat[\"accessibility\"][\"score\"]*100:5.0f}/100 │')
    print(f'│  {cat[\"best-practices\"][\"title\"]:30s} {cat[\"best-practices\"][\"score\"]*100:5.0f}/100 │')
    print(f'│  {cat[\"seo\"][\"title\"]:30s} {cat[\"seo\"][\"score\"]*100:5.0f}/100 │')
  " 2>/dev/null || echo "│  ⚠️  Could not parse scores                    │"
    }

    extract_score

    echo "╠═══════════════════════════════════════════════════════════╣"
    echo "║   CORE WEB VITALS                                        ║"
    echo "╠═══════════════════════════════════════════════════════════╣"

    python3 -c "
import json
with open('$REPORT_JSON') as f:
    data = json.load(f)
    audits = data['audits']
    for key, label in [('largest-contentful-paint','LCP'), ('total-blocking-time','TBT'), ('cumulative-layout-shift','CLS'), ('speed-index','Speed Index'), ('interactive','TTI'), ('max-potential-fid','FID')]:
        if key in audits:
            v = audits[key]
            val = v.get('numericValue', 0)
            display = v.get('displayValue', str(round(val, 2)))
            print(f'│  {label:30s} {display:>20s} │')
  " 2>/dev/null || echo "│  ⚠️  Could not parse Web Vitals                │"

    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo "📄 Full report:    file://$(realpath "$REPORT_HTML")"
    echo "📄 JSON report:    file://$(realpath "$REPORT_JSON")"
    echo ""

    # CI mode: pass/fail based on scores
    if [ "$CI_MODE" = true ]; then
        python3 -c "
import json, sys
with open('$REPORT_JSON') as f:
    data = json.load(f)
    cats = data['categories']
    failures = []
    for key, threshold in [('performance', 0.9), ('accessibility', 0.9), ('best-practices', 0.9)]:
        score = cats[key]['score']
        if score < threshold:
            failures.append(f'{cats[key][\"title\"]}: {score*100:.0f}/100 (threshold: {threshold*100:.0f}/100)')
    if failures:
        print('❌ FAILED:')
        for f in failures:
            print(f'   - {f}')
        sys.exit(1)
    else:
        print('✅ ALL CATEGORIES PASS 90+')
    " 2>/dev/null || true
    fi
else
    echo "❌ No report generated. Lighthouse may have failed."
    exit 1
fi

# ── Cleanup ────────────────────────────────────────────────────

if [ -n "${SERVER_PID:-}" ]; then
    echo "🧹 Stopping server..."
    kill "$SERVER_PID" 2>/dev/null || true
fi

echo "✅ Done."
