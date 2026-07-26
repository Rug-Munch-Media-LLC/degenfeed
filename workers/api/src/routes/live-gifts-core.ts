/**
 * @degenfeed/api-worker — Live Gifts Core
 *
 * Gift/reward system for live streams. Telegram-like experience with crypto.
 * Viewers send gifts (paid in crypto), creators earn 85% (15% platform fee).
 *
 * Gift types with animations:
 *   🌹 Rose      — 100 sats  / $0.03
 *   🎈 Balloon   — 500 sats  / $0.15
 *   💎 Diamond   — 5,000 sats / $1.50
 *   🚀 Rocket    — 10,000 sats / $3.00
 *   👑 Crown     — 50,000 sats / $15.00
 *   🐳 Whale     — 100,000 sats / $30.00
 *
 * Integration with:
 *   - unified-tip-core.ts (records as tips in unified ledger)
 *   - stream-chat.ts (gift notifications in chat)
 *   - ws-broadcast.ts (real-time gift animation broadcast)
 *   - creator-rewards.ts (earnings accrual)
 *   - platform-fees.ts (fee collection)
 */

import type { Env } from '../types';

// ─── Gift Type Definitions ───────────────────────────────────────────────

export type GiftType = {}
