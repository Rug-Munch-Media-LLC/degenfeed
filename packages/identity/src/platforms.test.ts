/**
 * @degenfeed/identity — External platform registry tests
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_LINKABLE_PLATFORMS,
  EXTERNAL_PLATFORMS,
  extractHandleFromUrl,
  getPlatformMeta,
  isExternalPlatform,
  isVerifyablePlatform,
  VERIFYABLE_PLATFORMS,
} from './platforms';

describe('platform registry', () => {
  it('should expose all external platforms', () => {
    expect(Object.keys(EXTERNAL_PLATFORMS).sort()).toEqual([
      'discord',
      'github',
      'telegram',
      'twitter',
      'youtube',
    ]);
  });

  it('should expose all verifyable platforms', () => {
    expect(Object.keys(VERIFYABLE_PLATFORMS).sort()).toEqual([
      'bluesky',
      'farcaster',
      'lens',
      'mastodon',
      'nostr',
    ]);
  });

  it('should list every platform in ALL_LINKABLE_PLATFORMS', () => {
    expect(ALL_LINKABLE_PLATFORMS).toHaveLength(10);
    const ids = ALL_LINKABLE_PLATFORMS.map((p) => p.id);
    expect(ids).toContain('nostr');
    expect(ids).toContain('bluesky');
    expect(ids).toContain('twitter');
    expect(ids).toContain('youtube');
    expect(ids).toContain('github');
    expect(ids).toContain('discord');
    expect(ids).toContain('telegram');
  });

  it('should classify platform types', () => {
    expect(isExternalPlatform('twitter')).toBe(true);
    expect(isExternalPlatform('nostr')).toBe(false);
    expect(isVerifyablePlatform('nostr')).toBe(true);
    expect(isVerifyablePlatform('discord')).toBe(false);
  });

  it('should return metadata for known platforms and null otherwise', () => {
    expect(getPlatformMeta('nostr')?.label).toBe('Nostr');
    expect(getPlatformMeta('discord')?.label).toBe('Discord');
    expect(getPlatformMeta('unknown')).toBeNull();
  });

  it('should build canonical profile URLs', () => {
    expect(EXTERNAL_PLATFORMS.twitter.profileUrl?.('alice')).toBe('https://x.com/alice');
    expect(EXTERNAL_PLATFORMS.github.profileUrl?.('bob')).toBe('https://github.com/bob');
    expect(EXTERNAL_PLATFORMS.telegram.profileUrl?.('carol')).toBe('https://t.me/carol');
    expect(EXTERNAL_PLATFORMS.youtube.profileUrl?.('channel')).toBe('https://youtube.com/@channel');
  });
});

describe('extractHandleFromUrl', () => {
  it('should extract a username from a profile URL', () => {
    expect(extractHandleFromUrl('twitter', 'https://x.com/alice')).toBe('alice');
    expect(extractHandleFromUrl('twitter', '@bob')).toBe('bob');
    expect(extractHandleFromUrl('github', 'https://github.com/octocat/')).toBe('octocat');
    expect(extractHandleFromUrl('telegram', 'https://t.me/carol')).toBe('carol');
  });

  it('should pass through a bare handle', () => {
    expect(extractHandleFromUrl('github', 'octocat')).toBe('octocat');
    expect(extractHandleFromUrl('discord', 'alice#1234')).toBe('alice#1234');
  });
});
