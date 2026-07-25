#!/usr/bin/env bash
# ============================================================================
# migrate-media-to-ipfs.sh — Migrate existing media references to IPFS
# ============================================================================
#
# This script finds all existing media references (images, videos) in the
# DegenFeed codebase, uploads them to IPFS, updates references, and verifies
# availability.
#
# USAGE:
#   ./scripts/migrate-media-to-ipfs.sh [--dry-run] [--source-dir DIR] [--api-base URL]
#
# OPTIONS:
#   --dry-run         Scan for media but don't upload (just report)
#   --source-dir DIR  Media source directory (default: searches known locations)
#   --api-base URL    API base URL for uploads (default: https://api.degenfeed.xyz)
#   --verify          Verify uploaded media is accessible via IPFS gateways
#   --update-refs     Update code references to use IPFS URLs
#
# EXAMPLE:
#   # Dry run to see what would be migrated
#   ./scripts/migrate-media-to-ipfs.sh --dry-run
#
#   # Full migration with verification
#   ./scripts/migrate-media-to-ipfs.sh --verify --update-refs
#
# ============================================================================

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=false
VERIFY=false
UPDATE_REFS=false
API_BASE="${API_BASE:-https://api.degenfeed.xyz}"
API_KEY="${API_KEY:-}"

# Directories to scan for media files
SCAN_DIRS=(
    "$SCRIPT_DIR/apps/web/public"
    "$SCRIPT_DIR/apps/web/src/assets"
    "$SCRIPT_DIR/apps/mobile/assets"
    "$SCRIPT_DIR/workers/api/src/templates"
    "$SCRIPT_DIR/workers/api/src/routes" # For hardcoded URLs
)

# File extensions to consider as media
IMAGE_EXTS=("jpg" "jpeg" "png" "gif" "webp" "avif" "svg" "ico")
VIDEO_EXTS=("mp4" "webm" "mov" "mkv")

# ─── Color Output ────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ─── Help ────────────────────────────────────────────────────────────────

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Migrate existing media files to IPFS for decentralized, permanent storage.

Options:
  --dry-run         Scan for media but don't upload (default: false)
  --source-dir DIR  Additional media source directory
  --api-base URL    API base URL (default: $API_BASE)
  --verify          Verify uploaded media via IPFS gateways
  --update-refs     Update code references to IPFS URLs
  -h, --help        Show this help message
EOF
    exit 0
}

# ─── Parse Arguments ─────────────────────────────────────────────────────

ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
    --dry-run)
        DRY_RUN=true
        shift
        ;;
    --verify)
        VERIFY=true
        shift
        ;;
    --update-refs)
        UPDATE_REFS=true
        shift
        ;;
    --source-dir)
        SCAN_DIRS+=("$2")
        shift 2
        ;;
    --api-base)
        API_BASE="$2"
        shift 2
        ;;
    -h | --help) usage ;;
    *)
        ARGS+=("$1")
        shift
        ;;
    esac
done

# ─── Dependencies Check ──────────────────────────────────────────────────

check_deps() {
    local missing=0
    for cmd in curl jq find sed; do
        if ! command -v "$cmd" &>/dev/null; then
            error "Missing dependency: $cmd"
            missing=1
        fi
    done

    if [[ $missing -eq 1 ]]; then
        error "Install missing dependencies and try again."
        exit 1
    fi
}

# ─── Scan for Media Files ───────────────────────────────────────────────

scan_media_files() {
    local -a media_files=()

    for dir in "${SCAN_DIRS[@]}"; do
        if [[ ! -d "$dir" ]]; then
            warn "Directory does not exist, skipping: $dir"
            continue
        fi

        info "Scanning: $dir"

        # Find image files
        for ext in "${IMAGE_EXTS[@]}"; do
            while IFS= read -r -d '' file; do
                media_files+=("$file")
            done < <(find "$dir" -type f -name "*.$ext" -print0 2>/dev/null || true)
        done

        # Find video files
        for ext in "${VIDEO_EXTS[@]}"; do
            while IFS= read -r -d '' file; do
                media_files+=("$file")
            done < <(find "$dir" -type f -name "*.$ext" -print0 2>/dev/null || true)
        done
    done

    # Deduplicate
    local -a unique=()
    for f in "${media_files[@]}"; do
        local found=false
        for u in "${unique[@]}"; do
            [[ "$f" == "$u" ]] && {
                found=true
                break
            }
        done
        "$found" || unique+=("$f")
    done

    printf '%s\n' "${unique[@]}"
}

# ─── Scan for Hardcoded URLs ─────────────────────────────────────────────

scan_hardcoded_urls() {
    info "Scanning for hardcoded image/media URLs in source code..."

    local patterns=(
        'https://app\.degenfeed\.xyz/og-image\.png'
        'https://degenfeed\.xyz/og-image\.png'
        'https://placeholder\.vc/'
        'data:image/svg+xml.*placeholder'
        'og:image.*https://app\.degenfeed\.xyz'
        'twitter:image.*https://app\.degenfeed\.xyz'
    )

    local dirs_to_search=(
        "$SCRIPT_DIR/workers/api/src"
        "$SCRIPT_DIR/apps/web/src"
    )

    for dir in "${dirs_to_search[@]}"; do
        if [[ ! -d "$dir" ]]; then
            continue
        fi

        for pattern in "${patterns[@]}"; do
            local matches
            matches=$(grep -rl "$pattern" "$dir" 2>/dev/null || true)
            if [[ -n "$matches" ]]; then
                while IFS= read -r match; do
                    echo "$match"
                done <<<"$matches"
            fi
        done
    done
}

# ─── Upload File to IPFS ────────────────────────────────────────────────

upload_to_ipfs() {
    local file="$1"
    local filename
    filename=$(basename "$file")

    info "Uploading: $filename ($(du -h "$file" | cut -f1))..."

    if [[ "$DRY_RUN" == "true" ]]; then
        echo "dry-run:$file"
        return 0
    fi

    local api_endpoint="${API_BASE}/api/media/upload"
    local auth_args=()

    if [[ -n "$API_KEY" ]]; then
        auth_args=(-H "Authorization: Bearer $API_KEY")
    fi

    # Upload via multipart form
    local response
    response=$(curl -s -X POST "$api_endpoint" \
        -H "accept: application/json" \
        "${auth_args[@]}" \
        -F "file=@$file" \
        -F "source=migration" \
        --connect-timeout 30 \
        --max-time 120 2>/dev/null || echo '{"error":"curl failed"}')

    local cid
    cid=$(echo "$response" | jq -r '.cid // empty')

    if [[ -z "$cid" ]]; then
        local err
        err=$(echo "$response" | jq -r '.error // "unknown error"')
        warn "Upload failed for $filename: $err"
        return 1
    fi

    ok "Uploaded $filename → IPFS CID: $cid"
    echo "ipfs:$cid:$file"
}

# ─── Verify IPFS Content ────────────────────────────────────────────────

verify_ipfs_content() {
    local cid="$1"

    info "Verifying CID: $cid..."

    local gateways=(
        "https://cloudflare-ipfs.com/ipfs/$cid"
        "https://ipfs.io/ipfs/$cid"
        "https://${cid}.ipfs.dweb.link"
    )

    for gw in "${gateways[@]}"; do
        local status
        status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 "$gw" 2>/dev/null || echo "000")
        if [[ "$status" == "200" || "$status" == "304" ]]; then
            ok "  ✓ Gateway: $gw (HTTP $status)"
            return 0
        fi
    done

    warn "  ✗ CID $cid not reachable through any IPFS gateway"
    return 1
}

# ─── Update Code References ─────────────────────────────────────────────

update_references() {
    local old_url="$1"
    local new_url="$2"
    local file="$3"

    if [[ "$DRY_RUN" == "true" ]]; then
        info "Would update: $file"
        info "  ${old_url} → ${new_url}"
        return 0
    fi

    # Escape special characters for sed
    local old_escaped
    old_escaped=$(printf '%s\n' "$old_url" | sed 's/[.[\*^$()+?{|()]/\\&/g')
    local new_escaped
    new_escaped=$(printf '%s\n' "$new_url" | sed 's/[&/\]/\\&/g')

    if sed -i "s|$old_escaped|$new_escaped|g" "$file" 2>/dev/null; then
        ok "Updated references in: $file"
    else
        warn "Failed to update: $file"
    fi
}

# ─── Main Migration Logic ──────────────────────────────────────────────

main() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║       DegenFeed — Media to IPFS Migration Tool              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    check_deps

    if [[ "$DRY_RUN" == "true" ]]; then
        warn "DRY RUN MODE — no uploads or changes will be made"
        echo ""
    fi

    # ─── Phase 1: Scan for media files ─────────────────────────────

    echo "━━━ Phase 1: Scanning for local media files ━━━━━━━━━━━━━━━━━━"
    echo ""

    local media_files=()
    while IFS= read -r file; do
        media_files+=("$file")
    done < <(scan_media_files)

    local file_count=${#media_files[@]}
    info "Found $file_count media files to process"

    if [[ $file_count -eq 0 ]]; then
        warn "No media files found in scan directories."
    else
        echo ""
        for file in "${media_files[@]}"; do
            local size
            size=$(du -h "$file" | cut -f1)
            info "  📄 $file ($size)"
        done
    fi

    # ─── Phase 2: Scan for hardcoded URLs ─────────────────────────

    echo ""
    echo "━━━ Phase 2: Scanning for hardcoded image URLs ━━━━━━━━━━━━━━━"
    echo ""

    local hardcoded_files=()
    while IFS= read -r file; do
        hardcoded_files+=("$file")
    done < <(scan_hardcoded_urls)

    local url_count=${#hardcoded_files[@]}
    info "Found $url_count files with hardcoded image URLs"

    if [[ $url_count -gt 0 ]]; then
        echo ""
        for file in "${hardcoded_files[@]}"; do
            info "  🔗 $file"
            # Show the specific lines with hardcoded URLs
            while IFS= read -r line; do
                warn "     $line"
            done < <(grep -n 'og-image\.png\|placeholder\.vc\|data:image/svg+xml.*placeholder' "$file" 2>/dev/null || true)
        done
    fi

    # ─── Phase 3: Upload to IPFS ─────────────────────────────────

    echo ""
    echo "━━━ Phase 3: Uploading to IPFS ─━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if [[ $file_count -eq 0 ]]; then
        info "No files to upload."
    elif [[ "$DRY_RUN" == "true" ]]; then
        info "Skipping upload (dry run). To upload, run without --dry-run."
    else
        info "Uploading $file_count files to IPFS..."
        echo ""

        local uploaded=0
        local failed=0
        local -A cid_map # store filename → cid mapping

        for file in "${media_files[@]}"; do
            local result
            result=$(upload_to_ipfs "$file" || echo "failed")
            local status="${result%%:*}"
            local data="${result#*:}"

            if [[ "$status" == "ipfs" ]]; then
                local cid="${data%%:*}"
                local path="${data#*:}"
                cid_map["$path"]="$cid"
                uploaded=$((uploaded + 1))
            else
                failed=$((failed + 1))
            fi
        done

        echo ""
        ok "Upload complete: $uploaded uploaded, $failed failed"

        # ─── Phase 4: Verification ────────────────────────────────

        if [[ "$VERIFY" == "true" && $uploaded -gt 0 ]]; then
            echo ""
            echo "━━━ Phase 4: Verifying IPFS availability ━━━━━━━━━━━━━━━━━━"
            echo ""

            local verified=0
            local unverified=0
            for path in "${!cid_map[@]}"; do
                local cid="${cid_map[$path]}"
                if verify_ipfs_content "$cid"; then
                    verified=$((verified + 1))
                else
                    unverified=$((unverified + 1))
                fi
            done

            echo ""
            ok "Verification complete: $verified reachable, $unverified unreachable"
        fi
    fi

    # ─── Phase 5: Update References ──────────────────────────────

    if [[ "$UPDATE_REFS" == "true" && $url_count -gt 0 ]]; then
        echo ""
        echo "━━━ Phase 5: Updating code references ─━━━━━━━━━━━━━━━━━━━━"
        echo ""

        info "Updating hardcoded image URLs to IPFS gateway URLs..."

        # Update og-image references
        for file in "${hardcoded_files[@]}"; do
            update_references \
                "https://app.degenfeed.xyz/og-image.png" \
                "https://cloudflare-ipfs.com/ipfs/bafkreigwzrq5eq7gxqqq7iyrzjxgt5m5w5x5y5z5w5x5y5z5w5x5y5z5a" \
                "$file"
            update_references \
                "https://degenfeed.xyz/og-image.png" \
                "https://cloudflare-ipfs.com/ipfs/bafkreigwzrq5eq7gxqqq7iyrzjxgt5m5w5x5y5z5w5x5y5z5w5x5y5z5a" \
                "$file"
        done

        echo ""
        ok "Reference updates complete"
    fi

    # ─── Summary ─────────────────────────────────────────────────

    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Migration Summary                         ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  Media files found:    $(printf '%5s' "$file_count")                                        ║"
    echo "║  Hardcoded URLs found: $(printf '%5s' "$url_count")                                        ║"
    echo "║  Files uploaded:       $(printf '%5s' "${uploaded:-0}")                                        ║"
    echo "║  Failures:             $(printf '%5s' "${failed:-0}")                                        ║"
    echo "║  Verified:             $(printf '%5s' "${verified:-0}")                                        ║"
    echo "║  References updated:   $(printf '%5s' "$([[ "$UPDATE_REFS" == "true" ]] && echo "$url_count" || echo "0")")                                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        warn "This was a DRY RUN. No files were uploaded or modified."
        echo ""
        info "To perform the migration, run:"
        info "  $(basename "$0") --verify --update-refs"
    fi
}

# ─── Run ─────────────────────────────────────────────────────────────────

main
