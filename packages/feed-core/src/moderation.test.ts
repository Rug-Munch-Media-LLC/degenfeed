/**
 * @degenfeed/feed-core — Moderation tests
 */

import { describe, expect, it } from 'vitest';
import {
  checkText,
  DEFAULT_THRESHOLDS,
  isUserBanned,
  SCAM_KEYWORDS,
  SPAM_PATTERN_REGEXES,
} from './moderation';

describe('DEFAULT_THRESHOLDS', () => {
  it('should have reasonable default values', () => {
    expect(DEFAULT_THRESHOLDS.autoFlagScore).toBe(0.8);
    expect(DEFAULT_THRESHOLDS.autoRejectScore).toBe(0.9);
    expect(DEFAULT_THRESHOLDS.autoHideReportCount).toBe(5);
    expect(DEFAULT_THRESHOLDS.autoHideMinReporters).toBe(3);
    expect(DEFAULT_THRESHOLDS.autoHideWindowMs).toBe(24 * 60 * 60 * 1000);
  });

  it('should have autoFlagScore less than autoRejectScore', () => {
    expect(DEFAULT_THRESHOLDS.autoFlagScore).toBeLessThan(DEFAULT_THRESHOLDS.autoRejectScore);
  });
});

describe('SCAM_KEYWORDS', () => {
  it('should contain giveaway scam patterns', () => {
    expect(SCAM_KEYWORDS).toContain('giveaway');
    expect(SCAM_KEYWORDS).toContain('double your');
  });

  it('should contain wallet phishing patterns', () => {
    expect(SCAM_KEYWORDS).toContain('verify wallet');
    expect(SCAM_KEYWORDS).toContain('connect wallet');
  });

  it('should contain crypto-specific scams', () => {
    expect(SCAM_KEYWORDS).toContain('airdrop claim');
    expect(SCAM_KEYWORDS).toContain('pump group');
  });
});

describe('SPAM_PATTERN_REGEXES', () => {
  it('should export an array of regex patterns', () => {
    expect(Array.isArray(SPAM_PATTERN_REGEXES)).toBe(true);
    expect(SPAM_PATTERN_REGEXES.length).toBeGreaterThan(0);
  });

  it('should contain compiled RegExp objects', () => {
    for (const re of SPAM_PATTERN_REGEXES) {
      expect(re).toBeInstanceOf(RegExp);
    }
  });
});

describe('checkText', () => {
  it('should be a function', () => {
    expect(typeof checkText).toBe('function');
  });

  it('should return a ModerationCheckResult for clean text', () => {
    const result = checkText('This is a clean post about blockchain technology');
    expect(result).toBeDefined();
    expect(typeof result.shouldFlag).toBe('boolean');
    expect(typeof result.shouldReject).toBe('boolean');
    expect(typeof result.spamScore).toBe('number');
  });
});

describe('isUserBanned', () => {
  it('should be a function', () => {
    expect(typeof isUserBanned).toBe('function');
  });

  it('should return false for an empty ban list', () => {
    expect(isUserBanned('user123', [])).toBe(false);
  });

  it('should return true for a banned user', () => {
    const banList = [
      { userId: 'user123', reason: 'spam', bannedAt: Date.now() },
    ];
    expect(isUserBanned('user123', banList)).toBe(true);
  });

  it('should return false for a non-banned user', () => {
    const banList = [
      { userId: 'spammer1', reason: 'spam', bannedAt: Date.now() },
    ];
    expect(isUserBanned('innocent_user', banList)).toBe(false);
  });
});
