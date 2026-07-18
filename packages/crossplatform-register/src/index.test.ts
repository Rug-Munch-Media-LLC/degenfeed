/**
 * @degenfeed/crossplatform-register — Tests
 */

import { describe, expect, it } from 'vitest';
import { platformAccountKey, platformAccountsIndexKey, registerOnPlatform } from './index';

describe('crossplatform-register', () => {
  describe('registerOnPlatform', () => {
    it('returns failed for unsupported platform', async () => {
      const result = await registerOnPlatform(
        'unknown',
        'testuser',
        '0x1234567890abcdef1234567890abcdef12345678',
        { walletAddress: '0x1234' },
      );
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Unsupported platform');
    });

    it('validates nostr key generation works without KV', async () => {
      const result = await registerOnPlatform(
        'nostr',
        'testuser',
        '0x1234567890abcdef1234567890abcdef12345678',
        { walletAddress: '0x1234' },
      );
      expect(result.status).toBe('created');
      expect(result.platform).toBe('nostr');
      expect(result.accountInfo?.npub).toBeDefined();
      expect(result.accountInfo?.pubkey).toBeDefined();
      expect(result.accountInfo?.npub).toMatch(/^npub1/);
    });

    it('returns failed for bluesky without invite pool', async () => {
      const result = await registerOnPlatform(
        'bluesky',
        'testuser',
        '0x1234567890abcdef1234567890abcdef12345678',
        { walletAddress: '0x1234' },
      );
      expect(result.status).toBe('failed');
      expect(result.error).toContain('No Bluesky invite codes available');
    });
  });

  describe('key helpers', () => {
    it('generates correct platform account key', () => {
      const key = platformAccountKey('0x1234567890abcdef1234567890abcdef12345678', 'farcaster');
      expect(key).toContain('platform:account');
      expect(key).toContain('0x1234567890abcdef1234567890abcdef12345678');
      expect(key).toContain('farcaster');
    });

    it('generates correct platform accounts index key', () => {
      const key = platformAccountsIndexKey('0x1234567890abcdef1234567890abcdef12345678');
      expect(key).toContain('platform:accounts');
    });

    it('lowercases wallet address in keys', () => {
      const mixed = platformAccountKey('0xABCdef123', 'lens');
      expect(mixed).toContain('0xabcdef123');
    });
  });
});
