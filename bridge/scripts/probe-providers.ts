/* Probe the thin feed providers — diagnostics only, not shipped */
import { fetchBlueskyPosts, firehoseStatus } from '../src/providers/bluesky';
import { fetchWriteFreelyPosts } from '../src/providers/writefreely';
import { fetchPixelfedPosts } from '../src/providers/pixelfed';
import { fetchOwncastPosts } from '../src/providers/owncast';
import { fetchPeerTubePosts } from '../src/providers/peertube';

async function main() {
  console.log('=== Bluesky ===');
  try {
    const posts = await fetchBlueskyPosts(20);
    console.log(`bluesky: ${posts.length} posts`);
    console.log('firehose status:', JSON.stringify(firehoseStatus()));
  } catch (e) {
    console.log('bluesky ERR', (e as Error).message);
  }

  console.log('\n=== WriteFreely ===');
  try {
    const posts = await fetchWriteFreelyPosts(20);
    console.log(`writefreely: ${posts.length} posts`);
    for (const p of posts.slice(0, 5)) console.log(' -', p.id, '|', p.text.slice(0, 60).replace(/\n/g, ' '));
  } catch (e) {
    console.log('writefreely ERR', (e as Error).message);
  }

  console.log('\n=== Pixelfed ===');
  try {
    const posts = await fetchPixelfedPosts(20);
    console.log(`pixelfed: ${posts.length} posts`);
    for (const p of posts.slice(0, 5)) console.log(' -', p.id, '|', p.text.slice(0, 60).replace(/\n/g, ' '));
  } catch (e) {
    console.log('pixelfed ERR', (e as Error).message);
  }

  console.log('\n=== Owncast instances ===');
  const { OWNCAST_INSTANCES } = await import('../src/providers/owncast');
  for (const inst of (OWNCAST_INSTANCES as Array<{ url: string; name: string }>)) {
    try {
      const res = await fetch(`${inst.url}/api/status`, {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Owncast)' },
        signal: AbortSignal.timeout(5000),
      });
      console.log(` ${inst.url}: HTTP ${res.status} ${res.ok ? JSON.stringify(await res.json()).slice(0, 200) : ''}`);
    } catch (e) {
      console.log(` ${inst.url}: ERR ${(e as Error).message}`);
    }
  }

  console.log('\n=== PeerTube ===');
  try {
    const posts = await fetchPeerTubePosts(20);
    console.log(`peertube: ${posts.length} posts`);
  } catch (e) {
    console.log('peertube ERR', (e as Error).message);
  }
}

main();
