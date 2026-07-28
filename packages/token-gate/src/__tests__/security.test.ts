/**
 * @degenfeed/token-gate — SSRF protection tests
 *
 * Tests isSafeUrl() for SSRF protection. This function validates URLs before
 * fetching token metadata, preventing SSRF attacks against internal networks,
 * cloud metadata endpoints, and loopback addresses.
 */

import { describe, expect, it } from 'vitest';
import { isSafeUrl } from '../index';

describe('isSafeUrl', () => {
  // ─── Loopback / localhost ─────────────────────────────────────────────

  it('should block localhost hostname', () => {
    expect(isSafeUrl('http://localhost:8545')).toBe(false);
    expect(isSafeUrl('https://localhost/')).toBe(false);
  });

  it('should block 127.0.0.1 IPv4 loopback', () => {
    expect(isSafeUrl('http://127.0.0.1:8545')).toBe(false);
    expect(isSafeUrl('https://127.0.0.1/')).toBe(false);
  });

  it('should block entire 127.x.x.x range', () => {
    expect(isSafeUrl('http://127.1.2.3/')).toBe(false);
    expect(isSafeUrl('http://127.255.0.1/')).toBe(false);
    expect(isSafeUrl('https://127.0.1.1/')).toBe(false);
  });

  it('should block IPv6 loopback [::1]', () => {
    expect(isSafeUrl('http://[::1]:8545/')).toBe(false);
    expect(isSafeUrl('https://[::1]/')).toBe(false);
  });

  // ─── Private IP ranges ────────────────────────────────────────────────

  it('should block 10.x.x.x private range', () => {
    expect(isSafeUrl('http://10.0.0.1/')).toBe(false);
    expect(isSafeUrl('http://10.1.2.3/')).toBe(false);
    expect(isSafeUrl('https://10.255.255.255/')).toBe(false);
  });

  it('should block 172.16.0.0/12 private range', () => {
    expect(isSafeUrl('http://172.16.0.1/')).toBe(false);
    expect(isSafeUrl('http://172.20.0.1/')).toBe(false);
    expect(isSafeUrl('https://172.31.255.255/')).toBe(false);
  });

  it('should allow 172.15.x.x and 172.32.x.x (outside private range)', () => {
    expect(isSafeUrl('http://172.15.0.1/')).toBe(true);
    expect(isSafeUrl('http://172.32.0.1/')).toBe(true);
  });

  it('should block 192.168.x.x private range', () => {
    expect(isSafeUrl('http://192.168.0.1/')).toBe(false);
    expect(isSafeUrl('http://192.168.1.100/')).toBe(false);
    expect(isSafeUrl('https://192.168.255.255/')).toBe(false);
  });

  it('should block cloud metadata IP 169.254.169.254', () => {
    expect(isSafeUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isSafeUrl('https://169.254.169.254/')).toBe(false);
  });

  it('should block 0.0.0.0', () => {
    expect(isSafeUrl('http://0.0.0.0:8545/')).toBe(false);
    expect(isSafeUrl('https://0.0.0.0/')).toBe(false);
  });

  // ─── Protocol validation ──────────────────────────────────────────────

  it('should allow valid HTTPS URLs', () => {
    expect(isSafeUrl('https://ipfs.io/ipfs/QmTest')).toBe(true);
    expect(isSafeUrl('https://api.opensea.io/api/v1/')).toBe(true);
    expect(isSafeUrl('https://metadata.ens.domains/mainnet/0x...')).toBe(true);
    expect(isSafeUrl('https://cloudflare-ipfs.com/ipfs/QmTest')).toBe(true);
  });

  it('should allow valid HTTP URLs (for local dev/testing)', () => {
    // HTTP is allowed — the guard is against private/internal IPs, not scheme
    expect(isSafeUrl('http://example.com/metadata.json')).toBe(true);
    expect(isSafeUrl('http://valid.public.server/path')).toBe(true);
  });

  it('should block non-http protocols (ftp://)', () => {
    expect(isSafeUrl('ftp://files.example.com/metadata.json')).toBe(false);
  });

  it('should block non-http protocols (file://)', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeUrl('file://localhost/etc/shadow')).toBe(false);
  });

  it('should block non-http protocols (data://)', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('should block javascript: URIs', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  // ─── Edge cases ───────────────────────────────────────────────────────

  it('should reject empty string', () => {
    expect(isSafeUrl('')).toBe(false);
  });

  it('should reject malformed URLs', () => {
    expect(isSafeUrl('not-a-url')).toBe(false);
    expect(isSafeUrl('')).toBe(false);
  });

  it('should reject whitespace-only strings', () => {
    expect(isSafeUrl('   ')).toBe(false);
    expect(isSafeUrl('\t\n')).toBe(false);
  });

  it('should block IPFS gateway without proper protocol', () => {
    // ipfs:// is not a browser-recognized protocol — URL() may or may not parse it
    // But we must ensure it doesn't pass as a valid http/https URL
    // If someone passes it as a relative path, it should be rejected
    expect(isSafeUrl('ipfs://QmTest/metadata.json')).toBe(false);
    expect(isSafeUrl('/ipfs/QmTest')).toBe(false);
  });

  it('should handle URLs with auth credentials', () => {
    // These should still be validated for the hostname
    expect(isSafeUrl('https://user:pass@localhost/')).toBe(false);
    expect(isSafeUrl('https://user:pass@127.0.0.1/')).toBe(false);
    expect(isSafeUrl('https://user:pass@example.com/')).toBe(true);
  });

  it('should handle URLs with port numbers', () => {
    expect(isSafeUrl('https://localhost:8545/')).toBe(false);
    expect(isSafeUrl('https://127.0.0.1:3000/')).toBe(false);
    expect(isSafeUrl('https://example.com:443/path')).toBe(true);
  });
});
