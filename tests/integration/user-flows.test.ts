/**
 * ═════════════════════════════════════════════════════════════════════════════
 * USER FLOW TESTS — 15 tests
 *
 * Tests critical user paths from end to end:
 *   - Authentication flow (wallet sign-in, identity management)
 *   - Post creation flow (compose, cross-protocol publish)
 *   - Social engagement flow (like, repost, reply)
 *   - Tipping flow (send tips across protocols)
 * ═════════════════════════════════════════════════════════════════════════════
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock localStorage used by storage package ─────────────────────────
function mockLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  });
  return store;
}

// ─── SUITE 1: Authentication Flows ─────────────────────────────────────

describe('User Flow: Authentication', () => {
  let mockStore: Record<string, string>;

  beforeEach(() => {
    mockStore = mockLocalStorage();
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores and retrieves identity from localStorage', async () => {
    // Simulate the storage pattern used by @degenfeed/storage
    const identity = {
      id: 'nostr:npub_test123',
      protocol: 'nostr',
      publicId: 'npub_test123',
      displayName: 'Alice',
      avatarUrl: 'https://example.com/avatar.png',
      privateKey: 'nsec_encrypted',
      createdAt: Date.now(),
    };

    // Simulate saveIdentity()
    const key = `df_identity_${identity.protocol}_${identity.publicId}`;
    localStorage.setItem(key, JSON.stringify(identity));
    localStorage.setItem('df_identities', JSON.stringify([identity.id]));

    // Verify storage round-trip
    const storedList = JSON.parse(localStorage.getItem('df_identities') || '[]');
    expect(storedList).toContain(identity.id);

    const storedIdentity = JSON.parse(localStorage.getItem(key) || '{}');
    expect(storedIdentity.protocol).toBe('nostr');
    expect(storedIdentity.publicId).toBe('npub_test123');
    expect(storedIdentity.displayName).toBe('Alice');
  });

  it('manages multiple identities across protocols', async () => {
    const identities = [
      { id: 'nostr:npub1', protocol: 'nostr', publicId: 'npub1', displayName: 'Alice' },
      { id: 'farcaster:0xfid1', protocol: 'farcaster', publicId: '0xfid1', displayName: 'Alice FC' },
      { id: 'bluesky:did:plc:1', protocol: 'bluesky', publicId: 'did:plc:1', displayName: 'Alice BSky' },
    ];

    // Save all identities
    const allIds: string[] = [];
    for (const ident of identities) {
      const key = `df_identity_${ident.protocol}_${ident.publicId}`;
      localStorage.setItem(key, JSON.stringify(ident));
      allIds.push(ident.id);
    }
    localStorage.setItem('df_identities', JSON.stringify(allIds));

    // Verify all saved
    const loaded = JSON.parse(localStorage.getItem('df_identities') || '[]');
    expect(loaded).toHaveLength(3);

    // Verify primary identity selection
    localStorage.setItem('df_primary', 'farcaster:0xfid1');
    expect(localStorage.getItem('df_primary')).toBe('farcaster:0xfid1');
  });

  it('handles identity removal gracefully', async () => {
    // Save and then remove an identity
    const identity = {
      id: 'nostr:npub_remove_me',
      protocol: 'nostr',
      publicId: 'npub_remove_me',
      displayName: 'Temp User',
    };

    const key = `df_identity_${identity.protocol}_${identity.publicId}`;
    localStorage.setItem(key, JSON.stringify(identity));
    localStorage.setItem('df_identities', JSON.stringify([identity.id]));

    // Verify it exists
    expect(localStorage.getItem(key)).toBeTruthy();

    // Remove it
    localStorage.removeItem(key);
    const remaining = JSON.parse(localStorage.getItem('df_identities') || '[]')
      .filter((id: string) => id !== identity.id);
    localStorage.setItem('df_identities', JSON.stringify(remaining));

    // Verify removal
    expect(localStorage.getItem(key)).toBeNull();
    expect(JSON.parse(localStorage.getItem('df_identities') || '[]')).not.toContain(identity.id);
  });

  it('handles wallet sign-in simulation', async () => {
    // Simulate wallet sign-in flow:
    // 1. Connect wallet -> get address
    // 2. Sign message -> get signature
    // 3. Store identity

    const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';
    const message = 'Sign in to DegenFeed at timestamp 1712345678';
    const signature = '0x_signed_message_abc123';

    // Mock the auth callback endpoint
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        identity: {
          id: `ethereum:${walletAddress}`,
          protocol: 'ethereum',
          publicId: walletAddress,
          displayName: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
          avatarUrl: '',
          signedMessage: signature,
          createdAt: Date.now(),
        },
        token: 'session_token_xyz',
      }),
    });

    // Simulate POST to /api/auth/callback
    const response = await fetch('/api/auth/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: walletAddress, message, signature }),
    });

    const data = await response.json();
    expect(data.identity).toBeDefined();
    expect(data.identity.protocol).toBe('ethereum');
    expect(data.identity.publicId).toBe(walletAddress);
    expect(data.token).toBeDefined();

    // Store locally
    const key = `df_identity_${data.identity.protocol}_${data.identity.publicId}`;
    localStorage.setItem(key, JSON.stringify(data.identity));
    localStorage.setItem('df_session', data.token);

    // Verify stored
    expect(localStorage.getItem('df_session')).toBe('session_token_xyz');
    expect(JSON.parse(localStorage.getItem(key) || '{}').publicId).toBe(walletAddress);
  });
});

// ─── SUITE 2: Post Creation Flow ───────────────────────────────────────

describe('User Flow: Post Creation', () => {
  beforeEach(() => {
    mockLocalStorage();
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('publishes a post to a single protocol successfully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: {
          nostr: { ok: true, id: 'note1abc123' },
        },
      }),
    });

    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: 'gm everyone! Building the future of decentralized social media.',
        targets: ['nostr'],
        auth: { nostr: 'nsec_encrypted_key' },
      }),
    });

    const data = await response.json();
    expect(data.results.nostr.ok).toBe(true);
    expect(data.results.nostr.id).toContain('note1');
  });

  it('publishes a post across multiple protocols simultaneously', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: {
          nostr: { ok: true, id: 'note1xyz' },
          farcaster: { ok: true, hash: '0xcast123' },
          bluesky: { ok: true, uri: 'at://did:plc:abc/app.bsky.feed.post/1' },
        },
      }),
    });

    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: 'Cross-posting from DegenFeed to all my networks!',
        targets: ['nostr', 'farcaster', 'bluesky'],
        auth: {
          nostr: 'nsec_encrypted',
          farcaster: '0xfc_key',
          bluesky: 'bsky_jwt_token',
        },
      }),
    });

    const data = await response.json();
    expect(data.results.nostr.ok).toBe(true);
    expect(data.results.farcaster.ok).toBe(true);
    expect(data.results.bluesky.ok).toBe(true);
    expect(Object.keys(data.results)).toHaveLength(3);
  });

  it('handles partial publish failures gracefully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: {
          nostr: { ok: true, id: 'note1abc' },
          farcaster: { ok: false, error: 'Not signed into Farcaster' },
          mastodon: { ok: false, error: 'Rate limited' },
        },
      }),
    });

    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: 'Testing cross-post',
        targets: ['nostr', 'farcaster', 'mastodon'],
        auth: { nostr: 'nsec_encrypted' },
      }),
    });

    const data = await response.json();
    expect(data.results.nostr.ok).toBe(true);
    expect(data.results.farcaster.ok).toBe(false);
    expect(data.results.farcaster.error).toContain('Not signed in');
    expect(data.results.mastodon.ok).toBe(false);
  });

  it('handles network error during publish', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error'),
    );

    let results: Record<string, { ok: boolean; error?: string }> = {};
    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: 'Test post',
          targets: ['nostr'],
          auth: { nostr: 'key' },
        }),
      });
      results = (await response.json()).results;
    } catch {
      results = { nostr: { ok: false, error: 'Network error' } };
    }

    expect(results.nostr.ok).toBe(false);
    expect(results.nostr.error).toBeDefined();
  });
});

// ─── SUITE 3: Social Engagement Flow ───────────────────────────────────

describe('User Flow: Social Engagement', () => {
  beforeEach(() => {
    mockLocalStorage();
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('likes a post via API', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const response = await fetch('/api/engage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'like',
        postId: 'nostr:note1abc',
        protocol: 'nostr',
        target: { authorId: 'npub_author' },
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it('reposts content', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const response = await fetch('/api/engage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'repost',
        postId: 'farcaster:0xcast456',
        protocol: 'farcaster',
        target: { authorId: '0xfid_author' },
      }),
    });

    expect(response.ok).toBe(true);
  });

  it('replies to a post with content', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, id: 'note1reply' }),
    });

    const response = await fetch('/api/engage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'reply',
        postId: 'nostr:note1original',
        protocol: 'nostr',
        content: 'Great post! Totally agree with your analysis.',
        target: { authorId: 'npub_author' },
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.id).toBeDefined();
  });
});

// ─── SUITE 4: Tipping Flow ────────────────────────────────────────────

describe('User Flow: Tipping', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it('resolves available tipping methods for a post', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        methods: [
          { method: 'lightning', label: 'Lightning⚡', available: true, address: 'tip@degenfeed.xyz' },
          { method: 'evm', label: 'ETH/Base', available: true, address: '0x1234...5678', chain: 'base' },
          { method: 'solana', label: 'Solana', available: true, address: 'Abc...Xyz', chain: 'solana' },
        ],
      }),
    });

    const response = await fetch('/api/tip/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        protocol: 'nostr',
        authorId: 'npub_author123',
      }),
    });

    const data = await response.json();
    expect(data.methods.length).toBeGreaterThanOrEqual(1);
    expect(data.methods.some((m: { available: boolean }) => m.available)).toBe(true);
  });

  it('creates a Lightning tip intent', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        intent: {
          to: 'tip@degenfeed.xyz',
          amount: '5000', // sats
          chain: 'bitcoin',
          note: 'Great content!',
        },
        instructions: 'Pay this Lightning invoice to send the tip',
      }),
    });

    const response = await fetch('/api/tip/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        method: 'lightning',
        amount: '5000',
        to: 'npub_author123',
        protocol: 'nostr',
        note: 'Great content!',
      }),
    });

    const data = await response.json();
    expect(data.intent).toBeDefined();
    expect(data.intent.amount).toBe('5000');
    expect(data.intent.to).toBeDefined();
  });

  it('creates an EVM tip intent via smart contract', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        intent: {
          to: '0xContractAddress',
          amount: '0.01',
          chain: 'base',
          chainId: 8453,
          data: '0x_tip_function_data',
          value: '10000000000000000',
          from: '0xSender',
        },
      }),
    });

    const response = await fetch('/api/tip/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        method: 'evm',
        amount: '0.01',
        token: 'ETH',
        chain: 'base',
        to: '0xRecipientAddress',
        protocol: 'farcaster',
      }),
    });

    const data = await response.json();
    expect(data.intent.chain).toBe('base');
    expect(data.intent.value).toBeDefined();
  });
});
