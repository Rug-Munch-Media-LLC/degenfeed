/**
 * @degenfeed/api-worker — image-proxy tests
 *
 * Covers the protocol-specific URL transformations and the handler-level
 * behavior (CORS, caching, error responses). The CF Cache API and fetch are
 * mocked in test-setup.ts.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleImageProxy, transformProtocolUrl } from '../routes/image-proxy';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('transformProtocolUrl', () => {
  it('unwraps nostr: https URLs', () => {
    expect(transformProtocolUrl('nostr:https://nostr.build/i/abc.png', 'nostr')).toBe(
      'https://nostr.build/i/abc.png',
    );
  });

  it('unwraps nostrich: https URLs', () => {
    expect(transformProtocolUrl('nostrich:https://m.primal.net/xyz.webp', 'nostr')).toBe(
      'https://m.primal.net/xyz.webp',
    );
  });

  it('unwraps nostr:// style URLs', () => {
    expect(transformProtocolUrl('nostr://https://void.cat/f.png', 'nostr')).toBe(
      'https://void.cat/f.png',
    );
  });

  it('leaves plain https URLs untouched for nostr', () => {
    expect(transformProtocolUrl('https://void.cat/f.png', 'nostr')).toBe('https://void.cat/f.png');
  });

  it('upgrades SoundCloud -large artwork to -t500x500', () => {
    expect(transformProtocolUrl('https://i1.sndcdn.com/artworks-abc-large.jpg', 'soundcloud')).toBe(
      'https://i1.sndcdn.com/artworks-abc-t500x500.jpg',
    );
  });

  it('upgrades SoundCloud -large artwork regardless of protocol hint', () => {
    expect(transformProtocolUrl('https://i1.sndcdn.com/artworks-abc-large.jpg', null)).toBe(
      'https://i1.sndcdn.com/artworks-abc-t500x500.jpg',
    );
  });

  it('does not mangle non-SoundCloud URLs that contain -large', () => {
    const url = 'https://example.com/my-large-image.jpg';
    expect(transformProtocolUrl(url, 'rss')).toBe(url);
  });

  it('extracts maxresdefault from a YouTube watch URL', () => {
    expect(
      transformProtocolUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube'),
    ).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
  });

  it('extracts maxresdefault from a youtu.be short URL', () => {
    expect(transformProtocolUrl('https://youtu.be/dQw4w9WgXcQ', 'youtube')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    );
  });

  it('upgrades an existing hqdefault thumbnail to maxresdefault', () => {
    expect(
      transformProtocolUrl('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', 'youtube'),
    ).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
  });

  it('passes Mastodon remote URLs through unchanged', () => {
    const url = 'https://files.mastodon.social/media_attachments/files/123/original/x.png';
    expect(transformProtocolUrl(url, 'mastodon')).toBe(url);
  });

  it('returns empty string for empty input', () => {
    expect(transformProtocolUrl('', 'nostr')).toBe('');
    expect(transformProtocolUrl(null as unknown as string, 'nostr')).toBe(null as unknown as string);
  });
});

describe('handleImageProxy', () => {
  it('returns 400 when url is missing', async () => {
    const res = await handleImageProxy(
      new Request('https://example.com/api/image-proxy'),
      {} as never,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for a blocked/private URL', async () => {
    const res = await handleImageProxy(
      new Request('https://example.com/api/image-proxy?url=http%3A%2F%2F127.0.0.1%2Fimage.jpg'),
      {} as never,
    );
    expect(res.status).toBe(400);
  });

  it('adds Access-Control-Allow-Origin: * on successful fetches', async () => {
    const okImage = new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
      status: 200,
      headers: { 'content-type': 'image/png', 'content-length': '4' },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(okImage as unknown as Response);

    const res = await handleImageProxy(
      new Request('https://example.com/api/image-proxy?url=https%3A%2F%2Fimg.example.com%2Fa.png'),
      {} as never,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cache-control')).toContain('max-age=3600');
    expect(res.headers.get('x-image-proxy')).toBe('miss');
  });

  it('returns 404 when upstream is not found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('nope', { status: 404 }) as unknown as Response,
    );
    const res = await handleImageProxy(
      new Request('https://example.com/api/image-proxy?url=https%3A%2F%2Fimg.example.com%2Fmissing.png'),
      {} as never,
    );
    expect(res.status).toBe(404);
  });

  it('returns 415 when upstream is not an image', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('html', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }) as unknown as Response,
    );
    const res = await handleImageProxy(
      new Request('https://example.com/api/image-proxy?url=https%3A%2F%2Fimg.example.com%2Fpage.html'),
      {} as never,
    );
    expect(res.status).toBe(415);
  });

  it('returns 502 when upstream fetch throws (timeout)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('timeout'));
    const res = await handleImageProxy(
      new Request(
        'https://example.com/api/image-proxy?url=https%3A%2F%2Fimg.example.com%2Ftimeout.png',
      ),
      {} as never,
    );
    expect(res.status).toBe(502);
  });
});
