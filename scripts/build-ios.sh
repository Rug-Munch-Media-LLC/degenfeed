#!/usr/bin/env bash
set -euo pipefail

# ── DegenFeed — iOS Native Build ───────────────────────────────
# Requirements:
#   - macOS (Xcode 16+ recommended)
#   - CocoaPods (gem install cocoapods)
#   - Node.js 20+ & pnpm
#
# Usage:
#   ./scripts/build-ios.sh             # Build + open Xcode
#   ./scripts/build-ios.sh --no-open   # Build only (CI)
#   ./scripts/build-ios.sh --release   # Production build
# ────────────────────────────────────────────────────────────────

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/apps/web"
OPEN=true
MODE="debug"

for arg in "$@"; do
    case "$arg" in
    --no-open) OPEN=false ;;
    --release) MODE="release" ;;
    esac
done

# ── 1. Build Next.js ────────────────────────────────────────────
echo "▸ Building Next.js ($MODE)…"
cd "$APP_DIR"
pnpm build

# ── 2. Sync Capacitor ───────────────────────────────────────────
echo "▸ Syncing Capacitor (iOS)…"
npx cap sync ios

# ── 3. (Optional) Pod install ────────────────────────────────────
if [ -f "ios/App/Podfile" ]; then
    echo "▸ Installing CocoaPods dependencies…"
    (cd ios && pod install --silent)
fi

# ── 4. Open Xcode or just validate ──────────────────────────────
if [ "$MODE" = "release" ]; then
    echo "▸ Building release archive…"
    xcodebuild \
        -workspace ios/App/App.xcworkspace \
        -scheme App \
        -sdk iphoneos \
        -configuration Release \
        -archivePath "$ROOT/build/DegenFeed.xcarchive" \
        archive \
        CODE_SIGN_STYLE=Automatic |
        xcpretty
fi

if [ "$OPEN" = true ]; then
    echo "▸ Opening Xcode…"
    open "ios/App/App.xcworkspace"
fi

echo "✓ iOS build complete."
