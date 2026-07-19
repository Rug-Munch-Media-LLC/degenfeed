/**
 * Tests for @degenfeed/telegram-sdk.
 *
 * These tests validate internal logic (formatting, types, error handling)
 * without making actual HTTP calls to the Telegram API.
 */

import { describe, it, expect } from 'vitest';
import { TGBotClient, TelegramError, TelegramRateLimitError } from './index';
import {
  formatForTelegram,
  stripUnsupportedTags,
  escapeMarkdownV2,
  escapeHtml,
  buildTelegramContent,
} from './markdown';

// ─── TGBotClient ───────────────────────────────────────────────────

describe('TGBotClient', () => {
  it('should construct with a bot token', () => {
    const bot = new TGBotClient('test:token');
    expect(bot.getBotToken()).toBe('test:token');
  });

  it('should construct with custom options', () => {
    const bot = new TGBotClient('test:token', {
      baseUrl: 'https://custom.api.telegram.org/bottest:token',
      rateLimitRps: 10,
      userAgent: 'Test/1.0',
    });
    expect(bot.getBotToken()).toBe('test:token');
  });

  it('should throw TelegramError on unknown error code', () => {
    expect(() => {
      throw new TelegramError('Bad Request: chat not found', 400);
    }).toThrow(TelegramError);
  });

  it('should handle TelegramRateLimitError correctly', () => {
    const err = new TelegramRateLimitError(30);
    expect(err.errorCode).toBe(429);
    expect(err.retryAfter).toBe(30);
    expect(err.message).toContain('Rate limited');
  });
});

// ─── Formatting ────────────────────────────────────────────────────

describe('formatForTelegram', () => {
  it('should return text unchanged if under limit', () => {
    const text = 'Hello, world!';
    expect(formatForTelegram(text)).toBe(text);
  });

  it('should truncate text over 4096 characters', () => {
    const longText = 'a'.repeat(5000);
    const result = formatForTelegram(longText);
    expect(result.length).toBeLessThanOrEqual(4097); // 4096 + possible ellipsis
    expect(result.endsWith('…')).toBe(true);
  });

  it('should close open HTML tags after truncation', () => {
    const text = '<b>Hello world ' + 'x'.repeat(4080) + '</b>';
    const result = formatForTelegram(text, { parseMode: 'HTML' });
    // Should not have unclosed <b>
    const openCount = (result.match(/<b(?:\s[^>]*)?>/g) || []).length;
    const closeCount = (result.match(/<\/b>/g) || []).length;
    expect(openCount).toBe(closeCount);
  });
});

describe('stripUnsupportedTags', () => {
  it('should keep supported HTML tags', () => {
    const input = '<b>bold</b> <i>italic</i> <code>code</code>';
    expect(stripUnsupportedTags(input, 'HTML')).toBe(input);
  });

  it('should remove unsupported HTML tags', () => {
    const input = '<div><b>keep</b><script>remove</script></div>';
    const result = stripUnsupportedTags(input, 'HTML');
    expect(result).not.toContain('<div>');
    expect(result).not.toContain('</div>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('<b>keep</b>');
  });

  it('should strip all tags for MarkdownV2 target', () => {
    const input = '<b>bold</b> and <i>italic</i>';
    const result = stripUnsupportedTags(input, 'MarkdownV2');
    expect(result).not.toContain('<');
    expect(result).toBe('bold and italic');
  });
});

describe('escapeMarkdownV2', () => {
  it('should escape special characters', () => {
    const input = '_*[]()~`>#+-=|{}.!';
    const result = escapeMarkdownV2(input);
    // Each char should be backslash-escaped
    expect(result).toBe('\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!');
  });

  it('should not modify normal text', () => {
    const input = 'Hello world 123';
    expect(escapeMarkdownV2(input)).toBe(input);
  });
});

describe('escapeHtml', () => {
  it('should escape <, >, and &', () => {
    const input = '<div>& "test"</div>';
    const result = escapeHtml(input);
    expect(result).toBe('&lt;div&gt;&amp; "test"&lt;/div&gt;');
  });
});

describe('buildTelegramContent', () => {
  it('should return HTML-safe truncated content', () => {
    const input = '<b>Hello</b> from DegenFeed!';
    const result = buildTelegramContent(input, { parseMode: 'HTML' });
    expect(result).toContain('Hello');
  });

  it('should escape HTML in non-HTML content', () => {
    const input = 'Use <b> tag for bold';
    const result = buildTelegramContent(input, { parseMode: 'HTML', stripTags: false });
    // The <b> should be escaped since we didn't strip tags
    expect(result).toContain('&lt;b&gt;');
  });
});

// ─── Types (compile-time only — exported interfaces, not runtime values) ──

describe('Types', () => {
  it('should export all type namespaces', () => {
    // Types are compile-time only (interfaces). This test verifies
    // that the types module can be imported without error.
    expect(typeof import('./types')).toBe('object');
  });
});
