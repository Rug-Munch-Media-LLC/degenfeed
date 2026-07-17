#!/usr/bin/env bash
set -euo pipefail

# ── DegenFeed — Android Native Build ───────────────────────────
# Requirements:
#   - Android Studio (latest)
#   - Android SDK 34+
#   - JAVA_HOME set (JDK 17+)
#   - Node.js 20+ & pnpm
#
# Usage:
#   ./scripts/build-android.sh             # Build + open Android Studio
#   ./scripts/build-android.sh --no-open   # Build only (CI)
#   ./scripts/build-android.sh --release   # Production APK/AAB
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
echo "▸ Syncing Capacitor (Android)…"
npx cap sync android

# ── 3. Open Android Studio or build APK ─────────────────────────
if [ "$MODE" = "release" ]; then
    echo "▸ Building release APK / AAB…"
    cd "android"
    if [ -f "./gradlew" ]; then
        ./gradlew assembleRelease
        echo "✓ APK: android/app/build/outputs/apk/release/"
    fi
    cd "$APP_DIR"
fi

if [ "$OPEN" = true ]; then
    echo "▸ Opening Android Studio…"
    open "android/" -a "Android Studio" 2>/dev/null ||
        echo "  (open android/ in Android Studio manually)"
fi

echo "✓ Android build complete."
