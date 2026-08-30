/**
 * TEST SUITE: RSS news feed freshness + bias diversity (Ground News killer)
 *
 * Verifies the fixes from the feed-quality overhaul:
 *  1. Freshness policy — max-age filter, <2h boost (+30%), 24-48h stale
 *     penalty (-50%), all env-configurable with sane defaults.
 *  2. Bias classification — SOURCE_BIAS_SCORE matches the curated spec
 *     (CoinDesk +0.2, CoinTelegraph 0.0, The Block -0.1, ZeroHedge +0.8, ...).
 *  3. Bias diversity — ensureBiasDiversity interleaves left/center/right,
 *     biasDisplayLabel emits 🟦 Left / 🟨 Center / 🟥 Right, and
 *     computeBiasDistribution returns the meta counts.
 */

import { describe, expect, it } from 'vitest';
import type { UnifiedPost } from '../server/types';

function post(
  id: string,
  label: string,
  opts: { ageHours?: number; rank?: number } = {},
): UnifiedPost {
  const now = Date.now();
  const ageMs = (opts.ageHours ?? 1) * 3_600_000;
  return {
    id,
    protocol: 'rss',
    author: {
      id: `rss:${label}`,
      primary: { protocol: 'rss', id: label },
      handles: { rss: label },
      displayName: label,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: `headline ${id}`,
    embeds: [{ kind: 'link', url: `https://example.com/${id}` }],
    createdAt: now - ageMs,
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: { feedLabel: label },
    niches: ['crypto'],
  };
}

describe('RSS freshness policy', () => {
  it('has the spec defaults (48h max age, 2h boost, 24h stale, ±30%/-50%)', async () => {
    const mod = await import('../providers/rss');
    expect(mod.FEED_MAX_AGE_HOURS).toBe(48);
    expect(mod.FEED_FRESH_BOOST_HOURS).toBe(2);
    expect(mod.FEED_FRESH_BOOST_MULT).toBe(1.3);
    expect(mod.FEED_STALE_HOURS).toBe(24);
    expect(mod.FEED_STALE_PENALTY_MULT).toBe(0.5);
  });

  it('rejects posts older than the 48h max-age window', async () => {
    const { isFreshEnough } = await import('../providers/rss');
    const now = Date.now();
    expect(isFreshEnough(now - 47 * 3_600_000, now)).toBe(true);
    expect(isFreshEnough(now - 49 * 3_600_000, now)).toBe(false);
    // No date -> "now", so a fresh timestamp passes
    expect(isFreshEnough(now - 1_000, now)).toBe(true);
  });

  it('applies a +30% boost to posts <2h old and -50% penalty to 24-48h posts', async () => {
    const { rankNewsPost } = await import('../providers/rss');
    const now = Date.now();
    const fresh = post('fresh', 'CoinTelegraph', { ageHours: 0.5 });
    const mid = post('mid', 'CoinTelegraph', { ageHours: 8 });
    const stale = post('stale', 'CoinTelegraph', { ageHours: 30 });

    const rFresh = rankNewsPost(fresh, now);
    const rMid = rankNewsPost(mid, now);
    const rStale = rankNewsPost(stale, now);

    // Fresh > mid (boost) and stale << mid (penalty)
    expect(rFresh).toBeGreaterThan(rMid);
    expect(rStale).toBeLessThan(rMid);
    // Signals recorded for transparency
    const rawStale = stale.raw as Record<string, unknown>;
    expect((rawStale.rankSignals as Record<string, number>).stalePenalty).toBe(0.5);
    const rawFresh = fresh.raw as Record<string, unknown>;
    expect((rawFresh.rankSignals as Record<string, number>).freshnessBoost).toBe(0.3);
  });

  it('rankNewsPosts filters out posts older than the max age', async () => {
    const { rankNewsPosts } = await import('../providers/rss');
    const old = post('old', 'CoinTelegraph', { ageHours: 100 });
    const newP = post('new', 'CoinTelegraph', { ageHours: 1 });
    const out = rankNewsPosts([old, newP]);
    expect(out.map((p) => p.id)).not.toContain('old');
    expect(out.map((p) => p.id)).toContain('new');
  });
});

describe('RSS bias classification (SOURCE_BIAS_SCORE)', () => {
  it('matches the curated Ground-News-beating spec', async () => {
    const { SOURCE_BIAS_SCORE } = await import('../providers/rss');
    // Left-leaning
    expect(SOURCE_BIAS_SCORE.Vice).toBe(-0.6);
    expect(SOURCE_BIAS_SCORE.Motherboard).toBe(-0.6);
    expect(SOURCE_BIAS_SCORE['The Intercept']).toBe(-0.7);
    expect(SOURCE_BIAS_SCORE.Jacobin).toBe(-0.8);
    expect(SOURCE_BIAS_SCORE['The Nation']).toBe(-0.7);
    expect(SOURCE_BIAS_SCORE['Democracy Now']).toBe(-0.6);
    expect(SOURCE_BIAS_SCORE['The Guardian Tech']).toBe(-0.4);
    // Lean left
    expect(SOURCE_BIAS_SCORE.Decrypt).toBe(-0.1);
    expect(SOURCE_BIAS_SCORE['The Block']).toBe(-0.1);
    expect(SOURCE_BIAS_SCORE.TechCrunch).toBe(-0.1);
    expect(SOURCE_BIAS_SCORE.Wired).toBe(-0.2);
    expect(SOURCE_BIAS_SCORE['The Verge']).toBe(-0.1);
    // Center
    expect(SOURCE_BIAS_SCORE.CoinTelegraph).toBe(0.0);
    expect(SOURCE_BIAS_SCORE.Reuters).toBe(0.0);
    expect(SOURCE_BIAS_SCORE.AP).toBe(0.0);
    expect(SOURCE_BIAS_SCORE['Bloomberg Crypto']).toBe(-0.1);
    expect(SOURCE_BIAS_SCORE['WSJ Crypto']).toBe(0.1);
    expect(SOURCE_BIAS_SCORE.CoinDesk).toBe(0.2);
    // Lean right / right
    expect(SOURCE_BIAS_SCORE['Bitcoin Magazine']).toBe(0.6);
    expect(SOURCE_BIAS_SCORE.Coinspeaker).toBe(0.3);
    expect(SOURCE_BIAS_SCORE['Bitcoin.com News']).toBe(0.4);
    expect(SOURCE_BIAS_SCORE.Blockworks).toBe(0.2);
    expect(SOURCE_BIAS_SCORE.ZeroHedge).toBe(0.8);
    expect(SOURCE_BIAS_SCORE.Breitbart).toBe(0.9);
    expect(SOURCE_BIAS_SCORE['Daily Caller']).toBe(0.7);
  });

  it('sourceBiasScore resolves explicit overrides and label defaults', async () => {
    const { sourceBiasScore } = await import('../providers/rss');
    expect(sourceBiasScore('The Verge')).toBe(-0.1);
    expect(sourceBiasScore('ZeroHedge')).toBe(0.8);
    // Unknown source defaults to center (0)
    expect(sourceBiasScore('No Such Feed')).toBe(0);
    expect(sourceBiasScore(undefined)).toBe(0);
  });
});

describe('RSS bias diversity ranking', () => {
  it('biasDisplayLabel emits the emoji 3-bucket labels', async () => {
    const { biasDisplayLabel } = await import('../providers/rss');
    expect(biasDisplayLabel('The Intercept')).toBe('🟦 Left');
    expect(biasDisplayLabel('CoinTelegraph')).toBe('🟨 Center');
    expect(biasDisplayLabel('ZeroHedge')).toBe('🟥 Right');
  });

  it('computeBiasDistribution counts left/center/right', async () => {
    const { computeBiasDistribution } = await import('../providers/rss');
    const posts = [
      post('1', 'The Intercept'),
      post('2', 'The Nation'),
      post('3', 'CoinTelegraph'),
      post('4', 'Reuters'),
      post('5', 'ZeroHedge'),
    ];
    const dist = computeBiasDistribution(posts);
    expect(dist).toEqual({ left: 2, center: 2, right: 1 });
  });

  it('ensureBiasDiversity keeps the top-ranked headline and balances buckets', async () => {
    const { ensureBiasDiversity } = await import('../providers/rss');
    // 9 center + 9 right posts with ranks; 3 left posts. The headline (rank 1)
    // must stay first regardless of bucket.
    const posts: UnifiedPost[] = [
      ...Array.from({ length: 9 }, (_, i) => post(`c${i}`, 'CoinTelegraph', { rank: 100 - i })),
      ...Array.from({ length: 9 }, (_, i) => post(`r${i}`, 'ZeroHedge', { rank: 90 - i })),
      ...Array.from({ length: 3 }, (_, i) => post(`l${i}`, 'The Intercept', { rank: 50 - i })),
    ];
    const out = ensureBiasDiversity(posts, 12, 2);
    expect(out.length).toBe(12);
    // Headline preserved
    expect(out[0]!.id).toBe(posts[0]!.id);
    const { computeBiasDistribution, biasDisplayLabel } = await import('../providers/rss');
    const dist = computeBiasDistribution(out);
    // At least the minimum per bucket is present after interleave
    expect(dist.left).toBeGreaterThanOrEqual(1);
    expect(dist.right).toBeGreaterThanOrEqual(1);
    // Every post in the returned feed carries an emoji label
    for (const p of out) {
      const raw = p.raw as { feedLabel?: string } | undefined;
      const label = biasDisplayLabel(raw?.feedLabel ?? p.author?.displayName);
      expect(label).toMatch(/^[🟦🟨🟥] /u);
    }
  });
});
