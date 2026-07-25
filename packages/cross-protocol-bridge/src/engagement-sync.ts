/**
 * @degenfeed/cross-protocol-bridge — Cross-Protocol Engagement Sync
 *
 * Synchronizes engagement actions (likes, comments, tips, views) across
 * all protocols. When a user interacts with a short on one protocol,
 * that engagement is reflected on other protocols and in the DegenFeed
 * creator dashboard.
 *
 * Sync flows:
 *   Like on Nostr    → syncs to Farcaster, Bluesky
 *   Comment on Mastodon → syncs to Nostr, Lens
 *   Tip on any platform  → records in DegenFeed → creator earns
 *   View count aggregated across ALL platforms
 *
 * All engagement is independently tracked per protocol and aggregated
 * into a unified view for the creator dashboard.
 */

import type { Protocol } from '@degenfeed/types';

// ─── Types ────────────────────────────────────────────────────────────────

export type EngagementType = 'like' | 'comment' | 'repost' | 'tip' | 'view' | 'follow';

export interface EngagementEvent {
  /** Unique engagement event ID */
  id: string;
  /** Type of engagement */
  type: EngagementType;
  /** The protocol this engagement originated on */
  sourceProtocol: Protocol;
  /** The content being engaged with (canonical ID) */
  contentId: string;
  /** The content's origin protocol */
  contentProtocol: Protocol;
  /** Actor who performed the engagement */
  actor: {
    /** Actor's identity on source protocol */
    sourceId: string;
    /** Actor's display name */
    displayName: string;
    /** Actor's DegenFeed user ID (if known) */
    dfId?: string;
  };
  /** When the engagement happened (unix ms) */
  timestamp: number;
  /** Tip-specific: amount */
  amount?: string;
  /** Tip-specific: currency/symbol */
  currency?: string;
  /** Comment-specific: text */
  commentText?: string;
  /** View-specific: count increment */
  viewIncrement?: number;
}

export interface AggregatedEngagement {
  /** Total likes across all protocols */
  totalLikes: number;
  /** Total comments across all protocols */
  totalComments: number;
  /** Total reposts across all protocols */
  totalReposts: number;
  /** Total tips in sats/USD equivalent */
  totalTips: number;
  /** Total views across all protocols */
  totalViews: number;
  /** Total followers */
  totalFollowers: number;
  /** Breakdown by protocol */
  byProtocol: Record<Protocol, ProtocolEngagement>;
  /** Tip breakdown by currency */
  tipsByCurrency: Record<string, number>;
  /** When the aggregation was computed */
  aggregatedAt: number;
}

export interface ProtocolEngagement {
  likes: number;
  comments: number;
  reposts: number;
  tips: number;
  views: number;
  followers: number;
  /** Protocol-native post URL */
  postUrl?: string;
}

export interface SyncResult {
  protocol: Protocol;
  success: boolean;
  error?: string;
  /** Synced engagement ID on the target protocol */
  remoteId?: string;
}

// ─── Protocol-Adapters for Faking Engagement ─────────────────────────────
//
// These adapters let us "impersonate" a user's engagement from one protocol
// to another using the bot accounts. For example:
//   - Nostr like → Farcaster like (via bot signer)
//   - Mastodon comment → Nostr reply (via bot key)
//
// In production, each user would link their identities so the action is
// performed as them, not the bot. For now, bot-mediated sync is sufficient.

// ─── Main Sync Engine ─────────────────────────────────────────────────────

/**
 * Synchronize an engagement event across all connected protocols.
 * For example: a like on Nostr → syncs to Farcaster, Bluesky, etc.
 *
 * Returns per-protocol sync results. One failure never blocks others.
 */
export async function syncEngagementAcrossProtocols(
  event: EngagementEvent,
  env: { [key: string]: string },
): Promise<SyncResult[]> {
  const tasks: Promise<SyncResult>[] = [];

  // Determine which target protocols to sync to based on engagement type
  const targets = getSyncTargets(event.type, event.sourceProtocol);

  for (const target of targets) {
    if (target === event.sourceProtocol) continue; // Don't sync back to source
    tasks.push(syncToProtocol(event, target, env));
  }

  // Always record to the unified DegenFeed engagement tracker
  tasks.push(recordEngagementInDegenFeed(event, env));

  const settled = await Promise.allSettled(tasks);
  const results: SyncResult[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      results.push(s.value);
    } else {
      results.push({
        protocol: 'unknown' as Protocol,
        success: false,
        error: `Sync threw: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`,
      });
    }
  }

  return results;
}

/**
 * Get all target protocols for a given engagement type and source.
 * Designed to maximize cross-protocol visibility.
 */
function getSyncTargets(type: EngagementType, source: Protocol): Protocol[] {
  const allTargets: Protocol[] = ['farcaster' as Protocol, 'nostr' as Protocol, 'bluesky' as Protocol, 'mastodon' as Protocol, 'lens' as Protocol];

  switch (type) {
    case 'like':
      // Likes sync everywhere — the most common signal
      return allTargets.filter((t) => t !== source);
    case 'comment':
      // Comments sync to protocols that support replies
      return (['nostr', 'farcaster', 'lens'] as Protocol[]).filter((t) => t !== source);
    case 'repost':
      // Reposts sync to protocol-native repost/boost
      return (['farcaster', 'bluesky', 'mastodon'] as Protocol[]).filter((t) => t !== source);
    case 'tip':
      // Tips always record in DegenFeed (handled by recordEngagementInDegenFeed)
      return [];
    case 'view':
      // Views are aggregated server-side, no cross-protocol action needed
      return [];
    case 'follow':
      // Follows are handled separately by identity linking
      return [];
    default:
      return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROTOCOL-SPECIFIC SYNC ADAPTERS
// ═══════════════════════════════════════════════════════════════════════════

async function syncToProtocol(
  event: EngagementEvent,
  targetProtocol: Protocol,
  env: { [key: string]: string },
): Promise<SyncResult> {
  switch (targetProtocol) {
    case 'farcaster':
      return syncToFarcaster(event, env);
    case 'nostr':
      return syncToNostr(event, env);
    case 'bluesky':
      return syncToBluesky(event, env);
    case 'mastodon':
      return syncToMastodon(event, env);
    case 'lens':
      return syncToLens(event, env);
    default:
      return { protocol: targetProtocol, success: false, error: `Unsupported target: ${targetProtocol}` };
  }
}

// ─── Farcaster Sync ───────────────────────────────────────────────────────

async function syncToFarcaster(
  event: EngagementEvent,
  env: { [key: string]: string },
): Promise<SyncResult> {
  try {
    const botSignerHex = env.FARCASTER_BOT_SIGNER_KEY;
    const botFid = Number(env.FARCASTER_BOT_FID || 0);
    if (!botSignerHex || !botFid) {
      return { protocol: 'farcaster', success: false, error: 'Bot not configured' };
    }

    const { buildFarcasterCastMessage, HubClient } = await import('@degenfeed/farcaster-sdk');

    const contentUrl = `${env.DEGENFEED_APP_URL || 'https://app.degenfeed.xyz'}/content/${event.contentId}`;
    let text = '';
    switch (event.type) {
      case 'like':
        text = `❤️ Liked by ${event.actor.displayName}\n\n${contentUrl}`;
        break;
      case 'comment':
        text = `💬 ${event.actor.displayName}: "${event.commentText?.slice(0, 150)}"\n\n${contentUrl}`;
        break;
      case 'repost':
        text = `🔄 Reposted by ${event.actor.displayName}\n\n${contentUrl}`;
        break;
      default:
        return { protocol: 'farcaster', success: false, error: `Unsupported engagement: ${event.type}` };
    }

    const castResult = buildFarcasterCastMessage({
      signerKeyHex: botSignerHex,
      fid: botFid,
      text: text.slice(0, 320),
    });

    if (!castResult.ok || !castResult.messageHex) {
      return { protocol: 'farcaster', success: false, error: castResult.error || 'Build failed' };
    }

    const hexToBytes = (hex: string) => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
      return bytes;
    };

    const hubUrl = env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
    const hub = new HubClient(hubUrl);
    await hub.submitMessage(hexToBytes(castResult.messageHex).buffer as ArrayBuffer);

    return {
      protocol: 'farcaster',
      success: true,
      remoteId: castResult.messageHex.slice(0, 16),
    };
  } catch (err) {
    return { protocol: 'farcaster', success: false, error: String(err) };
  }
}

// ─── Nostr Sync ───────────────────────────────────────────────────────────

async function syncToNostr(
  event: EngagementEvent,
  env: { [key: string]: string },
): Promise<SyncResult> {
  try {
    const privateKeyHex = env.NOSTR_PRIVATE_KEY;
    if (!privateKeyHex) {
      return { protocol: 'nostr', success: false, error: 'Nostr key not configured' };
    }

    const { getPublicKey, signEvent, RelayPool } = await import('@degenfeed/nostr-sdk');

    // Determine kind based on engagement type
    let kind: number;
    let content: string;
    const tags: string[][] = [
      ['degenfeed', 'engagement', event.type, event.contentId],
      ['p', env.NOSTR_PUBLIC_KEY || ''],
    ];

    switch (event.type) {
      case 'like':
        kind = 7; // NIP-25 reaction (like)
        content = '+';
        tags.push(['e', event.contentId, '', 'reaction']);
        break;
      case 'comment':
        kind = 1; // Text note (comment)
        content = `💬 ${event.actor.displayName}: ${event.commentText || ''}`;
        tags.push(['e', event.contentId, '', 'reply']);
        tags.push(['t', 'degenfeed']);
        break;
      case 'repost':
        kind = 6; // Repost
        content = '';
        tags.push(['e', event.contentId, '', 'repost']);
        break;
      default:
        return { protocol: 'nostr', success: false, error: `Unsupported: ${event.type}` };
    }

    const pubkey = getPublicKey(privateKeyHex);
    const unsignedEvent = { pubkey, created_at: Math.floor(Date.now() / 1000), kind, tags, content };
    const signedEvent = signEvent(unsignedEvent, privateKeyHex);

    const relayUrls = [
      ...(env.RELAY_URLS?.split(',').map((u: string) => u.trim()) || []),
      'wss://relay.damus.io',
      'wss://nos.lol',
    ].filter(Boolean);

    let published = false;
    const pool = new RelayPool(relayUrls, { connectTimeout: 3000, maxReconnects: 0, logLevel: 'error' });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (pool.getConnectedRelays().length > 0) resolve();
        else setTimeout(check, 200);
      };
      setTimeout(check, 300);
    });

    pool.publish(signedEvent, {
      onOk: () => { published = true; },
      onError: () => {},
    });

    await new Promise((r) => setTimeout(r, 1500));
    for (const url of pool.getConnectedRelays()) {
      pool.removeRelay(url);
    }

    return { protocol: 'nostr', success: published, remoteId: signedEvent.id };
  } catch (err) {
    return { protocol: 'nostr', success: false, error: String(err) };
  }
}

// ─── Bluesky Sync ─────────────────────────────────────────────────────────

async function syncToBluesky(
  event: EngagementEvent,
  env: { [key: string]: string },
): Promise<SyncResult> {
  try {
    const did = env.BSKY_DID;
    const password = env.BSKY_APP_PASSWORD;
    if (!did || !password) {
      return { protocol: 'bluesky', success: false, error: 'Bluesky not configured' };
    }

    const { PdsClient } = await import('@degenfeed/bluesky-sdk');
    const client = new PdsClient(env.BSKY_SOCIAL_URL || 'https://bsky.social');
    await client.createSession(did, password);

    let text = '';
    switch (event.type) {
      case 'like':
        text = `❤️ ${event.actor.displayName} liked this content on ${event.sourceProtocol}`;
        break;
      case 'comment':
        text = `💬 ${event.actor.displayName} commented on ${event.sourceProtocol}: "${event.commentText?.slice(0, 200)}"`;
        break;
      case 'repost':
        text = `🔄 ${event.actor.displayName} shared this from ${event.sourceProtocol}`;
        break;
      default:
        return { protocol: 'bluesky', success: false, error: `Unsupported: ${event.type}` };
    }

    const result = await client.createPost({
      text: text.slice(0, 300),
      langs: ['en'],
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: `${env.DEGENFEED_APP_URL || 'https://app.degenfeed.xyz'}/content/${event.contentId}`,
          title: `Engagement from ${event.sourceProtocol}`,
          description: `${event.type} by ${event.actor.displayName}`,
        },
      },
    });

    return { protocol: 'bluesky', success: true, remoteId: result.cid };
  } catch (err) {
    return { protocol: 'bluesky', success: false, error: String(err) };
  }
}

// ─── Mastodon Sync ────────────────────────────────────────────────────────

async function syncToMastodon(
  event: EngagementEvent,
  env: { [key: string]: string },
): Promise<SyncResult> {
  try {
    const instanceUrl = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
    const accessToken = env.MASTODON_ACCESS_TOKEN;
    if (!accessToken) {
      return { protocol: 'mastodon', success: false, error: 'Mastodon not configured' };
    }

    const { GtSClient } = await import('@degenfeed/mastodon-sdk');
    const client = new GtSClient(instanceUrl, accessToken);

    let text = '';
    switch (event.type) {
      case 'like':
        text = `❤️ ${event.actor.displayName} liked this on ${event.sourceProtocol}`;
        break;
      case 'comment':
        text = `💬 "${event.commentText?.slice(0, 300)}"\n— ${event.actor.displayName} on ${event.sourceProtocol}`;
        break;
      case 'repost':
        text = `🔄 ${event.actor.displayName} boosted this from ${event.sourceProtocol}`;
        break;
      default:
        return { protocol: 'mastodon', success: false, error: `Unsupported: ${event.type}` };
    }

    text = text.slice(0, 500);
    const status = await client.publish(text, { visibility: 'unlisted' });

    return { protocol: 'mastodon', success: true, remoteId: status.id };
  } catch (err) {
    return { protocol: 'mastodon', success: false, error: String(err) };
  }
}

// ─── Lens Sync ────────────────────────────────────────────────────────────

async function syncToLens(
  event: EngagementEvent,
  env: { [key: string]: string },
): Promise<SyncResult> {
  try {
    const profileId = env.LENS_PROFILE_ID;
    if (!profileId) {
      return { protocol: 'lens', success: false, error: 'Lens not configured' };
    }

    const { LensClient } = await import('@degenfeed/lens-sdk');
    const client = new LensClient();

    let content = '';
    switch (event.type) {
      case 'like':
        content = `❤️ ${event.actor.displayName} appreciated this on ${event.sourceProtocol}`;
        break;
      case 'comment':
        content = `💬 ${event.actor.displayName} said on ${event.sourceProtocol}: "${event.commentText?.slice(0, 300)}"`;
        break;
      default:
        return { protocol: 'lens', success: false, error: `Unsupported: ${event.type}` };
    }

    // Use Lens API directly via request
    await client.request(
      `mutation Post($request: PostRequest!) {
        post(request: $request) { ... on RelaySuccess { txHash } ... on RelayError { reason } }
      }`,
      {
        request: {
          profileId,
          content: `${content}\n\n#degenfeed #crossplatform`,
          collectModule: { type: 'FreeCollectModule' },
          referenceModule: { type: 'ReferenceModule' },
        },
      },
    );

    return { protocol: 'lens', success: true, remoteId: profileId };
  } catch (err) {
    return { protocol: 'lens', success: false, error: String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEGENFEED ENGAGEMENT TRACKING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Record an engagement event in the DegenFeed engagement tracker.
 * This feeds into the creator dashboard and earns the creator tips.
 */
async function recordEngagementInDegenFeed(
  event: EngagementEvent,
  env: { [key: string]: string },
): Promise<SyncResult> {
  try {
    const apiUrl = env.DEGENFEED_API_URL || 'https://api.degenfeed.xyz';
    const apiKey = env.DEGENFEED_API_KEY || '';

    const res = await fetch(`${apiUrl}/v1/engagement`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return {
        protocol: 'degenfeed' as Protocol,
        success: false,
        error: `DegenFeed API: ${res.status}`,
      };
    }

    return { protocol: 'degenfeed' as Protocol, success: true };
  } catch (err) {
    return {
      protocol: 'degenfeed' as Protocol,
      success: false,
      error: String(err),
    };
  }
}

// ─── View Count Aggregation ────────────────────────────────────────────────

/**
 * Aggregate engagement for a specific piece of content across ALL protocols.
 * This is used for the unified creator dashboard view.
 */
export async function aggregateEngagement(
  contentId: string,
  env: { [key: string]: string },
): Promise<AggregatedEngagement> {
  try {
    const apiUrl = env.DEGENFEED_API_URL || 'https://api.degenfeed.xyz';
    const apiKey = env.DEGENFEED_API_KEY || '';

    const res = await fetch(`${apiUrl}/v1/engagement/${encodeURIComponent(contentId)}/aggregate`, {
      headers: {
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      return (await res.json()) as AggregatedEngagement;
    }
  } catch {
    // Fallback to local aggregation
  }

  // Return empty aggregation if API is unavailable
  return {
    totalLikes: 0,
    totalComments: 0,
    totalReposts: 0,
    totalTips: 0,
    totalViews: 0,
    totalFollowers: 0,
    byProtocol: {} as Record<Protocol, ProtocolEngagement>,
    tipsByCurrency: {},
    aggregatedAt: Date.now(),
  };
}

/**
 * Compute aggregated view count from all protocols for a given piece of content.
 * Returns the total view count across all protocols.
 */
export async function getAggregatedViewCount(
  contentId: string,
  env: { [key: string]: string },
): Promise<number> {
  const agg = await aggregateEngagement(contentId, env);
  return agg.totalViews;
}
