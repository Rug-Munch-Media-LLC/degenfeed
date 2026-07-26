/**
 * Scheduled cron handler — fires via wrangler.toml [triggers].
 *
 * Cron schedules:
 *   every-30-min — Trending content scraper
 *   daily-14:00  — Daily digest email + trending refresh
 *
 * The dispatcher in index.ts checks the cron trigger and routes here.
 *
 * Daily digest:
 *   1. Builds the multi-protocol daily digest (Nostr→Bluesky→Mastodon→RSS).
 *   2. Pulls all newsletter subscribers from KV.
 *   3. Sends the digest via Postmark email (or logs summary).
 *   4. Also refreshes trending content.
 *
 * Trending-only tick:
 *   1. Scrapes all platforms for trending content.
 *   2. Caches in KV for 1 hour.
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';
import { scrapeTrendingContent } from './trending-scraper';

export async function handleCron(env: Env): Promise<Response> {
