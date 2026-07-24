/**
 * DegenFeed Cross-Poster
 *
 * Posts content from one protocol to another.
 * Currently supports:
 *   - GoToSocial (ActivityPub) → Nostr Relay (via WebSocket)
 *   - Lemmy (ActivityPub) → also available via ActivityPub federation
 *
 * The cross-poster listens for new posts on GoToSocial and publishes them
 * to the self-hosted Nostr relay so content appears in both networks.
 *
 * To use: post on GoToSocial → automatically mirrored to Nostr relay
 */

import type { UnifiedPost } from './server';

const GTS_BASE = 'http://127.0.0.1:8082';
const NOSTR_RELAY = 'ws://127.0.0.1:8085';

// ─── Configuration ─────────────────────────────────────────────────────

interface CrossPostConfig {
  /** Source protocol */
  from: string;
  /** Target protocol */
  to: string;
  /** Whether cross-posting is enabled */
  enabled: boolean;
  /** Source-specific config */
  source: Record<string, string>;
  /** Target-specific config */
  target: Record<string, string>;
}

const CONFIG: CrossPostConfig[] = [
  {
    from: 'mastodon', // GoToSocial
    to: 'nostr', // Self-hosted Nostr relay
    enabled: true,
    source: {
      baseUrl: GTS_BASE,
      accessToken:
        '' || // Set via env GTS_ACCESS_TOKEN
        process.env.GTS_CLIENT_ID ||
        '',
    },
    target: {
      relayUrl: NOSTR_RELAY,
      privateKey: process.env.NOSTR_PRIVATE_KEY || '',
    },
  },
  {
    from: 'lemmy',
    to: 'activitypub', // Already AP-native; nothing extra needed
    enabled: true,
    source: { baseUrl: 'http://127.0.0.1:8536' },
    target: {},
  },
];

// ─── Nostr Event Signing ──────────────────────────────────────────────

/**
 * Create a Nostr event for a given post.
 * In production, this would be signed with a private key.
 * For now, we post as the relay itself (no signature = relay-level event).
 *
 * Full NIP-01 event structure:
 * {
 *   "id": <32-bytes lowercase hex-encoded sha256 of serialized event>,
 *   "pubkey": <32-bytes lowercase hex-encoded public key>,
 *   "created_at": <unix timestamp in seconds>,
 *   "kind": <integer>,
 *   "tags": [[<string>, <string>, ...]],
 *   "content": <string>,
 *   "sig": <64-bytes lowercase hex of signature>
 * }
 *
 * For unsigned relay events: we skip signature verification on our relay.
 * Our relay is configured with `restricted_writes: false` so it accepts
 * unauthenticated events.
 */

export function createNostrEvent(post: UnifiedPost): object {
  const now = Math.floor(Date.now() / 1000);

  return [
    'EVENT',
    {
      id: `df-${now}-${post.id.slice(-20)}`,
      pubkey: '0000000000000000000000000000000000000000000000000000000000000000',
      created_at: Math.floor(post.createdAt / 1000) || now,
      kind: 1, // Short Text Note
      tags: [
        ['t', 'degenfeed'],
        ['t', 'crosspost'],
        ['r', post.protocol],
        ['proxy', post.id, post.protocol],
      ],
      content: `${post.text}\n\n— originally from ${post.protocol}`,
      sig: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
  ];
}

// ─── Publish to Nostr ─────────────────────────────────────────────────

export async function publishToNostrRelay(post: UnifiedPost): Promise<boolean> {
  try {
    const eventMsg = createNostrEvent(post);

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(NOSTR_RELAY);
        const timer = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.addEventListener('open', () => {
          ws.send(JSON.stringify(eventMsg));
        });

        ws.addEventListener('message', (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string);
            if (msg[0] === 'OK') {
              clearTimeout(timer);
              ws.close();
              resolve(msg[1] === true || typeof msg[1] === 'string');
            }
          } catch {
            // ignore
          }
        });

        ws.addEventListener('error', () => {
          clearTimeout(timer);
          resolve(false);
        });

        ws.addEventListener('close', () => {
          clearTimeout(timer);
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

// ─── Fetch latest GTS post and cross-post ──────────────────────────────

async function fetchLatestGtsPost(): Promise<UnifiedPost | null> {
  try {
    const tokenRes = await fetch(`${GTS_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GTS_CLIENT_ID || '',
        client_secret: process.env.GTS_CLIENT_SECRET || '',
        grant_type: 'client_credentials',
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        scope: 'read:statuses read:accounts read:timelines',
      }),
    });

    if (!tokenRes.ok) {
      console.log('[crossposter] Cannot get GTS token');
      return null;
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) return null;

    const res = await fetch(`${GTS_BASE}/api/v1/timelines/public?local=true&limit=1`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!res.ok) return null;
    const raw = (await res.json()) as Array<{
      id: string;
      content: string;
      created_at: string;
      account: { id: string; username: string; acct: string; display_name: string };
    }>;

    if (!raw.length) return null;

    const s = raw[0];
    return {
      id: `mastodon:${s.id}@social.degenfeed.xyz`,
      protocol: 'mastodon',
      author: {
        id: `mastodon:${s.account.id}`,
        primary: { protocol: 'mastodon', id: s.account.id },
        handles: { mastodon: s.account.acct },
        displayName: s.account.display_name || s.account.username,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: s.content.replace(/<[^>]*>/g, '').trim(),
      embeds: [],
      createdAt: new Date(s.created_at).getTime(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: s,
      niches: [],
    };
  } catch {
    return null;
  }
}

// ─── Cross-post a post from one protocol to another ────────────────────

export async function crossPost(post: UnifiedPost): Promise<{
  success: boolean;
  targets: string[];
  errors: string[];
}> {
  const targets: string[] = [];
  const errors: string[] = [];

  for (const config of CONFIG) {
    if (!config.enabled) continue;
    if (config.from !== post.protocol) continue;

    if (config.to === 'nostr') {
      const ok = await publishToNostrRelay(post);
      if (ok) {
        targets.push('nostr');
        console.log(`[crossposter] Cross-posted to Nostr: ${post.id}`);
      } else {
        errors.push('nostr: publish failed');
      }
    }

    if (config.to === 'activitypub') {
      // ActivityPub-native protocols (GoToSocial, Lemmy, PeerTube)
      // already federate via AP. No extra work needed.
      targets.push('activitypub');
    }
  }

  return { success: errors.length === 0, targets, errors };
}

// ─── Poll and cross-post latest from GoToSocial ────────────────────────

let lastCrossPostedId = '';

export async function pollAndCrossPost(): Promise<void> {
  try {
    const post = await fetchLatestGtsPost();
    if (!post) {
      console.log('[crossposter] No posts found on GoToSocial');
      return;
    }

    if (post.id === lastCrossPostedId) {
      return; // Already cross-posted
    }

    const result = await crossPost(post);
    if (result.success) {
      lastCrossPostedId = post.id;
      console.log(`[crossposter] Successfully cross-posted to: ${result.targets.join(', ')}`);
    } else {
      console.log(`[crossposter] Cross-post errors: ${result.errors.join(', ')}`);
    }
  } catch (err) {
    console.log('[crossposter] Error:', (err as Error).message);
  }
}

// ─── Start polling loop ────────────────────────────────────────────────

export function startCrossPoster(intervalMs = 60000): NodeJS.Timeout {
  console.log(`[crossposter] Starting cross-post poll every ${intervalMs}ms`);
  // Run immediately, then every interval
  pollAndCrossPost();
  return setInterval(pollAndCrossPost, intervalMs);
}
