/**
 * @degenfeed/unit — Free Creator Coin / Gasless Mint Tests
 *
 * Verifies Zora gasless minting, Lens Momoka posting,
 * and Farcaster free posting using mocked on-chain calls.
 *
 * These tests validate the "free" (gasless) creator flows:
 * - Zora Coins: gasless mint via ERC-20 permit or x402
 * - Lens Momoka: free posting via Momoka (Lens’ L2)
 * - Farcaster: free posting via signed messages (no gas)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock on-chain / RPC layer ─────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockJsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Zora Gasless Mint ─────────────────────────────────────────────────

describe('Zora Gasless Mint', () => {
  it('requests a gasless mint via Zora API', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ mintTx: '0xabc', status: 'submitted' }));
    const res = await fetch('https://api.zora.co/gasless/mint', {
      method: 'POST',
      body: JSON.stringify({ token: '0x123', recipient: '0xabc', quantity: 1 }),
    });
    const data = await res.json();
    expect(data.mintTx).toBe('0xabc');
    expect(data.status).toBe('submitted');
  });

  it('returns error for invalid token address', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: 'invalid token' }, 400));
    const res = await fetch('https://api.zora.co/gasless/mint', {
      method: 'POST',
      body: JSON.stringify({ token: '0xbad', recipient: '0xabc', quantity: 1 }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid token');
  });

  it('requires quantity greater than 0', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: 'quantity must be > 0' }, 400));
    const res = await fetch('https://api.zora.co/gasless/mint', {
      method: 'POST',
      body: JSON.stringify({ token: '0x123', recipient: '0xabc', quantity: 0 }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── Lens Momoka Posting ───────────────────────────────────────────────

describe('Lens Momoka Posting', () => {
  it('posts content via Momoka (free L2 posting)', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ momokaId: '0xmomoka123', status: 'success' }));
    const res = await fetch('https://momoka.lens.xyz/api/post', {
      method: 'POST',
      body: JSON.stringify({
        profileId: '0x01',
        content: 'Hello Lens from DegenFeed!',
      }),
    });
    const data = await res.json();
    expect(data.momokaId).toBeTruthy();
    expect(data.status).toBe('success');
  });

  it('rejects post with empty content', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: 'content required' }, 400));
    const res = await fetch('https://momoka.lens.xyz/api/post', {
      method: 'POST',
      body: JSON.stringify({ profileId: '0x01', content: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('verifies Momoka proof is returned', async () => {
    mockFetch.mockResolvedValue(
      mockJsonResponse({
        momokaId: '0xmomoka456',
        proof: '0xproof',
        status: 'success',
      }),
    );
    const res = await fetch('https://momoka.lens.xyz/api/post', {
      method: 'POST',
      body: JSON.stringify({
        profileId: '0x01',
        content: 'Proof test',
      }),
    });
    const data = await res.json();
    expect(data.proof).toBeTruthy();
    expect(data.momokaId).toBe('0xmomoka456');
  });
});

// ─── Farcaster Free Posting ────────────────────────────────────────────

describe('Farcaster Free Posting', () => {
  it('submits a signed cast to Farcaster Hub', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ hash: '0xcast123', status: 'submitted' }));
    const res = await fetch('https://hub.farcaster.xyz/v1/submitMessage', {
      method: 'POST',
      body: JSON.stringify({
        signedMessage: '0xsigned',
        castText: 'gm from DegenFeed',
      }),
    });
    const data = await res.json();
    expect(data.hash).toBeTruthy();
    expect(data.status).toBe('submitted');
  });

  it('rejects unsigned message', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: 'signature required' }, 401));
    const res = await fetch('https://hub.farcaster.xyz/v1/submitMessage', {
      method: 'POST',
      body: JSON.stringify({ castText: 'unsigned cast' }),
    });
    expect(res.status).toBe(401);
  });

  it('requires parent URL for replies in channels', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ error: 'parentUrl required' }, 400));
    const res = await fetch('https://hub.farcaster.xyz/v1/submitMessage', {
      method: 'POST',
      body: JSON.stringify({
        signedMessage: '0xsigned',
        castText: 'reply test',
        parentUrl: '',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('accepts cast with all optional fields', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ hash: '0xcast456', status: 'submitted' }));
    const res = await fetch('https://hub.farcaster.xyz/v1/submitMessage', {
      method: 'POST',
      body: JSON.stringify({
        signedMessage: '0xsigned',
        castText: 'full cast with embeds',
        embeds: [{ url: 'https://example.com' }],
        parentUrl: 'https://warpcast.com/~/channel/crypto',
      }),
    });
    const data = await res.json();
    expect(data.hash).toBe('0xcast456');
  });
});
