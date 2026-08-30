/**
 * TEST SUITE 2: Seed Content Tests
 *
 * Tests the seed/demo content ban.
 *
 * Demo/seed content was removed 2026-08-06: `getSeedContent` ALWAYS returns
 * an empty list and logs a deprecation warning. We never serve fabricated
 * content under any circumstances — providers must return real content or
 * nothing. These tests assert that contract.
 */

import { describe, expect, it, vi } from 'vitest';

describe('Seed content system (banned)', () => {
  it('getSeedContent returns an empty array', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    const posts = getSeedContent(5);
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBe(0);
  });

  it('never returns fabricated demo posts regardless of limit', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    expect(getSeedContent(0).length).toBe(0);
    expect(getSeedContent(1).length).toBe(0);
    expect(getSeedContent(50).length).toBe(0);
  });

  it('returns empty for any requested protocol (no fake niche content)', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    expect(getSeedContent(5, 'bitcoin').length).toBe(0);
    expect(getSeedContent(5, 'ethereum').length).toBe(0);
    expect(getSeedContent(5, 'nonexistent-protocol-xyz').length).toBe(0);
  });

  it('never fabricates posts marked with the _demo protocol', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    const posts = getSeedContent(5);
    expect(posts.filter((p) => p.protocol === '_demo')).toHaveLength(0);
  });

  it('warns that seed content is deprecated on each call', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { getSeedContent } = await import('../server/seed-content');
      getSeedContent(5);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('feed fallback never produces a non-empty fabricated feed', async () => {
    const { getSeedContent } = await import('../server/seed-content');

    // The exact scenario that used to serve demo posts: all providers empty.
    const posts = getSeedContent(20);
    expect(posts).toEqual([]);
  });
});
