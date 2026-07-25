#!/usr/bin/env bash
# ─── add-protocol.sh — Scaffold a new DegenFeed protocol integration ───
#
# Usage:  ./scripts/add-protocol.sh <protocol-name> <display-name> [tier-weight]
#
# Example: ./scripts/add-protocol.sh myproto "My Protocol" 0.7
#
# This script scaffolds:
#   1. bridge/src/providers/<proto>.ts     — provider boilerplate
#   2. Registers in bridge/src/server/feeds.ts
#   3. Adds Protocol type to packages/types/src/index.ts
#   4. Adds PLATFORM_TIER entry to packages/ranking/src/unified-scorer.ts
#   5. Adds PLATFORM_TIER entry to packages/*/src/*.ts (tier files)
#   6. Appends row to packages/feed-providers/PROVIDERS.md
#
# Post-steps (manual): add niche keywords, API endpoints, test with
#   curl http://localhost:4001/api/feed/<proto>
# ──────────────────────────────────────────────────────────────────────────

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <protocol-name> <display-name> [tier-weight]"
  echo ""
  echo "  <protocol-name>  lowercase, no spaces, e.g. 'mysocial'"
  echo "  <display-name>   human-readable, e.g. 'My Social Network'"
  echo "  [tier-weight]    scoring tier 0.0-1.0 (default 0.6)"
  exit 1
fi

PROTO="$1"
DISPLAY="$2"
TIER="${3:-0.6}"

# ─── Paths ───────────────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROVIDER_FILE="$ROOT/bridge/src/providers/$PROTO.ts"
FEEDS_FILE="$ROOT/bridge/src/server/feeds.ts"
TYPES_FILE="$ROOT/packages/types/src/index.ts"
SCORER_FILE="$ROOT/packages/ranking/src/unified-scorer.ts"
PROVIDERS_MD="$ROOT/packages/feed-providers/PROVIDERS.md"

# ─── Validate ────────────────────────────────────────────────────────────
if [ -f "$PROVIDER_FILE" ]; then
  echo "Error: Provider already exists at $PROVIDER_FILE"
  exit 1
fi

if ! echo "$PROTO" | grep -qE '^[a-z][a-z0-9_-]+$'; then
  echo "Error: protocol name must be lowercase alphanumeric with optional hyphens/underscores"
  exit 1
fi

# ─── 1. Create provider boilerplate ──────────────────────────────────────
FUNC_NAME="fetch${PROTO^}Posts"

cat > "$PROVIDER_FILE" << PROVIDER
/**
 * ${DISPLAY} Provider
 *
 * Fetches posts from ${DISPLAY}.
 * API: TODO — add API endpoint
 *
 * Strategy:
 * 1. TODO
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const \$fetch = globalThis.fetch;

// ─── Types ─────────────────────────────────────────────────────────────
// TODO — define API response types

// ─── Constants ─────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────

function guessNiches(text: string, tags: string[] = []): string[] {
  const niches: string[] = [];
  const lower = \`\${text} \${tags.join(' ')}\`.toLowerCase();

  if (/\\b(btc|bitcoin|satoshi|halving)\\b/.test(lower)) niches.push('bitcoin');
  if (/\\b(eth|ethereum|vitalik|pectra)\\b/.test(lower)) niches.push('ethereum');
  if (/\\b(sol|solana|spl)\\b/.test(lower)) niches.push('solana');
  if (/\\b(defi|liquidity|yield|farm|swap|dex|staking)\\b/.test(lower)) niches.push('defi');
  if (/\\b(nft|art|collectible|mint|token)\\b/.test(lower)) niches.push('nft');
  if (/\\b(ai |artificial|intelligence|llm|agent|machine learning)\\b/.test(lower)) niches.push('ai');
  if (/\\b(sec|regulation|etf|compliance|congress)\\b/.test(lower)) niches.push('regulation');
  if (/\\b(meme|pepe|doge|shib|bonk|memecoin)\\b/.test(lower)) niches.push('memecoin');
  if (/\\b(security|hack|exploit|audit|scam|phishing|breach)\\b/.test(lower)) niches.push('security');
  if (/\\b(crypto|blockchain|web3|${PROTO})\\b/.test(lower)) niches.push('crypto');
  if (/\\b(tech|technology|programming|code|software|dev)\\b/.test(lower)) niches.push('tech');
  if (/\\b(news|breaking|analysis|opinion|discussion)\\b/.test(lower)) niches.push('news');

  if (niches.length === 0) niches.push('crypto');
  return niches;
}

// ─── Mapping ──────────────────────────────────────────────────────────
// TODO — map API response to UnifiedPost

// ─── Fetch Logic ──────────────────────────────────────────────────────
// TODO — implement actual fetch from API

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: '${PROTO}',
  name: '${DISPLAY}',
  description: 'TODO — add description',
  endpoint: '/api/feed/${PROTO}',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function ${FUNC_NAME}(limit = 20): Promise<UnifiedPost[]> {
  console.log(\`[bridge] ${DISPLAY}: 0 posts (placeholder — implement fetch)\`);
  return [];
}

/** @alias */
export const fetch = ${FUNC_NAME};
PROVIDER

echo "✅ Created $PROVIDER_FILE"

# ─── 2. Register in feeds.ts ──────────────────────────────────────────
if grep -q "import { fetch${PROTO^}Posts" "$FEEDS_FILE" 2>/dev/null; then
  echo "  ⏭️  Already registered in feeds.ts"
else
  # Add import in alphabetical-ish order (before last import)
  sed -i "s/^import type { UnifiedPost/import { fetch${PROTO^}Posts } from '..\/providers\/${PROTO}';\nimport type { UnifiedPost/" "$FEEDS_FILE"

  # Add to PROVIDERS export
  sed -i "/^export const PROVIDERS:/a \  ${PROTO}: { name: '${DISPLAY}', fetch: fetch${PROTO^}Posts }," "$FEEDS_FILE"

  # Add to DEFAULT_PREFERENCES feedMixConfig.sources if it exists
  if grep -q "feedMixConfig" "$FEEDS_FILE"; then
    sed -i "/feedMixConfig/,/sources: \[/{
      /sources: \[/a\        '${PROTO}',
    }" "$FEEDS_FILE"
  fi

  echo "  ✅ Registered in feeds.ts"
fi

# ─── 3. Add to Protocol type union ────────────────────────────────────
if grep -q "| '${PROTO}'" "$TYPES_FILE" 2>/dev/null; then
  echo "  ⏭️  Already in Protocol union"
else
  sed -i "/^export type Protocol =/a\  | '${PROTO}'" "$TYPES_FILE"
  echo "  ✅ Added to Protocol type"
fi

# ─── 4. Add PLATFORM_TIER entry ───────────────────────────────────────
if grep -q "${PROTO}:" "$SCORER_FILE" 2>/dev/null; then
  echo "  ⏭️  Already has PLATFORM_TIER entry"
else
  sed -i "/^const PLATFORM_TIER: Record<string, number> =/a\  ${PROTO}: ${TIER}," "$SCORER_FILE"
  echo "  ✅ Added PLATFORM_TIER entry (${TIER})"
fi

# ─── 5. Update PROVIDERS.md ───────────────────────────────────────────
COUNT=$(grep -c '^| [0-9]* |' "$PROVIDERS_MD" || echo "0")
NEW_COUNT=$((COUNT + 1))

cat >> "$PROVIDERS_MD" << ROW
| ${NEW_COUNT} | **${DISPLAY}** (NEW) | — | ${PROTO}.ts | — | 🔵 Beta | TODO |
ROW

echo "  ✅ Appended to PROVIDERS.md (now ${NEW_COUNT}+ protocols)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ${DISPLAY} scaffold complete!"
echo ""
echo "Next steps:"
echo "  1. Edit ${PROVIDER_FILE} — implement real API calls"
echo "  2. Add niche keywords in guessNiches()"
echo "  3. Test: curl http://localhost:4001/api/feed/${PROTO}"
echo "  4. Check lint: npx biome check --write ${PROVIDER_FILE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
