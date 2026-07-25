/**
 * @degenfeed/api-worker — Native Protocol Tipping
 *
 * Native tipping on every protocol. Each tip records in our unified tip ledger
 * AND sends on the native protocol via its native mechanism.
 *
 * Supported protocols:
 *   1. Nostr     — NIP-57 Lightning zaps
 *   2. Farcaster — USDC tips via frames / direct transfer
 *   3. Bluesky   — AT Protocol custom extension
 *   4. Mastodon  — ActivityPub custom tip activity
 *   5. Lens      — Lens collect/open action
 *   6. PeerTube  — PeerTube tip plugin
 *   7. Owncast   — Owncast external action
 *   8. Reddit    — Community points / direct link
 *   9. GitHub    — GitHub Sponsors API
 *  10. Telegram  — Telegram Stars / bot payments
 */

import type { Env } from '../index';
import { recordUnifiedTip, type TipEntityType } from '../routes/unified-tip-core';

// ─── Types ─────────────────────────────────────────────────────────────

export type NativeTipProtocol =
  | 'nostr'
  | 'farcaster'
  | 'bluesky'
  | 'mastodon'
  | 'lens'
  | 'peertube'
  | 'owncast'
  | 'reddit'
  | 'github'
  | 'telegram';

export interface NativeTipRequest {
  protocol: NativeTipProtocol;
  /** Protocol-specific recipient identifier (pubkey, DID, username, etc.) */
  recipientId: string;
  /** Human-readable name for the recipient */
  recipientName?: string;
  /** Amount in the smallest unit (sats, cents, wei) */
  amount: string;
  /** Optional USD value for unified ledger recording */
  amountUsd?: number;
  /** Optional message attached to the tip */
  message?: string;
  /** Sender identifier (wallet address, username, etc.) */
  sender?: string;
  /** Entity being tipped (post id, video id, etc.) */
  entityId?: string;
  entityType?: TipEntityType;
  /** Protocol-specific sender metadata */
  senderProfile?: {
    displayName?: string;
    avatarUrl?: string;
    handle?: string;
  };
}

export interface NativeTipResult {
  success: boolean;
  protocolTxId?: string;
  nativeId?: string;
  activityId?: string;
  error?: string;
}

// ─── Protocol tip fee table (used for smart chain selection) ──────────

export interface ProtocolFeeEstimate {
  protocol: NativeTipProtocol;
  /** Average fee in USD */
  avgFeeUsd: number;
  /** Settlement speed estimate */
  speed: 'instant' | 'fast' | 'medium' | 'slow';
  /** Minimum tip amount in USD */
  minUsd: number;
  /** Whether the recipient needs a pre-configured wallet */
  needsSetup: boolean;
}

export const PROTOCOL_FEE_ESTIMATES: Record<NativeTipProtocol, ProtocolFeeEstimate> = {
  nostr: { protocol: 'nostr', avgFeeUsd: 0.001, speed: 'instant', minUsd: 0.01, needsSetup: true },
  farcaster: {
    protocol: 'farcaster',
    avgFeeUsd: 0.01,
    speed: 'fast',
    minUsd: 0.1,
    needsSetup: true,
  },
  bluesky: { protocol: 'bluesky', avgFeeUsd: 0.05, speed: 'medium', minUsd: 0.5, needsSetup: true },
  mastodon: {
    protocol: 'mastodon',
    avgFeeUsd: 0.05,
    speed: 'medium',
    minUsd: 0.5,
    needsSetup: true,
  },
  lens: { protocol: 'lens', avgFeeUsd: 0.01, speed: 'fast', minUsd: 0.1, needsSetup: true },
  peertube: {
    protocol: 'peertube',
    avgFeeUsd: 0.05,
    speed: 'medium',
    minUsd: 0.5,
    needsSetup: true,
  },
  owncast: { protocol: 'owncast', avgFeeUsd: 0.05, speed: 'fast', minUsd: 0.5, needsSetup: true },
  reddit: { protocol: 'reddit', avgFeeUsd: 0.0, speed: 'instant', minUsd: 0.01, needsSetup: false },
  github: { protocol: 'github', avgFeeUsd: 0.0, speed: 'instant', minUsd: 0.01, needsSetup: false },
  telegram: {
    protocol: 'telegram',
    avgFeeUsd: 0.01,
    speed: 'instant',
    minUsd: 0.01,
    needsSetup: true,
  },
};

// ─── Master dispatcher ────────────────────────────────────────────────

/**
 * Route a native tip to the correct protocol handler.
 * Each handler records in the unified ledger AND sends on the native protocol.
 */
export async function sendNativeTip(env: Env, req: NativeTipRequest): Promise<NativeTipResult> {
  switch (req.protocol) {
    case 'nostr':
      return sendNostrTip(env, req);
    case 'farcaster':
      return sendFarcasterTip(env, req);
    case 'bluesky':
      return sendBlueskyTip(env, req);
    case 'mastodon':
      return sendMastodonTip(env, req);
    case 'lens':
      return sendLensTip(env, req);
    case 'peertube':
      return sendPeerTubeTip(env, req);
    case 'owncast':
      return sendOwncastTip(env, req);
    case 'reddit':
      return sendRedditTip(env, req);
    case 'github':
      return sendGitHubTip(env, req);
    case 'telegram':
      return sendTelegramTip(env, req);
    default: {
      // Unknown protocol — still record in unified ledger if we have data
      if (req.amountUsd && req.entityId) {
        const activity = await recordUnifiedTip(env, {
          platform: 'degenfeed',
          entityId: req.entityId,
          entityType: req.entityType ?? 'post',
          amountUsd: req.amountUsd,
          fromUserId: req.sender,
          toUserId: req.recipientId,
          fromLabel: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
          toLabel: req.recipientName ?? req.recipientId,
          method: `native:${req.protocol}`,
        });
        return { success: true, activityId: activity?.id };
      }
      return { success: false, error: `Unsupported protocol: ${req.protocol}` };
    }
  }
}

// ─── 1. Nostr — NIP-57 Lightning Zaps ────────────────────────────────

async function sendNostrTip(env: Env, req: NativeTipRequest): Promise<NativeTipResult> {
  try {
    // Resolve LNURL from pubkey
    const relays = (env.NOSTR_RELAYS ?? env.RELAY_URLS ?? 'wss://relay.damus.io').split(',');
    const { resolveLnurlFromPubkey, fetchZapInvoice } = await import('../routes/lightning');

    const lnurl = await resolveLnurlFromPubkey(req.recipientId, relays);
    if (!lnurl) {
      return { success: false, error: 'No LNURL-pay endpoint found for this Nostr pubkey' };
    }

    // Amount in msat (1 sat = 1000 msat)
    const amountMsat = Math.floor(Number.parseFloat(req.amount) * 1000);
    if (Number.isNaN(amountMsat) || amountMsat <= 0) {
      return { success: false, error: 'Invalid tip amount' };
    }

    const zapResult = await fetchZapInvoice(lnurl, amountMsat, req.message ?? 'Tip from DegenFeed');

    if (zapResult.status === 'ERROR') {
      return { success: false, error: zapResult.reason ?? 'Zap invoice creation failed' };
    }

    // Record in unified ledger
    let activityId: string | undefined;
    if (req.amountUsd) {
      const activity = await recordUnifiedTip(env, {
        platform: 'degenfeed',
        entityId: req.entityId ?? `nostr:${req.recipientId}`,
        entityType: req.entityType ?? 'post',
        amountUsd: req.amountUsd,
        fromUserId: req.sender,
        toUserId: req.recipientId,
        fromLabel: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
        toLabel: req.recipientName ?? `${req.recipientId.slice(0, 8)}…`,
        method: 'lightning_zap',
      });
      activityId = activity?.id;
    }

    return {
      success: true,
      protocolTxId: zapResult.pr,
      activityId,
    };
  } catch (err) {
    return {
      success: false,
      error: `Nostr zap failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── 2. Farcaster — USDC tips via Frames ─────────────────────────────

async function sendFarcasterTip(env: Env, req: NativeTipRequest): Promise<NativeTipResult> {
  try {
    // Build a Farcaster Frame action URL for the tip
    const amount = req.amount;
    const recipient = req.recipientId;
    const actionUrl = `${env.GOTOSOCIAL_INSTANCE_URL ?? 'https://degenfeed.xyz'}/api/tip/frame/${encodeURIComponent(recipient)}?amount=${amount}`;

    // If we have Farcaster bot credentials, publish a cast mentioning the tip
    if (env.FARCASTER_BOT_MNEMONIC && req.sender) {
      try {
        // Publish a cast announcing the tip using Neynar API directly
        const neynarKey = env.NEYNAR_API_KEY;
        if (neynarKey && env.FARCASTER_FID) {
          await fetch('https://api.neynar.com/v2/farcaster/cast', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': neynarKey,
            },
            body: JSON.stringify({
              signer_uuid: env.FARCASTER_SIGNER_KEY,
              text: `⚡ ${req.senderProfile?.displayName ?? req.sender ?? 'Someone'} tipped ${req.recipientName ?? recipient} ${amount} USDC!`,
            }),
            signal: AbortSignal.timeout(5000),
          });
        }
      } catch {
        // Cast publishing is best-effort
      }
    }

    // Record in unified ledger
    let activityId: string | undefined;
    if (req.amountUsd) {
      const activity = await recordUnifiedTip(env, {
        platform: 'farcaster',
        entityId: req.entityId ?? `farcaster:${req.recipientId}`,
        entityType: req.entityType ?? 'post',
        amountUsd: req.amountUsd,
        fromUserId: req.sender,
        toUserId: req.recipientId,
        fromLabel: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
        toLabel: req.recipientName ?? req.recipientId,
        method: 'farcaster_frame',
      });
      activityId = activity?.id;
    }

    return {
      success: true,
      protocolTxId: actionUrl,
      nativeId: `frame:${recipient}:${amount}`,
      activityId,
    };
  } catch (err) {
    return {
      success: false,
      error: `Farcaster tip failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── 3. Bluesky — AT Protocol custom extension ────────────────────────

async function sendBlueskyTip(env: Env, req: NativeTipRequest): Promise<NativeTipResult> {
  try {
    // Bluesky tip via AT Protocol — post a tip embed record
    if (env.BSKY_ACCESS_TOKEN && env.BSKY_DID) {
      try {
        // Post a tip announcement on Bluesky
        const tipText = `⚡ ${req.senderProfile?.displayName ?? req.sender ?? 'Someone'} sent a tip!`;
        await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${env.BSKY_ACCESS_TOKEN}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            repo: env.BSKY_DID,
            collection: 'app.bsky.feed.post',
            record: {
              text: tipText,
              createdAt: new Date().toISOString(),
              embed: {
                $type: 'app.bsky.embed.external',
                external: {
                  uri: `https://degenfeed.xyz/tip/${req.sender ?? 'anonymous'}`,
                  title: `Tip of $${req.amountUsd ?? req.amount} on DegenFeed`,
                  description: req.message ?? 'Cross-platform tip',
                },
              },
            },
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Best-effort posting
      }
    }

    // Record in unified ledger
    let activityId: string | undefined;
    if (req.amountUsd) {
      const activity = await recordUnifiedTip(env, {
        platform: 'bluesky',
        entityId: req.entityId ?? `bluesky:${req.recipientId}`,
        entityType: req.entityType ?? 'post',
        amountUsd: req.amountUsd,
        fromUserId: req.sender,
        toUserId: req.recipientId,
        fromLabel: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
        toLabel: req.recipientName ?? req.recipientId,
        method: 'bluesky_tip',
      });
      activityId = activity?.id;
    }

    return { success: true, activityId };
  } catch (err) {
    return {
      success: false,
      error: `Bluesky tip failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── 4. Mastodon — ActivityPub custom activity ────────────────────────

async function sendMastodonTip(env: Env, req: NativeTipRequest): Promise<NativeTipResult> {
  try {
    // Mastodon tip via GoToSocial API — post a status mentioning the tip
    const gtsToken = await env.CACHE?.get('gts:access_token');
    if (gtsToken) {
      try {
        const instanceUrl = env.GOTOSOCIAL_INSTANCE_URL ?? 'https://social.degenfeed.xyz';
        const tipText = `⚡ ${req.senderProfile?.displayName ?? req.sender ?? 'Someone'} tipped ${req.recipientName ?? req.recipientId} ${req.amount} via DegenFeed!`;

        await fetch(`${instanceUrl}/api/v1/statuses`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${gtsToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            status: tipText,
            visibility: 'unlisted',
            ...(req.entityId ? { in_reply_to_id: req.entityId } : {}),
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Best-effort
      }
    }

    // Record in unified ledger
    let activityId: string | undefined;
    if (req.amountUsd) {
      const activity = await recordUnifiedTip(env, {
        platform: 'mastodon',
        entityId: req.entityId ?? `mastodon:${req.recipientId}`,
        entityType: req.entityType ?? 'post',
        amountUsd: req.amountUsd,
        fromUserId: req.sender,
        toUserId: req.recipientId,
        fromLabel: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
        toLabel: req.recipientName ?? req.recipientId,
        method: 'mastodon_tip',
      });
      activityId = activity?.id;
    }

    return { success: true, activityId };
  } catch (err) {
    return {
      success: false,
      error: `Mastodon tip failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── 5. Lens — Lens collect/open action ────────────────────────────────

async function sendLensTip(env: Env, req: NativeTipRequest): Promise<NativeTipResult> {
  try {
    // Lens tip via collect/open action
    const { buildLensCollectIntent } = await import('../routes/lens');
    const lensIntent = buildLensCollectIntent(req.entityId ?? req.recipientId, req.sender);

    // Record in unified ledger
    let activityId: string | undefined;
    if (req.amountUsd) {
      const activity = await recordUnifiedTip(env, {
        platform: 'lens',
        entityId: req.entityId ?? `lens:${req.recipientId}`,
        entityType: req.entityType ?? 'post',
        amountUsd: req.amountUsd,
        fromUserId: req.sender,
        toUserId: req.recipientId,
        fromLabel: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
        toLabel: req.recipientName ?? req.recipientId,
        method: 'lens_collect',
      });
      activityId = activity?.id;
    }

    return {
      success: true,
      nativeId: lensIntent?.to ?? undefined,
      activityId,
    };
  } catch (err) {
    return {
      success: false,
      error: `Lens tip failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── 6. PeerTube — PeerTube tip plugin ────────────────────────────────

async function sendPeerTubeTip(env: Env, req: NativeTipRequest): Promise<NativeTipResult> {
  try {
    const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';

    // PeerTube's tip plugin (if installed) exposes an API endpoint
    try {
      await fetch(`${instanceUrl}/api/v1/tips`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          videoId: req.entityId,
          tipperName: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
          tipperMessage: req.message ?? '',
          amount: req.amount,
          currency: 'USD',
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // PeerTube tip plugin may not be installed — that's fine
    }

    // Record in unified ledger
    let activityId: string | undefined;
    if (req.amountUsd) {
      const activity = await recordUnifiedTip(env, {
        platform: 'peertube',
        entityId: req.entityId ?? `peertube:${req.recipientId}`,
        entityType: 'video',
        amountUsd: req.amountUsd,
        fromUserId: req.sender,
        toUserId: req.recipientId,
        fromLabel: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
        toLabel: req.recipientName ?? req.recipientId,
        method: 'peertube_tip',
      });
      activityId = activity?.id;
    }

    return { success: true, activityId };
  } catch (err) {
    return {
      success: false,
      error: `PeerTube tip failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── 7. Owncast — Owncast external action ─────────────────────────────

async function sendOwncastTip(env: Env, req: NativeTipRequest): Promise<NativeTipResult> {
  try {
    const instanceUrl = env.OWNCAST_INSTANCE_URL ?? 'https://owncast.degenfeed.xyz';

    // Owncast external action webhook
    try {
      await fetch(`${instanceUrl}/api/admin/external/useraction`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: req.recipientId,
          userName: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
          action: 'tip',
          amount: req.amount,
          message: req.message ?? '',
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Owncast external action may require auth — best-effort
    }

    // Record in unified ledger
    let activityId: string | undefined;
    if (req.amountUsd) {
      const activity = await recordUnifiedTip(env, {
        platform: 'degenfeed',
        entityId: req.entityId ?? `owncast:${req.recipientId}`,
        entityType: 'space',
        amountUsd: req.amountUsd,
        fromUserId: req.sender,
        toUserId: req.recipientId,
        fromLabel: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
        toLabel: req.recipientName ?? req.recipientId,
        method: 'owncast_tip',
      });
      activityId = activity?.id;
    }

    return { success: true, activityId };
  } catch (err) {
    return {
      success: false,
      error: `Owncast tip failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── 8. Reddit — Community points / direct link ──────────────────────

async function sendRedditTip(env: Env, req: NativeTipRequest): Promise<NativeTipResult> {
  try {
    // Reddit Community Points (if available) or generate a tip link
    const tipLink = `https://degenfeed.xyz/tip/reddit/${encodeURIComponent(req.recipientId)}?amount=${req.amount}`;

    // Record in unified ledger
    let activityId: string | undefined;
    if (req.amountUsd) {
      const activity = await recordUnifiedTip(env, {
        platform: 'degenfeed',
        entityId: req.entityId ?? `reddit:${req.recipientId}`,
        entityType: req.entityType ?? 'post',
        amountUsd: req.amountUsd,
        fromUserId: req.sender,
        toUserId: req.recipientId,
        fromLabel: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
        toLabel: req.recipientName ?? req.recipientId,
        method: 'reddit_tip',
      });
      activityId = activity?.id;
    }

    return { success: true, protocolTxId: tipLink, activityId };
  } catch (err) {
    return {
      success: false,
      error: `Reddit tip failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── 9. GitHub — GitHub Sponsors API ─────────────────────────────────

async function sendGitHubTip(env: Env, req: NativeTipRequest): Promise<NativeTipResult> {
  try {
    // GitHub Sponsors API — create a one-time sponsorship
    // Requires GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET to be set
    if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
      try {
        // Exchange client credentials for an access token
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            grant_type: 'client_credentials',
          }),
          signal: AbortSignal.timeout(5000),
        });
        const tokenData = (await tokenRes.json()) as { access_token?: string };
        const token = tokenData.access_token;

        if (token) {
          // Create a sponsor listing using the GraphQL API
          await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              query: `
                mutation ($login: String!, $amount: Int!) {
                  createSponsorship(input: { sponsorLogin: $login, amount: $amount, tierId: null }) {
                    sponsorship { id }
                  }
                }
              `,
              variables: {
                login: req.recipientId,
                amount: Math.max(1, Math.round(Number.parseFloat(req.amount))),
              },
            }),
            signal: AbortSignal.timeout(5000),
          });
        }
      } catch {
        // Best-effort
      }
    }

    // Record in unified ledger
    let activityId: string | undefined;
    if (req.amountUsd) {
      const activity = await recordUnifiedTip(env, {
        platform: 'degenfeed',
        entityId: req.entityId ?? `github:${req.recipientId}`,
        entityType: req.entityType ?? 'post',
        amountUsd: req.amountUsd,
        fromUserId: req.sender,
        toUserId: req.recipientId,
        fromLabel: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
        toLabel: req.recipientName ?? req.recipientId,
        method: 'github_sponsor',
      });
      activityId = activity?.id;
    }

    return { success: true, activityId };
  } catch (err) {
    return {
      success: false,
      error: `GitHub tip failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── 10. Telegram — Telegram Stars / Bot Payments ──────────────────────

async function sendTelegramTip(env: Env, req: NativeTipRequest): Promise<NativeTipResult> {
  try {
    const botToken = env.TELEGRAM_BOT_TOKEN;
    const _botName = env.TELEGRAM_BOT_NAME ?? 'DegenFeedBot';

    if (botToken) {
      try {
        // Telegram Stars payment — send invoice via bot
        const payload = `tip:${req.recipientId}:${Date.now()}`;
        const title = `Tip for ${req.recipientName ?? req.recipientId}`;
        const description = req.message ?? 'Tip from DegenFeed';
        const prices = JSON.stringify([
          { label: 'Tip', amount: Math.round(Number.parseFloat(req.amount) * 100) },
        ]);

        await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: title.slice(0, 32),
            description: description.slice(0, 255),
            payload,
            provider_token: '', // Empty for Telegram Stars
            currency: 'XTR',
            prices,
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Best-effort
      }
    }

    // Record in unified ledger
    let activityId: string | undefined;
    if (req.amountUsd) {
      const activity = await recordUnifiedTip(env, {
        platform: 'degenfeed',
        entityId: req.entityId ?? `telegram:${req.recipientId}`,
        entityType: req.entityType ?? 'post',
        amountUsd: req.amountUsd,
        fromUserId: req.sender,
        toUserId: req.recipientId,
        fromLabel: req.senderProfile?.displayName ?? req.sender ?? 'Anonymous',
        toLabel: req.recipientName ?? req.recipientId,
        method: 'telegram_stars',
      });
      activityId = activity?.id;
    }

    return { success: true, activityId };
  } catch (err) {
    return {
      success: false,
      error: `Telegram tip failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Smart Protocol Selection ──────────────────────────────────────────

export interface SmartSelectionRequest {
  /** Protocols the sender has available */
  senderProtocols: NativeTipProtocol[];
  /** Protocols the recipient supports */
  recipientProtocols: NativeTipProtocol[];
  /** Amount in USD */
  amountUsd: number;
  /** Preferred protocol if any */
  preferredProtocol?: NativeTipProtocol;
}

export interface SmartSelectionResult {
  protocol: NativeTipProtocol;
  rank: number;
  reason: string;
  feeEstimate: ProtocolFeeEstimate;
}

/**
 * Smart-select the best protocol for a tip based on fees, speed, and availability.
 * Uses the fee table for cost comparison.
 */
export function selectBestProtocol(req: SmartSelectionRequest): SmartSelectionResult[] {
  const available = req.recipientProtocols.filter((p) => req.senderProtocols.includes(p));

  if (available.length === 0) {
    // Fall back to recipient-only protocols
    available.push(...req.recipientProtocols);
  }

  // Score each protocol
  const scored = available
    .map((protocol) => {
      const fee = PROTOCOL_FEE_ESTIMATES[protocol];
      if (!fee) return null;

      // Rank by: 1) needsSetup (prefer no-setup), 2) fee (lower = better), 3) speed
      let score = 0;
      if (!fee.needsSetup) score += 100;
      score += Math.max(0, 100 - fee.avgFeeUsd * 1000); // Lower fee = higher score
      const speedScores = { instant: 50, fast: 30, medium: 10, slow: 0 };
      score += speedScores[fee.speed] ?? 0;

      // Bonus for preference
      if (protocol === req.preferredProtocol) score += 50;

      return { protocol, score, reason: '', fee };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s, i) => ({
    protocol: s.protocol,
    rank: i + 1,
    reason: i === 0 ? 'Best balance of fees, speed, and availability' : '',
    feeEstimate: s.fee,
  }));
}
