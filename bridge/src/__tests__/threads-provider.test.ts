/**
 * Threads Provider Tests
 *
 * Tests the embedded-JSON parser and post mapping without any network access.
 * Fixtures cover the historical Threads embedded-data shapes:
 *   1. Legacy `__NEXT_DATA__` → props.pageProps.threads[].threads[]
 *   2. Modern inline application/json blob → thread_items[].post
 *   3. Graceful degradation on empty/unparseable HTML
 */

import { describe, expect, it } from 'vitest';
import { CURATED_THREADS_HANDLES, guessNiches, parseProfileHtml } from '../providers/threads';

function legacyNextDataHtml(): string {
  const nextData = JSON.stringify({
    props: {
      pageProps: {
        user: { username: 'ethereum', id: '111' },
        threads: [
          {
            threads: [
              {
                id: '1001',
                code: 'AbC123',
                user: {
                  pk: '111',
                  username: 'ethereum',
                  full_name: 'Ethereum',
                  profile_pic_url: 'https://cdn/eth.jpg',
                  is_verified: true,
                  follower_count: 5000,
                },
                taken_at: 1_700_000_000,
                like_count: 42,
                text_post_app_info: {
                  direct_reply_count: 3,
                  repost_count: 5,
                  quote_count: 1,
                  text_fragments: {
                    fragments: [
                      { plaintext: 'gm ethereum fam ', fragment_type: 'text' },
                      {
                        plaintext: 'https://ethereum.org',
                        fragment_type: 'link',
                        link_fragment: { uri: 'https://ethereum.org' },
                      },
                    ],
                  },
                },
                image_versions2: {
                  candidates: [
                    { url: 'https://cdn/pic.jpg', width: 1080, height: 1080 },
                    { url: 'https://cdn/pic_small.jpg', width: 320, height: 320 },
                  ],
                },
              },
            ],
          },
        ],
      },
    },
  });
  return `<html><head><script id="__NEXT_DATA__" type="application/json">${nextData}</script></head></html>`;
}

function blobHtml(): string {
  const blob = JSON.stringify({
    data: {
      userData: {
        user: {
          id: '222',
          thread_items: [
            {
              post: {
                id: '2001',
                code: 'XyZ99',
                user: {
                  pk: '222',
                  username: 'solana',
                  full_name: 'Solana',
                  profile_pic_url: 'https://cdn/sol.jpg',
                  is_verified: true,
                  follower_count: 9000,
                },
                taken_at: 1_700_001_000,
                like_count: 7,
                text_post_app_info: {
                  direct_reply_count: 0,
                  repost_count: 1,
                  quote_count: 0,
                  text_fragments: {
                    fragments: [{ plaintext: 'Solana Summer', fragment_type: 'text' }],
                  },
                },
                video_versions: [{ url: 'https://cdn/video.mp4', type: 101 }],
              },
            },
          ],
        },
      },
    },
  });
  return `<html><script type="application/json" data-sjs>${blob}</script></html>`;
}

describe('Threads provider — parseProfileHtml', () => {
  it('parses legacy __NEXT_DATA__ threads shape', () => {
    const posts = parseProfileHtml(legacyNextDataHtml(), 'ethereum');
    expect(posts.length).toBeGreaterThan(0);
    const p = posts[0];
    expect(p.id).toBe('1001');
    expect(p.user?.username).toBe('ethereum');
    expect(p.like_count).toBe(42);
    expect(p.text_post_app_info?.direct_reply_count).toBe(3);
    expect(p.taken_at).toBe(1_700_000_000);
  });

  it('parses modern application/json blob thread_items shape', () => {
    const posts = parseProfileHtml(blobHtml(), 'solana');
    expect(posts.length).toBe(1);
    const p = posts[0];
    expect(p.id).toBe('2001');
    expect(p.user?.username).toBe('solana');
    expect(p.video_versions?.[0]?.url).toBe('https://cdn/video.mp4');
  });

  it('returns empty array for HTML with no embedded posts', () => {
    expect(parseProfileHtml('<html><body>no data here</body></html>', 'ghost')).toEqual([]);
  });

  it('returns empty array for invalid JSON blobs', () => {
    const html = '<script type="application/json">{not valid json</script>';
    expect(parseProfileHtml(html, 'ghost')).toEqual([]);
  });

  it('deduplicates posts found by multiple strategies', () => {
    // Same post id in both __NEXT_DATA__ and a blob → one result
    const nextData = JSON.stringify({
      props: { pageProps: { threads: [{ threads: [{ id: 'dup1', user: { pk: '1' }, taken_at: 100 }] }] } },
    });
    const blob = JSON.stringify({ thread_items: [{ post: { id: 'dup1', user: { pk: '1' }, taken_at: 100 } }] });
    const html = `<script id="__NEXT_DATA__">${nextData}</script><script type="application/json">${blob}</script>`;
    const posts = parseProfileHtml(html, 'dupe');
    expect(posts.filter((p) => p.id === 'dup1')).toHaveLength(1);
  });

  it('curates 20–30 crypto/web3 accounts', () => {
    expect(CURATED_THREADS_HANDLES.length).toBeGreaterThanOrEqual(20);
    expect(CURATED_THREADS_HANDLES.length).toBeLessThanOrEqual(30);
  });
});

describe('Threads provider — guessNiches', () => {
  it('detects crypto niches from text', () => {
    expect(guessNiches('bitcoin halving soon')).toContain('bitcoin');
    expect(guessNiches('defi yield farming on uniswap')).toContain('defi');
    expect(guessNiches('solana summer')).toContain('solana');
    expect(guessNiches('a random thought')).toContain('crypto');
  });
});
