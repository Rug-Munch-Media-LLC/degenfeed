/**
 * @degenfeed/api-worker — Per-Protocol Coin Discovery
 *
 * Creator coins discoverable on each protocol with protocol-specific
 * formatting, metrics, and buy links.
 *
 * Endpoints:
 *   GET /api/coin/discover/:protocol/trending  — Trending coins on a protocol
 *   GET /api/coin/discover/:protocol/new        — Newest coins on a protocol
 *   GET /api/coin/discover/:protocol/search     — Search coins by ticker on a protocol
 *   GET /api/coin/discover/:protocol/:symbol    — Single coin protocol view
 *   GET /api/coin/discover/all                  — Aggregated across all protocols
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import type { Env } from '../types';

// ─── Router ─────────────────────────────────────────────────────────────

export const coinDiscovery = new Hono<{ Bindings: Env }>();

// ─── Constants ──────────────────────────────────────────────────────────

const COIN_PREFIX = 'coin:';
const SYMBOL_INDEX_PREFIX = 'coin:symbol:';
const PROTOCOL_COIN_INDEX = 'coin:protocol:';
const VALID_PROTOCOLS = new Set([
  'farcaster',
  'nostr',
  'bluesky',
  'lens',
  'mastodon',
  'activitypub',
  'telegram',
  'discord',
]);

// ─── KV helpers ─────────────────────────────────────────────────────────

async function kvGetJson<T>(kv: KVNamespace | undefined, key: string): Promise<T | null> {
