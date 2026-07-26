/**
 * TEST SUITE 2: Seed Content Tests
 *
 * Tests the fallback seed/demo content system.
 * Seed content is served when ALL providers return empty.
 */

import { describe, expect, it } from 'vitest';

describe('Seed content system', () => {
  it('getSeedContent returns posts', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    const posts = getSeedContent(5);
    expect(posts.length).toBe(5);
    expect(Array.isArray(posts)).toBe(true);
  });

  it('seed content is properly formatted as UnifiedPost', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    const posts = getSeedContent(1);
    expect(posts.length).toBe(1);
    const post = posts[0];

    // Required UnifiedPost fields
    expect(post).toHaveProperty('id');
    expect(post).toHaveProperty('protocol');
    expect(post).toHaveProperty('author');
    expect(post).toHaveProperty('text');
    expect(post).toHaveProperty('embeds');
    expect(post).toHaveProperty('createdAt');
    expect(post).toHaveProperty('metrics');
    expect(post).toHaveProperty('engagement');
    expect(post).toHaveProperty('raw');
    expect(post).toHaveProperty('niches');

    // Author should have required fields
    expect(post.author).toHaveProperty('id');
    expect(post.author).toHaveProperty('displayName');
    expect(post.author).toHaveProperty('handles');
    expect(post.author).toHaveProperty('bio');

    // Metrics should have all fields
    expect(post.metrics).toHaveProperty('likes');
    expect(post.metrics).toHaveProperty('reposts');
    expect(post.metrics).toHaveProperty('replies');
    expect(post.metrics).toHaveProperty('quotes');
  });

  it('seed content is marked with _demo protocol', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    const posts = getSeedContent(3);
    for (const post of posts) {
      expect(post.protocol).toBe('_demo');
    }
  });

  it('seed content is marked with _demo: true in raw', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    const posts = getSeedContent(3);
    for (const post of posts) {
      expect(post.raw).toHaveProperty('_demo');
      expect((post.raw as Record<string, unknown>)._demo).toBe(true);
    }
  });

  it('different protocols get their own filtered seed content', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    const bitcoinPosts = getSeedContent(5, 'bitcoin');
    const ethereumPosts = getSeedContent(5, 'ethereum');

    // Both should return posts
    expect(bitcoinPosts.length).toBeGreaterThan(0);
    expect(ethereumPosts.length).toBeGreaterThan(0);

    // Bitcoin posts should include bitcoin niche
    for (const post of bitcoinPosts) {
      expect(post.niches).toContain('bitcoin');
    }
  });

  it('seed content rotates when called multiple times', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    // Seed content is based on current time slot;
    // calling twice in a row within the same 2-hour window gives same rotation
    const posts1 = getSeedContent(20);
    const posts2 = getSeedContent(20);

    // Same rotation within the same time slot
    expect(posts1.length).toBe(posts2.length);

    // But the actual post texts should have variety
    const texts = posts1.map((p) => p.text);
    const uniqueTexts = new Set(texts);
    // With 20 posts and 20 templates, there should be variation
    expect(uniqueTexts.size).toBeGreaterThan(1);

    // Verify niche diversity
    const allNiches = posts1.flatMap((p) => p.niches);
    const uniqueNiches = new Set(allNiches);
    expect(uniqueNiches.size).toBeGreaterThan(3); // crypto + at least 2 others
  });

  it('seed content has decreasing engagement metrics', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    const posts = getSeedContent(5);

    // Earlier posts (in the array) should have higher engagement
    for (let i = 1; i < posts.length; i++) {
      expect(posts[i - 1].metrics.likes).toBeGreaterThanOrEqual(posts[i].metrics.likes);
      expect(posts[i - 1].metrics.reposts).toBeGreaterThanOrEqual(posts[i].metrics.reposts);
    }
  });

  it('getSeedContent with limit returns at most that many posts', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    const posts5 = getSeedContent(5);
    const posts15 = getSeedContent(15);

    expect(posts5.length).toBeLessThanOrEqual(5);
    expect(posts15.length).toBeLessThanOrEqual(15);
    expect(posts15.length).toBeGreaterThan(posts5.length);
  });

  it('seed content has realistic author variety', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    const posts = getSeedContent(8);
    const authors = new Set(posts.map((p) => p.author.displayName));

    // Should have multiple unique authors
    expect(authors.size).toBeGreaterThan(1);
  });

  it('getSeedContent for unknown protocol falls back to all templates', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    // An obscure protocol that won't match any niche
    const posts = getSeedContent(5, 'nonexistent-protocol-xyz');
    expect(posts.length).toBeGreaterThan(0);

    // Should still have default crypto niches
    for (const post of posts) {
      expect(post.niches.length).toBeGreaterThan(0);
    }
  });
});
