/**
 * Real-time feed via Server-Sent Events (SSE).
 *
 * GET /api/feed/stream?protocols=nostr,farcaster&sort=hot
 *
 * Opens an SSE connection. Polls providers every 30s, deduplicates
 * against already-sent posts, and pushes new ones to the client.
 */

import { enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { parseProtocols } from '@degenfeed/utils';
import type { Env } from '../index';
import { DEFAULT_PROTOCOLS, getProvider } from './feed';

export async function handleStreamFeed(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const protocols = parseProtocols(url.searchParams.get('protocols'), DEFAULT_PROTOCOLS).slice(
    0,
    5,
  );

  const headers = new Headers({
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'access-control-allow-origin': '*',
  });

  const encoder = new TextEncoder();
  const sent = new Set<string>();

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const send = async (event: string, data: unknown) => {
    const payload = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    await writer.write(payload);
  };

  const poll = async () => {
    try {
      const results = await Promise.allSettled(
        protocols.map(async (protocol) => {
          try {
            const provider = getProvider(protocol, env);
            const result = await provider.fetchFeed({
              timeoutMs: 4000,
              concurrency: 2,
            });
            return result.posts.filter((p) => !isSpamPost(p)).map(enrichPostNiches);
          } catch {
            return [] as UnifiedPost[];
          }
        }),
      );

      const newPosts: UnifiedPost[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const p of r.value) {
            if (!sent.has(p.id)) {
              sent.add(p.id);
              newPosts.push(p);
            }
          }
        }
      }

      if (newPosts.length > 0) {
        await send('posts', {
          count: newPosts.length,
          posts: newPosts.slice(0, 10),
        });
      } else {
        await send('heartbeat', { at: Date.now() });
      }
    } catch {
      await send('heartbeat', { at: Date.now(), error: 'poll failed' });
    }
  };

  // Keep the connection open with periodic polling
  const keepAlive = async () => {
    await send('connected', { protocols, at: Date.now() });

    // Initial poll
    await poll();

    // Poll every 30s
    const interval = setInterval(async () => {
      try {
        await poll();
      } catch {
        /* KV operation failed -- non-critical, continue */
      }
    }, 30_000);

    // Clean up on disconnect
    const abortSignal = request.signal;
    abortSignal.addEventListener('abort', () => {
      clearInterval(interval);
      writer.close().catch(() => {});
    });
  };

  // Don't await — run in background
  void keepAlive();

  return new Response(readable, { headers });
}
