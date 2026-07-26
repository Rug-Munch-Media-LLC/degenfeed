/**
 * @degenfeed/api-worker — Lemmy Federated Community Discovery
 *
 * Returns communities discovered across the Lemmy fediverse with
 * live subscriber counts. Filterable by category, instance, and
 * subscriber threshold.
 *
 * Endpoints:
 *   GET /api/lemmy/discover — Discover federated communities
 *
 * Query params:
 *   category    — Filter by niche category (crypto, defi, nft, tech, trading,
 *                 security, privacy, gaming, art, science, etc.)
 *   instance    — Filter by instance domain (partial match)
 *   search      — Search communities by name
 *   min_subs    — Minimum subscriber count (default 0)
 *   sort        — Sort by: subscribers (default), active, posts, new
 *   limit       — Max results (default 50, max 100)
 */

import { discoverCommunities } from '@degenfeed/feed-providers';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

export async function handleLemmyDiscover(request: Request, _env: Env): Promise<Response> {
