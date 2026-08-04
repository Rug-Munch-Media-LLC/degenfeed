/**
 * Manual verification of the farcaster bridge fallback fix.
 * Mocks global fetch: farcaster hub → unreachable, bridge → real Neynar data.
 */
import { handleFarcasterFeed } from '../src/routes/farcaster-feed';
import type { Env } from '../src/types';

const BRIDGE_DATA = {
  data: [
    {
      id: 'farcaster:neynar:0xtest1',
      protocol: 'farcaster',
      author: {
        id: 'farcaster:3',
        primary: { protocol: 'farcaster', id: '3' },
        handles: { farcaster: 'dwr' },
        displayName: 'Dan Romero',
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: { fid: 3 },
      },
      text: 'Real cast from Neynar bridge',
      createdAt: Date.now(),
      metrics: { likes: 10, reposts: 2, replies: 1, quotes: 0 },
      raw: {},
    },
    {
      id: 'farcaster:neynar:0xtest2',
      protocol: 'farcaster',
      author: {
        id: 'farcaster:1',
        primary: { protocol: 'farcaster', id: '1' },
        handles: { farcaster: 'varun' },
        displayName: 'Varun',
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: { fid: 1 },
      },
      text: 'Another real cast',
      createdAt: Date.now(),
      metrics: { likes: 5, reposts: 1, replies: 0, quotes: 0 },
      raw: {},
    },
  ],
};

const env: Env = {
  FARCASTER_HUB_URL: 'https://hub.farcaster.standardcrypto.vc:2281',
  BRIDGE_INTERNAL_URL: 'http://127.0.0.1:8787',
  BRIDGE_API_KEY: 'test-key',
} as unknown as Env;

// Mock fetch: hub calls fail (unreachable), bridge calls succeed
let hubCalls = 0;
let bridgeCalls = 0;
globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  if (url.includes('farcaster.standardcrypto.vc')) {
    hubCalls++;
    throw new Error('Hub unreachable (simulated)');
  }
  if (url.includes('127.0.0.1:8787')) {
    bridgeCalls++;
    return new Response(JSON.stringify(BRIDGE_DATA), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  throw new Error(`Unexpected URL: ${url}`);
}) as typeof fetch;

const request = new Request('http://localhost/api/feed/farcaster?limit=3');

const res = await handleFarcasterFeed(request, env);
const body = (await res.json()) as { data: unknown[]; meta: { source: string } };

console.log('status:', res.status);
console.log('bridge calls:', bridgeCalls, '| hub calls:', hubCalls);
console.log('meta:', JSON.stringify(body.meta));
console.log('data length:', body.data.length);
console.log('first id:', (body.data[0] as { id: string }).id);
console.log('first text:', (body.data[0] as { text: string }).text);

const ok = res.status === 200 && body.data.length === 2 && body.meta.source === 'bridge-live';
console.log(ok ? 'PASS: farcaster served real bridge content' : 'FAIL');
process.exit(ok ? 0 : 1);
