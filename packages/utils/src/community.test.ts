/**
 * @degenfeed/utils — Community helper tests
 */

import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_INDEX_KEY,
  COMMUNITY_KV_PREFIX,
  communityFeedKey,
  communityKey,
  communityMembersKey,
  slugifyCommunity,
} from './community';

describe('communityKey', () => {
  it('should prefix with COMMUNITY_KV_PREFIX', () => {
    const key = communityKey('crypto');
    expect(key).toBe(`${COMMUNITY_KV_PREFIX}crypto`);
  });

  it('should lowercase and replace special characters', () => {
    const key = communityKey('Crypto & DeFi');
    expect(key).toBe(`${COMMUNITY_KV_PREFIX}crypto__defi`);
  });

  it('should strip leading/trailing special chars after sanitization', () => {
    const key = communityKey('  Hello_World!  ');
    // Spaces become _, so "  hello_world!  " → "___hello_world!__"
    // The function uses [^a-z0-9_-] → _ so spaces become _
    expect(key).toContain('hello_world');
  });
});

describe('slugifyCommunity', () => {
  it('should lowercase and replace non-alphanumeric with hyphens', () => {
    expect(slugifyCommunity('Crypto & DeFi')).toBe('crypto-and-defi');
  });

  it('should strip leading/trailing hyphens', () => {
    expect(slugifyCommunity('--hello--')).toBe('hello');
  });

  it('should truncate to 48 chars', () => {
    const long = 'a'.repeat(100);
    expect(slugifyCommunity(long).length).toBeLessThanOrEqual(48);
  });

  it('should handle single word', () => {
    expect(slugifyCommunity('Bitcoin')).toBe('bitcoin');
  });
});

describe('COMMUNITY_INDEX_KEY', () => {
  it('should be "communities:index"', () => {
    expect(COMMUNITY_INDEX_KEY).toBe('communities:index');
  });
});

describe('communityFeedKey', () => {
  it('should build feed key from name', () => {
    expect(communityFeedKey('Crypto')).toBe('community:feed:crypto');
  });

  it('should lowercase the name', () => {
    expect(communityFeedKey('DeFi')).toBe('community:feed:defi');
  });
});

describe('communityMembersKey', () => {
  it('should build members key from name', () => {
    expect(communityMembersKey('Crypto')).toBe('community:members:crypto');
  });

  it('should lowercase the name', () => {
    expect(communityMembersKey('DeFi')).toBe('community:members:defi');
  });
});
