/**
 * @degenfeed/ui — component tests
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

// Mock the storage module to avoid IndexedDB in test environment
vi.mock('@degenfeed/storage', () => ({
  addBookmark: vi.fn().mockResolvedValue(undefined),
  removeBookmark: vi.fn().mockResolvedValue(undefined),
  getBookmarks: vi.fn().mockResolvedValue([]),
  isBookmarked: vi.fn().mockResolvedValue(false),
  saveFollow: vi.fn().mockResolvedValue(undefined),
  deleteFollow: vi.fn().mockResolvedValue(undefined),
  getFollows: vi.fn().mockResolvedValue([]),
  isFollowing: vi.fn().mockResolvedValue(false),
  muteAuthor: vi.fn().mockResolvedValue(undefined),
  unmuteAuthor: vi.fn().mockResolvedValue(undefined),
  getMutedAuthors: vi.fn().mockResolvedValue([]),
  isAuthorMuted: vi.fn().mockResolvedValue(false),
  muteWord: vi.fn().mockResolvedValue(undefined),
  unmuteWord: vi.fn().mockResolvedValue(undefined),
  isWordMuted: vi.fn().mockResolvedValue(false),
  saveIdentity: vi.fn().mockResolvedValue(undefined),
  saveDraft: vi.fn().mockResolvedValue(undefined),
  getDrafts: vi.fn().mockResolvedValue([]),
  saveMonetizationPreferences: vi.fn().mockResolvedValue(undefined),
  savePreferences: vi.fn().mockResolvedValue(undefined),
  getAllIdentities: vi.fn().mockResolvedValue([]),
  getPrimaryIdentity: vi.fn().mockResolvedValue(undefined),
  setPrimaryIdentity: vi.fn().mockResolvedValue(undefined),
  deleteIdentity: vi.fn().mockResolvedValue(undefined),
}));

import {
  getProtocolColor,
  getProtocolIcon,
  getProtocolLabel,
  PROTOCOL_COLORS,
  PROTOCOL_ICONS,
  PROTOCOL_LABELS,
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
