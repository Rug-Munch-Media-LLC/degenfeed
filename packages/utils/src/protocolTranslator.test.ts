/**
 * @degenfeed/utils — Protocol translator tests
 */

import { describe, expect, it } from 'vitest';
import { estimateTranslationLoss, PROTOCOL_FORMATS, translateContent } from './protocolTranslator';

describe('PROTOCOL_FORMATS', () => {
  it('should define formats for all supported protocols', () => {
    const protocols = ['nostr', 'farcaster', 'lens', 'mastodon', 'bluesky', 'lemmy'];
    for (const p of protocols) {
      expect(PROTOCOL_FORMATS[p]).toBeDefined();
      expect(PROTOCOL_FORMATS[p]!.maxLength).toBeGreaterThan(0);
    }
  });

  it('should have lens as the longest maxLength', () => {
    const lens = PROTOCOL_FORMATS.lens!.maxLength;
    const others = Object.values(PROTOCOL_FORMATS).map((f) => f.maxLength);
    expect(lens).toBe(Math.max(...others));
  });

  it('should only support markdown on lens and lemmy', () => {
    expect(PROTOCOL_FORMATS.lens!.supportsMarkdown).toBe(true);
    expect(PROTOCOL_FORMATS.lemmy!.supportsMarkdown).toBe(true);
    expect(PROTOCOL_FORMATS.nostr!.supportsMarkdown).toBe(false);
    expect(PROTOCOL_FORMATS.farcaster!.supportsMarkdown).toBe(false);
  });
});

describe('translateContent', () => {
  it('should return original content for unknown target protocol', () => {
    const result = translateContent('Hello', 'nostr', 'unknown');
    expect(result.translated).toBe('Hello');
    expect(result.warning).toContain('Unknown target protocol');
  });

  it('should strip markdown when target does not support it', () => {
    const result = translateContent('**bold** and *italic*', 'lens', 'nostr');
    expect(result.translated).not.toContain('**');
    expect(result.translated).not.toContain('*');
    expect(result.strippedMarkdown).toBe(true);
  });

  it('should not strip markdown when target supports it', () => {
    const result = translateContent('**bold** text', 'nostr', 'lens');
    expect(result.translated).toContain('**bold**');
    expect(result.strippedMarkdown).toBe(false);
  });

  it('should strip $DEGEN mentions from farcaster content', () => {
    const result = translateContent('Nice post $DEGEN', 'farcaster', 'nostr');
    expect(result.translated).not.toContain('$DEGEN');
    expect(result.removedProtocolElements).toContain('$DEGEN (×1)');
  });

  it('should remove /tip commands from farcaster content', () => {
    const result = translateContent('Great take /tip 100', 'farcaster', 'nostr');
    expect(result.translated).not.toContain('/tip');
  });

  it('should truncate to target max length', () => {
    const longContent = 'A very long post. '.repeat(50);
    const result = translateContent(longContent, 'lens', 'nostr');
    expect(result.truncated).toBe(true);
    expect(result.translated.length).toBeLessThanOrEqual(result.maxLength + 50); // allow footer
  });

  it('should add bridge attribution footer', () => {
    const result = translateContent('Hello', 'nostr', 'farcaster');
    expect(result.translated).toContain('DegenFeed');
    expect(result.translated).toContain('Nostr');
    expect(result.translated).toContain('Farcaster');
  });

  it('should replace npub references from nostr content', () => {
    const result = translateContent('Thanks npub1abc123def456xyz', 'nostr', 'bluesky');
    expect(result.translated).toContain('[nostr user]');
  });

  it('should strip AT URI from bluesky content', () => {
    const result = translateContent('Check at://did:plc:abc123/app.bsky.feed.post/1', 'bluesky', 'nostr');
    expect(result.translated).toContain('[bluesky post]');
  });

  it('should strip Lens Hub URLs', () => {
    const result = translateContent('See https://hub.lens.xyz/post/123', 'lens', 'nostr');
    expect(result.translated).not.toContain('https://hub.lens.xyz');
  });

  it('should handle empty content', () => {
    const result = translateContent('', 'nostr', 'farcaster');
    expect(result.translated).toContain('DegenFeed');
    expect(result.originalLength).toBe(0);
  });
});

describe('estimateTranslationLoss', () => {
  it('should return null for same protocol', () => {
    expect(estimateTranslationLoss('Hello', 'nostr', 'nostr')).toBeNull();
  });

  it('should return null for unknown target protocol', () => {
    expect(estimateTranslationLoss('Hello', 'nostr', 'unknown')).toBeNull();
  });

  it('should return null when content fits target maxLength', () => {
    expect(estimateTranslationLoss('Hi', 'nostr', 'farcaster')).toBeNull();
  });

  it('should return warning when content exceeds target maxLength by >20%', () => {
    const longContent = 'x'.repeat(PROTOCOL_FORMATS.nostr!.maxLength * 2);
    const warning = estimateTranslationLoss(longContent, 'lens', 'nostr');
    expect(warning).not.toBeNull();
    expect(warning).toContain('truncated');
  });

  it('should return strong warning when content exceeds target by >50%', () => {
    const veryLong = 'x'.repeat(PROTOCOL_FORMATS.nostr!.maxLength * 5);
    const warning = estimateTranslationLoss(veryLong, 'lens', 'nostr');
    expect(warning).not.toBeNull();
    expect(warning).toContain('lose');
  });
});
