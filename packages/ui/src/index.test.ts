/**
 * @degenfeed/ui — component tests
 */

import { beforeAll, describe, expect, it } from 'vitest';
import {
  PROTOCOL_COLORS,
  PROTOCOL_ICONS,
  PROTOCOL_LABELS,
  getProtocolColor,
  getProtocolIcon,
  getProtocolLabel,
} from './ProtocolBadge';

describe('ProtocolBadge', () => {
  it('should have colors for all 7 protocols', () => {
    const protocols = ['nostr', 'farcaster', 'lens', 'bluesky', 'threads', 'mastodon', 'rss'];
    for (const p of protocols) {
      expect(PROTOCOL_COLORS[p]).toBeDefined();
      expect(PROTOCOL_LABELS[p]).toBeDefined();
      expect(PROTOCOL_ICONS[p]).toBeDefined();
    }
  });

  it('getProtocolColor should return correct colors', () => {
    expect(getProtocolColor('nostr')).toBe('#8e30eb');
    expect(getProtocolColor('bluesky')).toBe('#1185fe');
    expect(getProtocolColor('unknown')).toBe('#666');
  });

  it('getProtocolLabel should return correct labels', () => {
    expect(getProtocolLabel('nostr')).toBe('Nostr');
    expect(getProtocolLabel('farcaster')).toBe('Farcaster');
    expect(getProtocolLabel('unknown')).toBe('unknown');
  });

  it('getProtocolIcon should return correct icons', () => {
    expect(getProtocolIcon('lens')).toBeDefined();
    expect(getProtocolIcon('unknown')).toBe('?');
  });
});

describe('Component exports', () => {
  // Verify all component exports exist at module level
  let mod: Record<string, unknown>;

  beforeAll(async () => {
    mod = await import('./index');
  });

  it('should export ErrorBoundary', () => {
    expect(mod.ErrorBoundary).toBeDefined();
  });

  it('should export PostCard', () => {
    expect(mod.PostCard).toBeDefined();
  });

  it('should export FeedList', () => {
    expect(mod.FeedList).toBeDefined();
  });

  it('should export ComposeModal', () => {
    expect(mod.ComposeModal).toBeDefined();
  });

  it('should export SignInModal', () => {
    expect(mod.SignInModal).toBeDefined();
  });

  it('should export ProtocolBadge', () => {
    expect(mod.ProtocolBadge).toBeDefined();
  });
});
