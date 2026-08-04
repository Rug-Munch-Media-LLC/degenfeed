import { BridgeFeedProvider } from '../src/feed/feed-fetcher';
import type { Env } from '../src/types';

const env = {
  BRIDGE_INTERNAL_URL: 'http://127.0.0.1:8787',
  BRIDGE_API_KEY: 'test-key',
} as unknown as Env;

globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  console.log('BRIDGE FETCH →', url);
  if (url.includes('127.0.0.1:8787')) {
    return new Response(JSON.stringify({ data: [
      { id: 'farcaster:neynar:0xtest1', protocol: 'farcaster',
        author: { id: 'farcaster:3', primary: { protocol: 'farcaster', id: '3' }, handles: { farcaster: 'dwr' }, displayName: 'Dan Romero', bio: '', avatarUrl: '', followerCount: 0, followingCount: 0, links: [], keys: { fid: 3 } },
        text: 'Real cast from Neynar bridge', createdAt: Date.now(),
        metrics: { likes: 10, reposts: 2, replies: 1, quotes: 0 }, raw: {} },
    ]}), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error('Unexpected URL: ' + url);
}) as typeof fetch;

const p = new BridgeFeedProvider('farcaster', env);
const r = await p.fetchFeed({ timeoutMs: 6000 });
console.log('RESULT posts:', r.posts.length);
console.log('notice:', r.notice);
for (const post of r.posts) {
  console.log(' -', post.id, '|', post.text.slice(0, 50));
}
