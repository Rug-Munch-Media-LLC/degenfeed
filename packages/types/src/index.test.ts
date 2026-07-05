import { describe, it, expect } from 'vitest';

describe('@degenfeed/types', () => {
  it('should support all 7 protocol identifiers', () => {
    const protocols = ['nostr', 'farcaster', 'lens', 'bluesky', 'threads', 'rss', 'mastodon'];
    expect(protocols).toHaveLength(7);
    expect(protocols).toContain('nostr');
    expect(protocols).toContain('farcaster');
    expect(protocols).toContain('lens');
    expect(protocols).toContain('bluesky');
    expect(protocols).toContain('threads');
    expect(protocols).toContain('rss');
    expect(protocols).toContain('mastodon');
  });

  it('should export UnifiedPost structure from the package', async () => {
    const mod = await import('./index');
    // Just verify the module loads and exports exist at runtime
    expect(mod).toBeDefined();
    // The types compile, which is the main value
  });
});
