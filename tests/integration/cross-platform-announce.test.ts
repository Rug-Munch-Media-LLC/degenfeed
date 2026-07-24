/**
 * ═════════════════════════════════════════════════════════════════════════════
 * CROSS-PLATFORM ANNOUNCE INTEGRATION TESTS — 10 tests
 *
 * Tests identity linking and cross-protocol bridge:
 *   - Link/unlink identities across protocols
 *   - Identity resolution by wallet, handle, and protocol ID
 *   - Cross-protocol display info
 *   - Bridge path configuration
 *   - Circuit breaker state management
 * ═════════════════════════════════════════════════════════════════════════════
 */

import { describe, expect, it, vi } from 'vitest';
import {
  BRIDGE_PATHS,
  CircuitBreaker,
  getCrossProtocolDisplay,
  getLinkedProtocols,
  hasLinkedProtocol,
  linkIdentity,
  resolveByHandle,
  resolveByIdentity,
  resolveByWallet,
  unlinkIdentity,
} from '../../packages/cross-protocol-bridge/src';
import { DEFAULT_CIRCUIT_CONFIG } from '../../packages/cross-protocol-bridge/src/types';

describe('Identity Linking — Link/Unlink', () => {
  it('should link a protocol identity to a DegenFeed user', () => {
    const linked = linkIdentity('df:user1', '0xabc', 'mastodon', '12345', 'user@mastodon.social');
    expect(linked.dfId).toBe('df:user1');
    expect(linked.walletAddress).toBe('0xabc');
    expect(linked.protocols).toHaveLength(1);
    expect(linked.protocols[0]?.protocol).toBe('mastodon');
    expect(linked.protocols[0]?.handle).toBe('user@mastodon.social');
  });

  it('should link multiple protocols to the same user', () => {
    linkIdentity('df:user2', '0xdef', 'nostr', 'npub1abc', 'nostr_user');
    const linked = linkIdentity('df:user2', '0xdef', 'bluesky', 'did:plc:xyz', 'user.bsky.social');
    expect(linked.protocols).toHaveLength(2);
    expect(linked.protocols.map((p) => p.protocol).sort()).toEqual(['bluesky', 'nostr']);
  });

  it('should return linked protocols for a user', () => {
    linkIdentity('df:user3', '0xaaa', 'mastodon', '111', 'user3@mastodon.social');
    linkIdentity('df:user3', '0xaaa', 'farcaster', '222', 'user3');
    const protocols = getLinkedProtocols('df:user3');
    expect(protocols).toContain('mastodon');
    expect(protocols).toContain('farcaster');
  });

  it('should unlink a protocol identity', () => {
    linkIdentity('df:user4', '0xbbb', 'nostr', 'npub1xyz', 'nostr_user4');
    const result = unlinkIdentity('df:user4', 'nostr');
    expect(result).toBe(true);
    expect(getLinkedProtocols('df:user4')).toHaveLength(0);
  });

  it('should return false when unlinking nonexistent identity', () => {
    const result = unlinkIdentity('nonexistent', 'nostr');
    expect(result).toBe(false);
  });

  it('should check if user has a specific protocol linked', () => {
    linkIdentity('df:user5', '0xccc', 'bluesky', 'did:plc:test', 'test.bsky.social');
    expect(hasLinkedProtocol('df:user5', 'bluesky')).toBe(true);
    expect(hasLinkedProtocol('df:user5', 'nostr')).toBe(false);
  });
});

describe('Identity Resolution', () => {
  it('should resolve identity by wallet address', () => {
    linkIdentity('df:resolve1', '0xresolver', 'mastodon', '999', 'resolve@mastodon.social');
    const found = resolveByWallet('0xresolver');
    expect(found).toBeDefined();
    expect(found?.dfId).toBe('df:resolve1');
  });

  it('should resolve identity by protocol ID', () => {
    linkIdentity('df:resolve2', '0xresolve2', 'nostr', 'npub_findme', 'findme');
    const found = resolveByIdentity('nostr', 'npub_findme');
    expect(found).toBeDefined();
    expect(found?.dfId).toBe('df:resolve2');
  });

  it('should resolve identity by handle', () => {
    linkIdentity('df:resolve3', '0xresolve3', 'farcaster', 'fid:123', 'handle_user');
    const found = resolveByHandle('farcaster', 'handle_user');
    expect(found).toBeDefined();
    expect(found?.dfId).toBe('df:resolve3');
  });

  it('should resolve handle case-insensitively', () => {
    linkIdentity('df:resolve4', '0xresolve4', 'mastodon', '444', 'CaseUser');
    const found = resolveByHandle('mastodon', 'caseuser');
    expect(found).toBeDefined();
    expect(found?.dfId).toBe('df:resolve4');
  });

  it('should return cross-protocol display info', () => {
    linkIdentity('df:display1', '0xdisp', 'mastodon', '555', 'display@mastodon.social', {
      displayName: 'Display User',
    });
    linkIdentity('df:display1', '0xdisp', 'nostr', 'npub_disp', 'disp_nostr');
    const info = getCrossProtocolDisplay('df:display1');
    expect(info.protocolCount).toBe(2);
    expect(info.allHandles.length).toBe(2);
    expect(info.alsoPostedOn).toContain('nostr');
  });
});

describe('Bridge Paths', () => {
  it('should have known bridge paths configured', () => {
    expect(BRIDGE_PATHS.length).toBeGreaterThanOrEqual(4);
    const ids = BRIDGE_PATHS.map((p) => p.id);
    expect(ids).toContain('activitypub→atproto');
    expect(ids).toContain('activitypub→nostr');
  });

  it('should have unique path IDs', () => {
    const ids = BRIDGE_PATHS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Circuit Breaker', () => {
  it('should start in closed state', () => {
    const cb = new CircuitBreaker();
    cb.configure('test-path', DEFAULT_CIRCUIT_CONFIG);
    const state = cb.getState('test-path');
    expect(state).toBeDefined();
    expect(state?.state).toBe('closed');
  });

  it('should open after threshold failures', () => {
    const cb = new CircuitBreaker();
    cb.configure('test-path', {
      failureThreshold: 3,
      resetTimeoutMs: 30000,
      halfOpenMaxRequests: 3,
    });
    expect(cb.isAllowed('test-path')).toBe(true);
    cb.recordFailure('test-path');
    cb.recordFailure('test-path');
    cb.recordFailure('test-path'); // 3rd failure
    expect(cb.isAllowed('test-path')).toBe(false);
    expect(cb.getState('test-path')?.state).toBe('open');
  });

  it('should go half-open after reset timeout', () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker();
    cb.configure('test-path', {
      failureThreshold: 2,
      resetTimeoutMs: 10000,
      halfOpenMaxRequests: 2,
    });
    cb.recordFailure('test-path');
    cb.recordFailure('test-path');
    expect(cb.isAllowed('test-path')).toBe(false);
    // Advance past reset timeout
    vi.advanceTimersByTime(11000);
    expect(cb.isAllowed('test-path')).toBe(true); // half-open allows first request
    vi.useRealTimers();
  });

  it('should reset on success', () => {
    const cb = new CircuitBreaker();
    cb.configure('test-path', {
      failureThreshold: 3,
      resetTimeoutMs: 30000,
      halfOpenMaxRequests: 3,
    });
    cb.recordFailure('test-path');
    cb.recordFailure('test-path');
    cb.recordSuccess('test-path');
    expect(cb.getState('test-path')?.state).toBe('closed');
    expect(cb.getState('test-path')?.failureCount).toBe(0);
  });
});
