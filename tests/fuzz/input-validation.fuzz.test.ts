/**
 * Input validation fuzz tests.
 * Tests edge cases and boundary conditions for input sanitization
 * and validation functions.
 */
import { describe, expect, it } from 'vitest';

// Replicates a simple sanitize function for testing
function sanitizeDisplayName(input: string): string {
  if (typeof input !== 'string') return '';
  return (
    input
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<\/?\s*script[^>]*>/gi, '')
      .replace(/[<>]/g, '')
      // Strip inline event-handler attributes (onerror=, onload=, …) — inert as
      // text but dangerous if ever re-embedded into markup.
      .replace(/\bon\w+\s*=/gi, '')
      .replace(/javascript:/gi, '')
      .trim()
      .slice(0, 50)
  );
}

function validateEmail(input: string): boolean {
  if (typeof input !== 'string') return false;
  if (input.length > 254) return false;
  // Domain labels: alnum, may contain inner hyphens, must not start/end with hyphen
  const emailRegex =
    /^[^\s@]+@([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
  return emailRegex.test(input);
}

function validateUrl(input: string): boolean {
  if (typeof input !== 'string') return false;
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function truncateContent(input: string, maxLength: number): string {
  if (typeof input !== 'string') return '';
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength)}...`;
}

describe('Input validation fuzz tests', () => {
  // Boundary conditions
  describe('boundary conditions', () => {
    it('should handle empty strings', () => {
      expect(sanitizeDisplayName('')).toBe('');
      expect(validateEmail('')).toBe(false);
      expect(validateUrl('')).toBe(false);
    });

    it('should handle whitespace-only strings', () => {
      expect(sanitizeDisplayName('   ')).toBe('');
      expect(validateEmail('   ')).toBe(false);
    });

    it('should handle null/undefined-like values', () => {
      expect(sanitizeDisplayName('null')).toBe('null');
      expect(sanitizeDisplayName('undefined')).toBe('undefined');
    });

    it('should handle very long strings', () => {
      const long = 'a'.repeat(10000);
      expect(sanitizeDisplayName(long).length).toBeLessThanOrEqual(50);
    });

    it('should handle strings at max length', () => {
      const max = 'a'.repeat(254);
      expect(validateEmail(max)).toBe(false); // no @ sign
    });

    it('should handle exactly 254 char email', () => {
      const local = 'a'.repeat(249);
      const email = `${local}@b.co`;
      expect(email.length).toBe(254);
      // This should pass if format is valid
      expect(validateEmail(email)).toBe(true);
    });

    it('should handle overflow (>254 char email)', () => {
      const local = 'a'.repeat(252);
      const email = `${local}@b.co`;
      expect(validateEmail(email)).toBe(false);
    });
  });

  // XSS vectors
  describe('XSS vectors', () => {
    const xssVectors = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      'javascript:alert(1)',
      '"><script>alert(1)</script>',
      '<scr<script>ipt>alert(1)</scr</script>ipt>',
      '<BODY ONLOAD=alert(1)>',
      '<!--<script>-->',
      '<img src="jav&#x09;ascript:alert(1)">',
      '\\";alert(1);//',
    ];

    for (const vector of xssVectors) {
      it(`should sanitize XSS vector: ${vector.slice(0, 40)}`, () => {
        const result = sanitizeDisplayName(vector);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('onload');
      });
    }
  });

  // Email edge cases
  describe('email edge cases', () => {
    const validEmails = [
      'user@example.com',
      'user+tag@example.com',
      'user.name@example.co.uk',
      '123@example.com',
      'a@b.co',
      'user@xn--example-cua.com',
    ];

    for (const email of validEmails) {
      it(`should validate: ${email}`, () => {
        expect(validateEmail(email)).toBe(true);
      });
    }

    const invalidEmails = [
      '',
      'notanemail',
      '@example.com',
      'user@',
      'user@.com',
      'user@exam ple.com',
      `${'a'.repeat(255)}@example.com`,
      'user@-example.com',
    ];

    for (const email of invalidEmails) {
      it(`should reject: ${email}`, () => {
        expect(validateEmail(email)).toBe(false);
      });
    }
  });

  // URL edge cases
  describe('URL edge cases', () => {
    const validUrls = [
      'https://example.com',
      'http://example.com/path?q=1',
      'https://example.com:3000',
      'https://example.com/path/to/page#section',
      'https://пример.рф',
    ];

    for (const url of validUrls) {
      it(`should validate URL: ${url}`, () => {
        expect(validateUrl(url)).toBe(true);
      });
    }

    const invalidUrls = [
      '',
      'not a url',
      'ftp://example.com',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<script>',
      '   ',
    ];

    for (const url of invalidUrls) {
      it(`should reject URL: ${url}`, () => {
        expect(validateUrl(url)).toBe(false);
      });
    }
  });

  // Content truncation
  describe('content truncation', () => {
    it('should not truncate content under limit', () => {
      expect(truncateContent('short', 100)).toBe('short');
    });

    it('should truncate content over limit', () => {
      const result = truncateContent('a'.repeat(200), 100);
      expect(result.length).toBe(103); // 100 chars + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle exact limit', () => {
      const exact = 'a'.repeat(100);
      expect(truncateContent(exact, 100)).toBe(exact);
    });

    it('should handle empty string truncation', () => {
      expect(truncateContent('', 100)).toBe('');
    });

    it('should handle zero max length', () => {
      const result = truncateContent('hello', 0);
      expect(result).toBe('...');
      expect(result.length).toBe(3);
    });
  });

  // Numeric boundary cases
  describe('numeric handling', () => {
    it('should handle very large numbers in strings', () => {
      const result = sanitizeDisplayName('1'.repeat(1000));
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('should handle special characters', () => {
      const result = sanitizeDisplayName('!\n\r\t\0@#$%^&*()');
      // Should not throw and return something safe
      expect(typeof result).toBe('string');
    });

    it('should handle unicode characters', () => {
      const result = sanitizeDisplayName('🔥 hello 你好 Привет');
      expect(result).toContain('hello');
    });

    it('should handle mixed script XSS attempts', () => {
      const vectors = [
        '<script>eval("\\u0061lert(1)")</script>',
        '<ScRiPt>alert(1)</sCrIpT>',
        '\x3cscript\x3ealert(1)\x3c/script\x3e',
      ];
      for (const v of vectors) {
        const result = sanitizeDisplayName(v);
        expect(result).not.toContain('alert');
      }
    });
  });
});
