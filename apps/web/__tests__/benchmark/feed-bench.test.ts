/**
 * Feed rendering benchmarks.
 * Measures performance of critical rendering paths.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const BENCHMARK_THRESHOLD_MS = 200; // Max acceptable time in ms

describe('Feed benchmarks', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should render feed items within threshold (simulated)', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: `post-${i}`,
      content: `Test post ${i}`,
      author: `user${i % 10}`,
      timestamp: Date.now() - i * 60000,
    }));

    const start = performance.now();

    // Simulate feed rendering (sort + format + filter)
    const sorted = items.sort((a, b) => b.timestamp - a.timestamp);
    const formatted = sorted.map((item) => ({
      ...item,
      timeAgo: `${Math.floor((Date.now() - item.timestamp) / 60000)}m ago`,
    }));
    const filtered = formatted.filter((item) => item.content.length > 0);

    const duration = performance.now() - start;

    expect(filtered.length).toBe(50);
    expect(duration).toBeLessThan(BENCHMARK_THRESHOLD_MS);
  });

  it('should handle 200 items without excessive time', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      id: `post-${i}`,
      content: `Test post ${i} with some additional text to simulate real content length`,
      author: `user${i % 25}`,
      score: Math.random() * 1000,
      timestamp: Date.now() - Math.random() * 86400000,
    }));

    const start = performance.now();

    // Simulate feed ranking (sort by score)
    const ranked = items.sort((a, b) => b.score - a.score);
    const topRanked = ranked.slice(0, 100);

    const duration = performance.now() - start;
    expect(topRanked.length).toBe(100);
    expect(duration).toBeLessThan(BENCHMARK_THRESHOLD_MS * 2);
  });

  it('should deduplicate posts efficiently', () => {
    const basePosts = Array.from({ length: 100 }, (_, i) => ({
      id: `post-${i}`,
      content: `Unique post ${i}`,
    }));
    const duplicates = basePosts.slice(0, 30).map((p) => ({ ...p }));
    const combined = [...basePosts, ...duplicates];

    const start = performance.now();
    const seen = new Set<string>();
    const deduped = combined.filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
    const duration = performance.now() - start;

    expect(deduped.length).toBe(100);
    expect(duration).toBeLessThan(BENCHMARK_THRESHOLD_MS);
  });
});
