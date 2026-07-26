/**
 * @degenfeed/api-worker — Multi-Protocol Purchase System
 *
 * Buy creator coins from ANY protocol. All purchases route through
 * DegenFeed's unified tipping/payment system.
 *
 * Protocol-specific purchase methods:
 *   - Nostr: NIP-57 zap → converts to coin purchase
 *   - Farcaster: frame with buy button → POST to purchase endpoint
 *   - Bluesky: link → DegenFeed buy page → purchase
 *   - Mastodon: toot with buy link → DegenFeed buy page
 *   - Lens: publication with collect module → collect triggers purchase
 *   - Telegram: bot command `/buy $TICKER` → purchase
 *   - Discord: slash command `/buy $TICKER` → purchase
 */

import type { Env } from '../types';
import { recordHolderPurchase, resolveWalletFromProtocol } from './cross-protocol-holder';

// ─── Types ──────────────────────────────────────────────────────────────

export type PurchaseRequest = {}
