/**
 * @degenfeed/api-worker — Telegram Group Chat Bridge
 *
 * Bridges Telegram groups to DegenFeed social feeds:
 *   1. Subscribe — group messages appear in DegenFeed (opt-in by group owner)
 *   2. Cross-post — DegenFeed posts auto-publish to Telegram groups
 *   3. Creator coin chat — every creator coin gets an auto-created Telegram group
 *   4. Tipping — users tip each other in Telegram groups via Lightning
 *   5. Token-gated groups — require minimum coin holdings to join
 *
 * KV Keys:
 *   telegram:group:{groupId}                   — Group config
 *   telegram:group:feed:{groupId}:{msgId}      — Bridged message
 *   telegram:group:tip:{groupId}:{txId}        — Tip record
 *   telegram:coingroup:{symbol}                — Coin→Group mapping
 *   telegram:gatelist:{groupId}:{userId}       — Token gate verification
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TelegramGroupBridgeConfig = {}
