/**
 * Pixelfed Bridge Provider
 *
 * Expanded multi-endpoint fetcher for Pixelfed — the federated Instagram
 * alternative. In addition to delegating to the feed-providers adapter
 * (public timeline + federated instances + hashtag timelines), we fetch
 * account-statuses for the known accounts on our self-hosted instance so
 * every locally-published post surfaces even when the public timeline only
 * exposes media-optimized posts (unprocessed/medialess statuses are hidden
 * from /api/v1/timelines/public but appear in /api/v1/accounts/:id/statuses).
 *
 * Endpoints:
 * - /api/v1/timelines/public        — local + federated public timeline
 * - /api/v1/accounts/:id/statuses   — per-account statuses (local accounts)
 * - /api/v1/timelines/tag/:tag      — hashtag timelines
 * - /api/v1/discover/posts          — Pixelfed discover feed (best-effort)
 *
 * Auth: our self-hosted instance requires a Bearer token for the public
 * timeline. The token is read from PIXELFED_ACCESS_TOKEN (bridge/.env) and
 * passed through to the provider by the SDK.
 */
import type { SchemaGuard, UnifiedPost } from '../server/types';
import {
  getAccountPosts,
  getPublicTimeline,
  getTagTimeline,
  normalizePixelfedPost,
  PIXELFED_LOCAL_INSTANCE,
} from '@degenfeed/pixelfed-sdk';

const PIXELFED_BASE_URL = process.env.PIXELFED_BASE_URL || PIXELFED_LOCAL_INSTANCE;

/** Known local accounts on our self-hosted Pixelfed instance. */
const LOCAL_ACCOUNTS = [
  { id: '986303183066632193', username: 'photos_admin' },
  { id: '986310652953378817', username: 'testphoto' },
];

/** Crypto/photo hashtags to try on the local + federated instances. */
const HASHTAGS = [
  'bitcoin',
  'ethereum',
  'solana',
  'crypto',
  'nft',
  'defi',
  'web3',
  'photography',
  'art',
  'landscape',
  // Additional hashtags (2026-08-04) — AI, tech and photo communities for
  // a broader mix beyond the crypto niche.
  'blockchain',
  'ai',
  'technology',
  'space',
  'travel',
  'nature',
  'streetphotography',
  'architecture',
  'minimalism',
  'city',
];

let _adapter: typeof import('@degenfeed/feed-providers') | null = null;
async function getAdapter() {
  if (!_adapter) {
    _adapter = await import('@degenfeed/feed-providers');
  }
  return _adapter;
}

export const schema: SchemaGuard = {
  id: 'pixelfed',
  name: 'Pixelfed',
  description: 'Decentralized image sharing on ActivityPub — multi-endpoint fetcher',
  endpoint: '/api/feed/pixelfed',
  requiresAuth: false,
  contentType: 'image',
};

function toUnified(status: import('@degenfeed/pixelfed-sdk').PixelfedStatus): UnifiedPost {
  const post = normalizePixelfedPost(status, PIXELFED_BASE_URL);
  post.contentType = status.media_attachments?.some((m) => m.type === 'video') ? 'video' : 'image';
  return post;
}

export async function fetchPixelfedPosts(limit = 20): Promise<UnifiedPost[]> {
  const accessToken = process.env.PIXELFED_ACCESS_TOKEN;
  const all: UnifiedPost[] = [];

  // ── 1. Delegated adapter: local timeline + federated instances + hashtags ──
  try {
    const { PixelfedProvider } = await getAdapter();
    const provider = new PixelfedProvider({
      instanceUrl: PIXELFED_BASE_URL,
      accessToken,
    });
    const result = await provider.fetchFeed({ timeoutMs: 10000 });
    if (result.posts?.length) all.push(...result.posts);
  } catch (err) {
    // console.log(`[bridge] Pixelfed adapter error: ${(err as Error).message}`);
  }

  // ── 2. Account-statuses for known local accounts ──
  // The public timeline hides posts whose media hasn't been optimized yet;
  // /api/v1/accounts/:id/statuses returns every public status regardless.
  const accountResults = await Promise.allSettled(
    LOCAL_ACCOUNTS.map(async (acct) => {
      const statuses = await getAccountPosts(PIXELFED_BASE_URL, acct.id, limit, accessToken);
      return statuses.map(toUnified);
    }),
  );
  for (const r of accountResults) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // ── 3. Local public timeline (media-only first) ──
  try {
    const statuses = await getPublicTimeline(PIXELFED_BASE_URL, {
      limit: Math.min(limit, 40),
      onlyMedia: true,
      local: true,
      accessToken,
    });
    all.push(...statuses.map(toUnified));
  } catch (err) {
    // console.log(`[bridge] Pixelfed local timeline error: ${(err as Error).message}`);
  }

  // ── 4. Hashtag timelines on the local instance (best-effort) ──
  const tagResults = await Promise.allSettled(
    HASHTAGS.slice(0, 8).map(async (tag) => {
      const statuses = await getTagTimeline(PIXELFED_BASE_URL, tag, 5, accessToken);
      return statuses.map(toUnified);
    }),
  );
  for (const r of tagResults) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // ── 5. Deduplicate by id (and by native text for cross-source dupes) ──
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    const key = p.id || p.text.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
    if (deduped.length >= limit) break;
  }

  // console.log(`[bridge] Pixelfed: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchPixelfedPosts;
