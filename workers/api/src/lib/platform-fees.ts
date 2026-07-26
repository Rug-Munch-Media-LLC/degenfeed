/**
 * @degenfeed/api-worker — Platform Fee Configuration
 *
 * DegenFeed charges a flat 0.5% fee on all creator revenue events:
 * - Tips (any protocol)
 * - Creator coin trades (buys)
 * - Stream tips
 * - Live short tips
 * - Community tips
 * - NFT mints (first-party)
 * - Subscription payments
 *
 * The fee is always disclosed before the transaction. Creators can see
 * exactly how much we take on every event. No hidden fees, no surprises.
 */

export const PLATFORM_FEE_BPS = 50; // 0.5% — always transparent

/**
 * Revenue event types where the platform fee applies.
 * Each event includes a human-readable label for disclosure UIs.
 */
export const FEE_EVENTS = [
  { type: 'tip', label: 'Tips', description: 'Cross-platform tips' },
  {
