#!/usr/bin/env bash
# ── DegenFeed Play Store Asset Generator ───────────────────────
# Generates Feature Graphic (1024×500) and App Icon (512×512)
# using ImageMagick.
#
# Usage: bash generate-assets.sh
# Requires: imagemagick (magick/convert)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}"
FONT="${FONT:-/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf}"

DEGEN_GREEN="#00ff41"
DEGEN_DARK="#030712"
DEGEN_GRAY="#1f2937"
DEGEN_LIGHTER="#374151"
MAGICK=$(command -v magick 2>/dev/null || command -v convert 2>/dev/null)

if [ -z "$MAGICK" ]; then
    echo "❌ ImageMagick not found. Install it:"
    echo "  brew install imagemagick   # macOS"
    echo "  apt install imagemagick    # Linux"
    exit 1
fi

echo "Generating Feature Graphic..."

$MAGICK -size 1024x500 "xc:${DEGEN_DARK}" \
    -fill "${DEGEN_GRAY}" -draw "rectangle 0,0 1024,500" \
    -fill "${DEGEN_GREEN}" -draw "circle 512,250 512,150" \
    -fill "${DEGEN_GREEN}" -draw "circle 420,180 420,160" \
    -fill "${DEGEN_GREEN}" -draw "circle 604,180 604,160" \
    -fill "${DEGEN_GREEN}" -draw "circle 512,320 512,300" \
    -fill "${DEGEN_GREEN}" -draw "circle 380,260 380,250" \
    -fill "${DEGEN_GREEN}" -draw "circle 644,260 644,250" \
    -fill "${DEGEN_GREEN}" -draw "circle 460,310 460,300" \
    -fill "${DEGEN_GREEN}" -draw "circle 564,310 564,300" \
    -fill "${DEGEN_DARK}" -draw "rectangle 312,200 712,300" \
    -font "$FONT" \
    -fill white -pointsize 48 -gravity center -annotate +0-40 "DegenFeed" \
    -fill "${DEGEN_GREEN}" -pointsize 24 -gravity center -annotate +0+30 "Crypto Social Feed" \
    -fill "${DEGEN_LIGHTER}" -pointsize 16 -gravity center -annotate +0+75 "Nostr · Farcaster · Lens · Bluesky · Mastodon · RSS" \
    "${OUTPUT_DIR}/feature-graphic-1024x500.png"

echo "Generating App Icon..."

$MAGICK -size 512x512 "xc:${DEGEN_DARK}" \
    -fill "${DEGEN_GREEN}" -draw "roundrectangle 32,32 480,480 64,64" \
    -fill "${DEGEN_GREEN}" -draw "circle 256,220 256,100" \
    -fill "${DEGEN_GREEN}" -draw "circle 200,160 200,145" \
    -fill "${DEGEN_GREEN}" -draw "circle 312,160 312,145" \
    -fill "${DEGEN_GREEN}" -draw "circle 256,280 256,265" \
    -fill "${DEGEN_DARK}" -draw "circle 256,220 256,140" \
    -font "$FONT" \
    -fill white -pointsize 48 -gravity center -annotate +0+100 "DF" \
    -fill "${DEGEN_GREEN}" -pointsize 14 -gravity center -annotate +0+150 "✦" \
    "${OUTPUT_DIR}/icon-512x512.png"

echo ""
echo "✅ Play Store assets generated:"
echo "  - ${OUTPUT_DIR}/feature-graphic-1024x500.png"
echo "  - ${OUTPUT_DIR}/icon-512x512.png"
echo ""
echo "Note: Replace these placeholders with production-quality"
echo "designs before App Store / Play Store submission."
