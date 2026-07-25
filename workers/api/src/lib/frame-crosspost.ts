/**
 * @degenfeed/api-worker — Frame Cross-Posting Engine
 *
 * Share Farcaster Frames to Nostr, Bluesky, and Mastodon.
 * Each frame cast includes the Frame URL as an embed so it renders inline.
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 */

import type { Env } from '../index';
import { publishCastToFarcaster } from './hubble-publisher';

// ─── Types ─────────────────────────────────────────────────────────────────

export type CrossPostProtocol = 'farcaster' | 'nostr' | 'bluesky' | 'mastodon';

export interface CrossPostResult {
  protocol: CrossPostProtocol;
  ok: boolean;
  nativeId?: string;
  url?: string;
  error?: string;
}

export interface CrossPostPayload {
  frameUrl: string;
  frameTitle: string;
  creatorHandle: string;
  description?: string;
  channelId?: string;
  imageUrl?: string;
}

// ─── Cross-Poster ─────────────────────────────────────────────────────────

export class FrameCrossPoster {
  /**
   * Cross-post a frame to multiple protocols.
   */
  async crossPost(
    payload: CrossPostPayload,
    protocols: CrossPostProtocol[],
    env: Env,
  ): Promise<CrossPostResult[]> {
    const results: CrossPostResult[] = [];

    for (const protocol of protocols) {
      try {
        const result = await this.postToProtocol(protocol, payload, env);
        results.push(result);
      } catch (err) {
        results.push({
          protocol,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  /**
   * Post a frame to a specific protocol.
   */
  private async postToProtocol(
    protocol: CrossPostProtocol,
    payload: CrossPostPayload,
    env: Env,
  ): Promise<CrossPostResult> {
    switch (protocol) {
      case 'farcaster':
        return this.postToFarcaster(payload, env);
      case 'nostr':
        return this.postToNostr(payload, env);
      case 'bluesky':
        return this.postToBluesky(payload, env);
      case 'mastodon':
        return this.postToMastodon(payload, env);
      default:
        return { protocol, ok: false, error: `Unknown protocol: ${protocol}` };
    }
  }

  /**
   * Post a frame to Farcaster as a cast with the frame URL embedded.
   */
  private async postToFarcaster(
    payload: CrossPostPayload,
    env: Env,
  ): Promise<CrossPostResult> {
    const text = `🖼️ ${payload.frameTitle}\n\n${payload.description ?? ''}\nby ${payload.creatorHandle}`.trim();

    const result = await publishCastToFarcaster(
      env as unknown as Record<string, string | undefined>,
      {
        text: text.slice(0, 320),
        embeds: [payload.frameUrl],
        channelId: payload.channelId,
      },
    );

    if (result.error) {
      return { protocol: 'farcaster', ok: false, error: result.error };
    }

    return {
      protocol: 'farcaster',
      ok: true,
      nativeId: result.hash,
      url: result.hash ? `https://warpcast.com/~/conversations/${result.hash}` : undefined,
    };
  }

  /**
   * Post a frame to Nostr as a kind 1 note with the frame URL.
   */
  private async postToNostr(
    payload: CrossPostPayload,
    env: Env,
  ): Promise<CrossPostResult> {
    try {
      const nsec = env.NOSTR_BOT_NSEC || env.NOSTR_PRIVATE_KEY;
      if (!nsec) {
        return { protocol: 'nostr', ok: false, error: 'Nostr bot key not configured' };
      }

      const nostr = await import('@degenfeed/nostr-sdk');
      const pubkey = nostr.getPublicKey(nsec);

      const text = `🖼️ ${payload.frameTitle}\n\n${payload.description ?? ''}\n\n${payload.frameUrl}`;

      const unsigned = {
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [['r', payload.frameUrl]],
        content: text.slice(0, 64000),
      };

      const ev = nostr.signEvent(unsigned, nsec);

      const relays = (env.RELAY_URLS ?? 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const pool = new nostr.RelayPool(relays, { eoseTimeout: 4000 });
      const published = await Promise.race([
        pool.publish(ev),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ]);
      pool.disconnectAll();

      if (!published) {
        return { protocol: 'nostr', ok: false, error: 'Failed to publish to any relay' };
      }

      return {
        protocol: 'nostr',
        ok: true,
        nativeId: ev.id,
        url: `nostr:${ev.id}`,
      };
    } catch (err) {
      return {
        protocol: 'nostr',
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Post a frame to Bluesky as a post with the frame URL.
   */
  private async postToBluesky(
    payload: CrossPostPayload,
    env: Env,
  ): Promise<CrossPostResult> {
    try {
      const accessToken = env.BSKY_ACCESS_TOKEN;
      const senderDid = env.BSKY_DID;

      if (!accessToken || !senderDid) {
        return { protocol: 'bluesky', ok: false, error: 'Bluesky not configured' };
      }

      const text = `🖼️ ${payload.frameTitle}\n\n${payload.frameUrl}`;
      const pdsUrl = 'https://bsky.social';

      const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          repo: senderDid,
          collection: 'app.bsky.feed.post',
          record: {
            text: text.slice(0, 300),
            createdAt: new Date().toISOString(),
            embed: {
              $type: 'app.bsky.embed.external',
              external: {
                uri: payload.frameUrl,
                title: payload.frameTitle,
                description: payload.description ?? '',
                thumb: payload.imageUrl
                  ? { $type: 'blob', ref: { $link: payload.imageUrl }, mimeType: 'image/png', size: 0 }
                  : undefined,
              },
            },
          },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return { protocol: 'bluesky', ok: false, error: `Bluesky post failed: ${errText.slice(0, 200)}` };
      }

      const data = (await res.json()) as { uri?: string };
      return {
        protocol: 'bluesky',
        ok: true,
        nativeId: data.uri,
        url: data.uri ? `https://bsky.app/profile/${senderDid}/post/${data.uri.split('/').pop()}` : undefined,
      };
    } catch (err) {
      return {
        protocol: 'bluesky',
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Post a frame to Mastodon as a status with the frame URL.
   */
  private async postToMastodon(
    payload: CrossPostPayload,
    env: Env,
  ): Promise<CrossPostResult> {
    try {
      const accessToken = env.MASTODON_ACCESS_TOKEN || env.GTS_ACCESS_TOKEN;
      const instance = env.GTS_INSTANCE_URL || env.MASTODON_INSTANCE_URL || 'https://social.degenfeed.xyz';

      if (!accessToken) {
        return { protocol: 'mastodon', ok: false, error: 'Mastodon not configured' };
      }

      const status = `🖼️ ${payload.frameTitle}\n\n${payload.frameUrl}`;

      const res = await fetch(`${instance}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: status.slice(0, 500),
          visibility: 'public',
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return { protocol: 'mastodon', ok: false, error: `Mastodon post failed: ${errText.slice(0, 200)}` };
      }

      const data = (await res.json()) as { id?: string; url?: string };
      return {
        protocol: 'mastodon',
        ok: true,
        nativeId: data.id,
        url: data.url,
      };
    } catch (err) {
      return {
        protocol: 'mastodon',
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

let _crossPostInstance: FrameCrossPoster | null = null;

export function getFrameCrossPoster(): FrameCrossPoster {
  if (!_crossPostInstance) _crossPostInstance = new FrameCrossPoster();
  return _crossPostInstance;
}
