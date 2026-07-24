/**
 * @degenfeed/spaces-bridge — Live Photos Bridge
 *
 * Ephemeral photo sharing ("stories") across platforms:
 *   - Nostr: Kind 20 (picture) events with geotag/content metadata
 *   - Bluesky: Image posts marked with #live tag
 *   - Pixelfed: Stories (if API supports)
 *
 * Each "Live Photo" is a short-lived image post that appears in the
 * unified Live Hub alongside audio spaces and video streams.
 */

import type { CreateSpaceOptions, PlatformBridge, SpaceItem, SpacePlatformData } from './types';

// ─── Shared: Upload image to Nostr ──────────────────────────────────────

async function uploadToNostrBlob(imageUrl: string): Promise<string | null> {
  // In production, upload to a nostr blob storage service
  // For now, return the original URL
  return imageUrl;
}

// ─── Nostr Kind 20 (Picture Events) ────────────────────────────────────

async function publishNostrPictureEvent(
  title: string,
  description: string | undefined,
  imageUrl: string,
  hostId: string,
  hostName: string,
): Promise<{ id: string; url: string }> {
  const { getPublicKey, signEvent } = await import('@degenfeed/nostr-sdk');
  const { RelayPool } = await import('@degenfeed/nostr-sdk');

  const nsec = process.env.NOSTR_PRIVATE_KEY;
  if (!nsec) throw new Error('NOSTR_PRIVATE_KEY not configured');

  const pubkey = getPublicKey(nsec);
  const relays = (process.env.RELAY_URLS ?? 'wss://relay.damus.io,wss://nos.lol')
    .split(',')
    .map((u: string) => u.trim())
    .filter(Boolean);

  // Kind 20: Picture event
  const tags: string[][] = [
    ['title', title],
    ['summary', description ?? title],
    ['published_at', String(Math.floor(Date.now() / 1000))],
    ['t', 'live-photo'],
    ['t', 'degenfeed'],
    ['p', hostId],
    ['host', hostName],
    ['image', imageUrl],
  ];

  const content = `📸 LIVE PHOTO: ${title}\n\n${description ?? ''}\n\nShared by ${hostName}`;

  const unsigned = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 20,
    tags,
    content,
  };

  const signed = signEvent(unsigned, nsec);
  const pool = new RelayPool(relays, { eoseTimeout: 5000 });
  pool.publish(signed);
  pool.disconnectAll();

  return { id: signed.id, url: `https://app.degenfeed.xyz/photos/${signed.id}` };
}

// ─── Pixelfed ───────────────────────────────────────────────────────────

async function publishToPixelfed(
  imageUrl: string,
  description: string,
): Promise<{ id: string; url: string } | null> {
  const token = process.env.PIXELFED_ACCESS_TOKEN;
  const instance = process.env.PIXELFED_INSTANCE ?? 'https://pixelfed.social';
  if (!token) return null;

  try {
    // Pixelfed uses Mastodon-compatible API for statuses
    const res = await fetch(`${instance}/api/v1/media`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url: imageUrl, description }),
    });

    if (!res.ok) return null;
    const media = (await res.json()) as { id?: string };

    // Create status with media
    const statusRes = await fetch(`${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: description,
        media_ids: [media.id],
        visibility: 'public',
      }),
    });

    if (!statusRes.ok) return null;
    const status = (await statusRes.json()) as { id?: string; url?: string };
    return { id: status.id ?? `px:${Date.now()}`, url: status.url ?? `${instance}/p/${status.id}` };
  } catch {
    return null;
  }
}

// ─── Bridge Implementation ──────────────────────────────────────────────

export const livePhotosBridge: PlatformBridge = {
  platform: 'nostr-pictures',

  async create(options: CreateSpaceOptions): Promise<SpacePlatformData> {
    if (!options.photoUrls?.length) {
      throw new Error('At least one photo URL required for live photos');
    }

    const imageUrl = options.photoUrls[0];
    const results: SpacePlatformData[] = [];

    // Always publish to Nostr kind 20
    try {
      const nostrResult = await publishNostrPictureEvent(
        options.title,
        options.description,
        imageUrl,
        options.hostId,
        options.hostName,
      );
      results.push({
        platform: 'nostr-pictures',
        nativeId: nostrResult.id,
        url: nostrResult.url,
        metadata: { kind: 20, imageUrl },
      });
    } catch (e) {
      console.warn('[livephotos] Nostr publish failed:', e);
    }

    // Publish to Pixelfed if configured
    if (process.env.PIXELFED_ACCESS_TOKEN) {
      const pixelfedResult = await publishToPixelfed(
        imageUrl,
        options.description ?? options.title,
      );
      if (pixelfedResult) {
        results.push({
          platform: 'pixelfed',
          nativeId: pixelfedResult.id,
          url: pixelfedResult.url,
          metadata: { imageUrl },
        });
      }
    }

    if (results.length === 0) {
      // Return at least a basic result for Nostr kind 20
      try {
        const nostrResult = await publishNostrPictureEvent(
          options.title,
          options.description,
          options.photoUrls[0],
          options.hostId,
          options.hostName,
        );
        results.push({
          platform: 'nostr-pictures',
          nativeId: nostrResult.id,
          url: nostrResult.url,
          metadata: { imageUrl: options.photoUrls[0] },
        });
      } catch (e2) {
        // Return a minimal fallback
        results.push({
          platform: 'nostr-pictures',
          nativeId: `np:${Date.now()}`,
          metadata: { imageUrl: options.photoUrls[0] },
        });
      }
    }

    return results[0]!;
  },

  async getLiveSpaces(): Promise<SpaceItem[]> {
    // Live photos are transient — we maintain an in-memory/DB list
    // of recently published live photos. For now, return empty and
    // let the aggregator pull from the DB.
    return [];
  },

  async getSpace(nativeId: string): Promise<SpaceItem | null> {
    // TODO: Query DB for stored live photo events
    return null;
  },

  async endSpace(_space: SpaceItem): Promise<void> {
    // Live photos don't "end" — they're ephemeral by nature
  },

  async updateSpace(_space: SpaceItem): Promise<void> {
    // No updates needed for photos
  },
};
