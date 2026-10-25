/** @degenfeed/utils — URL and env helper contract tests */

import { describe, expect, it } from 'vitest';
import { rmiUrl } from './env';
import { buildUrl } from './url';

describe('rmiUrl', () => {
  it('uses RMI_BACKEND_URL when set', () => {
    expect(rmiUrl({ RMI_BACKEND_URL: 'https://api.example.com' })).toBe('https://api.example.com');
  });

  it('falls back to the local port when the env value is missing or empty', () => {
    expect(rmiUrl({})).toBe('http://127.0.0.1:8000');
    expect(rmiUrl({ RMI_BACKEND_URL: '' })).toBe('http://127.0.0.1:8000');
  });
});

describe('buildUrl', () => {
  it('joins a path onto an absolute base', () => {
    expect(buildUrl('https://a.test', '/v1/feed')).toBe('https://a.test/v1/feed');
  });

  it('appends defined query parameters only', () => {
    expect(buildUrl('https://a.test', '/x', { a: '1', b: undefined })).toBe('https://a.test/x?a=1');
  });

  it('keeps empty-string parameters (explicit empty is not undefined)', () => {
    expect(buildUrl('https://a.test', '/x', { q: '' })).toBe('https://a.test/x?q=');
  });

  it('overrides an existing query key instead of duplicating it', () => {
    expect(buildUrl('https://a.test', '/x?p=1', { p: '2' })).toBe('https://a.test/x?p=2');
  });

  it('throws when the base is not absolute', () => {
    expect(() => buildUrl('/relative', '/x')).toThrow();
  });
});
