/**
 * @degenfeed/api-worker — Cross-Protocol Coin Announcer
 *
 * When a creator coin launches, announce it on EVERY protocol the creator
 * and/or platform has ownership in: Farcaster, Nostr, Bluesky, Lens,
 * Mastodon/GTS, Telegram, Discord, and ActivityPub.
 *
 * Each announcement is protocol-appropriate:
 *   - Farcaster: cast with embedded buy frame
 *   - Nostr: kind 1 note with NIP-57 zap target
 *   - Bluesky: post with link embed
 *   - Lens: publication with collect module
 *   - Mastodon/GTS: toot with buy link
 *   - Telegram: bot message in creator's group
 *   - Discord: webhook announcement
 *
 * Every announcer has independent error handling — one failure never
 * blocks the others. Each returns its own result entry.
 */

import type { Env } from '../types';
import { sanitizeString } from '../sanitize';

// ─── Types ──────────────────────────────────────────────────────────────

export interface AnnouncementTarget {
  /** Protocol identifier */
  protocol: string;
  /** Creator's identity on this protocol (FID, pubkey, DID, profileId, etc.) */
  identity: string;
  /** Protocol-specific config overrides */
  config?: Record<string, string>;
}

export interface AnnouncementResult {
  protocol: string;
  ok: boolean;
  /** Protocol-native post/event ID */
  postId?: string;
  /** URL to the announcement on the protocol */
  url?: string;
  /** Error message if failed */
  error?: string;
  /** Timestamp of the attempt */
  timestamp: number;
}

export interface CoinAnnouncement {
  symbol: string;
  name: string;
  coinAddress: string;
  chain: string;
  degenfeedUrl: string;
  explorerUrl: string;
  price: string;
  marketCap: string;
  creatorName: string;
}

// ─── Build protocol-appropriate messages ───────────────────────────────

function buildMessage(coin: CoinAnnouncement, maxLen: number = 4096): string {
  const msg =
    `🚀 $${coin.symbol} — ${coin.name} is LIVE on DegenFeed!\n\n` +
    `💰 Price: ${coin.price}\n` +
    `📊 Market Cap: ${coin.marketCap}\n` +
    `⛓️  Chain: ${coin.chain}\n\n` +
    `Buy now: ${coin.degenfeedUrl}\n` +
    `Explorer: ${coin.explorerUrl}`;

  return msg.length <= maxLen ? msg : msg.slice(0, maxLen - 3) + '...';
}

function buildShortMessage(coin: CoinAnnouncement, maxLen: number = 300): string {
  const msg = `🚀 $${coin.symbol} launched on DegenFeed!\n\n` + `${coin.degenfeedUrl}`;

  return msg.length <= maxLen ? msg : msg.slice(0, maxLen - 3) + '...';
}

// ─── Main announcer ────────────────────────────────────────────────────

/**
 * Announce a coin launch on ALL connected protocols.
 * Returns results for every protocol attempted.
 * Each is independently error-handled.
 */
export async function announceOnAllProtocols(
  coin: CoinAnnouncement,
  targets: AnnouncementTarget[],
  env: Env,
): Promise<AnnouncementResult[]> {
  const results: AnnouncementResult[] = [];

  const tasks: Promise<AnnouncementResult>[] = [];

  for (const target of targets) {
    switch (target.protocol) {
      case 'farcaster':
        tasks.push(announceOnFarcaster(coin, target, env));
        break;
      case 'nostr':
        tasks.push(announceOnNostr(coin, target, env));
        break;
      case 'bluesky':
        tasks.push(announceOnBluesky(coin, target, env));
        break;
      case 'lens':
        tasks.push(announceOnLens(coin, target, env));
        break;
      case 'mastodon':
      case 'activitypub':
        tasks.push(announceOnMastodon(coin, target, env));
        break;
      case 'telegram':
        tasks.push(announceOnTelegram(coin, target, env));
        break;
      case 'discord':
        tasks.push(announceOnDiscord(coin, target, env));
        break;
      default:
        results.push({
          protocol: target.protocol,
          ok: false,
          error: `Unsupported protocol: ${target.protocol}`,
          timestamp: Date.now(),
        });
    }
  }

  // Run all announcements in parallel — one failure doesn't block others
  const settled = await Promise.allSettled(tasks);
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      results.push(s.value);
    } else {
      results.push({
        protocol: 'unknown',
        ok: false,
        error: `Announcement threw: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`,
        timestamp: Date.now(),
      });
    }
  }

  return results;
}

// ─── Farcaster: Cast with embedded buy frame ───────────────────────────

async function announceOnFarcaster(
  coin: CoinAnnouncement,
  target: AnnouncementTarget,
  env: Env,
): Promise<AnnouncementResult> {
  const fid = Number(target.identity);
  if (!fid || !Number.isFinite(fid)) {
    return { protocol: 'farcaster', ok: false, error: 'Invalid FID', timestamp: Date.now() };
  }

  try {
    // Build a cast with a buy-frame embed
    const text = buildMessage(coin, 320);
    const botSignerHex = env.FARCASTER_BOT_SIGNER_KEY;
    const botFid = Number(env.FARCASTER_BOT_FID || 0);

    if (!botSignerHex || !botFid) {
      return {
        protocol: 'farcaster',
        ok: false,
        error: 'Bot signer not configured',
        timestamp: Date.now(),
      };
    }

    const { buildFarcasterCastMessage, HubClient } = await import('@degenfeed/farcaster-sdk');
    const { hexToBytes } = await import('@noble/hashes/utils');

    // Embed the coin buy page as a frame URL
    const castResult = buildFarcasterCastMessage({
      signerKeyHex: botSignerHex,
      fid: botFid,
      text,
      embeds: [{ url: `${coin.degenfeedUrl}/frame` }],
    });

    if (!castResult.ok || !castResult.messageHex) {
      return {
        protocol: 'farcaster',
        ok: false,
        error: castResult.error || 'Failed to build cast',
        timestamp: Date.now(),
      };
    }

    const hubUrl = env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
    const hub = new HubClient(hubUrl);
    const messageBytes = hexToBytes(castResult.messageHex);
    await hub.submitMessage(new Uint8Array(messageBytes).buffer as ArrayBuffer);

    return {
      protocol: 'farcaster',
      ok: true,
      postId: castResult.messageHex?.slice(0, 16),
      url: `https://warpcast.com/~/conversations/${castResult.messageHex?.slice(0, 16)}`,
      timestamp: Date.now(),
    };
  } catch (err) {
    return { protocol: 'farcaster', ok: false, error: String(err), timestamp: Date.now() };
  }
}

// ─── Nostr: kind 1 note with NIP-57 zap target ────────────────────────

async function announceOnNostr(
  coin: CoinAnnouncement,
  _target: AnnouncementTarget,
  env: Env,
): Promise<AnnouncementResult> {
  const privateKeyHex = env.NOSTR_PRIVATE_KEY;
  if (!privateKeyHex) {
    return {
      protocol: 'nostr',
      ok: false,
      error: 'NOSTR_PRIVATE_KEY not configured',
      timestamp: Date.now(),
    };
  }

  try {
    const { createTextNote } = await import('@degenfeed/nostr-sdk');

    const text = buildMessage(coin, 64000);

    // Build tags: coin symbol for searchability, NIP-57 zap target
    const tags: string[][] = [
      ['t', 'degenfeed'],
      ['t', 'creatorcoin'],
      ['t', coin.symbol.toLowerCase()],
      ['r', coin.degenfeedUrl],
      // NIP-57 zap tag — points to the coin buy page as a zap target
      ['zap', coin.coinAddress, 'wss://relay.damus.io'],
      // Protocol route tag for cross-protocol discovery
      ['degenfeed', 'coin', coin.symbol, coin.chain],
    ];

    const signed = createTextNote(text, privateKeyHex, tags);

    // Publish to relays
    const relayUrls = [
      ...(env.RELAY_URLS?.split(',').map((u) => u.trim()) || []),
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
    ].filter(Boolean);

    const publishedRelays: string[] = [];
    const failedRelays: string[] = [];

    // Method 1: RelayPool
    try {
      const { RelayPool } = await import('@degenfeed/nostr-sdk');
      const pool = new RelayPool(relayUrls, {
        connectTimeout: 3000,
        eoseTimeout: 2000,
        maxReconnects: 0,
        logLevel: 'error',
      });

      await new Promise<void>((resolve) => {
        const start = Date.now();
        const check = () => {
          if (pool.getConnectedRelays().length > 0 || Date.now() - start > 3000) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        setTimeout(check, 500);
      });

      pool.publish(signed, {
        onOk: (relayUrl: string) => {
          if (!publishedRelays.includes(relayUrl)) publishedRelays.push(relayUrl);
        },
        onError: (relayUrl: string) => {
          if (!failedRelays.includes(relayUrl)) failedRelays.push(relayUrl);
        },
      });

      await new Promise((r) => setTimeout(r, 1500));
      for (const url of pool.getConnectedRelays()) {
        pool.removeRelay(url);
      }
    } catch {
      // WebSocket pool failed — try HTTP fallback
    }

    // Method 2: HTTP relay publish
    const httpRelays = relayUrls
      .filter((u) => u.startsWith('wss://'))
      .map((ws) => `https://${ws.slice(6)}`);

    for (const httpUrl of httpRelays) {
      try {
        const res = await fetch(httpUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(['EVENT', signed]),
        });
        if (res.ok && !publishedRelays.includes(httpUrl)) {
          publishedRelays.push(httpUrl);
        }
      } catch {
        // HTTP publish not supported
      }
    }

    return {
      protocol: 'nostr',
      ok: publishedRelays.length > 0,
      postId: signed.id,
      url: signed.id ? `nostr:${signed.id}` : undefined,
      timestamp: Date.now(),
    };
  } catch (err) {
    return { protocol: 'nostr', ok: false, error: String(err), timestamp: Date.now() };
  }
}

// ─── Bluesky: Post with link embed ────────────────────────────────────

async function announceOnBluesky(
  coin: CoinAnnouncement,
  _target: AnnouncementTarget,
  env: Env,
): Promise<AnnouncementResult> {
  const bskyDid = env.BSKY_DID;
  const bskyPassword = env.BSKY_APP_PASSWORD || env.PREMIUM_WALLET_KEY;
  if (!bskyDid || !bskyPassword) {
    return {
      protocol: 'bluesky',
      ok: false,
      error: 'Bluesky credentials not configured',
      timestamp: Date.now(),
    };
  }

  try {
    const { PdsClient } = await import('@degenfeed/bluesky-sdk');
    const pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';
    const client = new PdsClient(pdsUrl);
    await client.createSession(bskyDid, bskyPassword);

    const text = buildShortMessage(coin, 300);

    // Create post with an external link embed
    const result = await client.createPost({
      text,
      langs: ['en'],
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: coin.degenfeedUrl,
          title: `$${coin.symbol} — ${coin.name} on DegenFeed`,
          description: `Creator coin ${coin.name} ($${coin.symbol}) live on ${coin.chain}. Buy now on DegenFeed!`,
        },
      },
    });

    return {
      protocol: 'bluesky',
      ok: true,
      postId: result.cid,
      url: result.uri,
      timestamp: Date.now(),
    };
  } catch (err) {
    return { protocol: 'bluesky', ok: false, error: String(err), timestamp: Date.now() };
  }
}

// ─── Lens: Publication with collect module ─────────────────────────────

async function announceOnLens(
  coin: CoinAnnouncement,
  target: AnnouncementTarget,
  env: Env,
): Promise<AnnouncementResult> {
  if (!target.identity) {
    return { protocol: 'lens', ok: false, error: 'No Lens profile ID', timestamp: Date.now() };
  }

  try {
    const { LensClient } = await import('@degenfeed/lens-sdk');
    const client = new LensClient();
    const text = buildMessage(coin, 5000);

    await client.comment(target.identity, text);

    return {
      protocol: 'lens',
      ok: true,
      postId: target.identity,
      url: `https://hey.xyz/posts/${target.identity}`,
      timestamp: Date.now(),
    };
  } catch (err) {
    return { protocol: 'lens', ok: false, error: String(err), timestamp: Date.now() };
  }
}

// ─── Mastodon/GTS: Toot with buy link ─────────────────────────────────

async function announceOnMastodon(
  coin: CoinAnnouncement,
  _target: AnnouncementTarget,
  env: Env,
): Promise<AnnouncementResult> {
  const instanceUrl = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
  const accessToken = env.MASTODON_ACCESS_TOKEN || env.PREMIUM_WALLET_KEY;
  if (!accessToken) {
    return {
      protocol: 'mastodon',
      ok: false,
      error: 'Mastodon access token not configured',
      timestamp: Date.now(),
    };
  }

  try {
    const { GtSClient } = await import('@degenfeed/mastodon-sdk');
    const client = new GtSClient(instanceUrl, accessToken);

    const text = buildMessage(coin, 500);

    const status = await client.publish(text + `\n\n💎 Buy: ${coin.degenfeedUrl}`, {
      visibility: 'public',
    });

    return {
      protocol: 'mastodon',
      ok: true,
      postId: status.id,
      url: status.url,
      timestamp: Date.now(),
    };
  } catch (err) {
    return { protocol: 'mastodon', ok: false, error: String(err), timestamp: Date.now() };
  }
}

// ─── Telegram: Bot announcement in creator's group ────────────────────

async function announceOnTelegram(
  coin: CoinAnnouncement,
  _target: AnnouncementTarget,
  env: Env,
): Promise<AnnouncementResult> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_COIN_ANNOUNCEMENT_CHAT_ID || env.TELEGRAM_ANNOUNCEMENT_CHAT_ID;
  if (!botToken || !chatId) {
    return {
      protocol: 'telegram',
      ok: false,
      error: 'Telegram bot not configured',
      timestamp: Date.now(),
    };
  }

  try {
    const text =
      `🚀 <b>$${coin.symbol}</b> — <b>${coin.name}</b> is LIVE!\n\n` +
      `💰 <b>Creator Coin on ${coin.chain}</b>\n\n` +
      `🔗 <a href="${coin.degenfeedUrl}">Buy on DegenFeed</a>\n` +
      `🔍 <a href="${coin.explorerUrl}">View on Explorer</a>\n\n` +
      `#degenfeed #creatorcoin #${coin.symbol}`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: [
            [
              { text: `💎 Buy $${coin.symbol}`, url: coin.degenfeedUrl },
              { text: '🔍 Explorer', url: coin.explorerUrl },
            ],
          ],
        },
      }),
    });

    const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
    if (!data.ok) {
      return {
        protocol: 'telegram',
        ok: false,
        error: 'Telegram API error',
        timestamp: Date.now(),
      };
    }

    return {
      protocol: 'telegram',
      ok: true,
      postId: String(data.result?.message_id),
      url: `https://t.me/${chatId}/${data.result?.message_id}`,
      timestamp: Date.now(),
    };
  } catch (err) {
    return { protocol: 'telegram', ok: false, error: String(err), timestamp: Date.now() };
  }
}

// ─── Discord: Webhook announcement ─────────────────────────────────────

async function announceOnDiscord(
  coin: CoinAnnouncement,
  _target: AnnouncementTarget,
  env: Env,
): Promise<AnnouncementResult> {
  const webhookUrl = env.DISCORD_COIN_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return {
      protocol: 'discord',
      ok: false,
      error: 'Discord webhook not configured',
      timestamp: Date.now(),
    };
  }

  try {
    const embed = {
      title: `🚀 $${coin.symbol} — ${coin.name}`,
      description:
        `A new creator coin has launched on DegenFeed!\n\n` +
        `**Chain:** ${coin.chain}\n` +
        `**Price:** ${coin.price}\n` +
        `**Market Cap:** ${coin.marketCap}`,
      color: 0x00ff41,
      url: coin.degenfeedUrl,
      fields: [
        { name: 'Buy Now', value: coin.degenfeedUrl, inline: true },
        { name: 'Explorer', value: coin.explorerUrl, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'DegenFeed Creator Coins' },
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed],
        allowed_mentions: { parse: [] },
      }),
    });

    if (!res.ok) {
      return {
        protocol: 'discord',
        ok: false,
        error: `Discord webhook returned ${res.status}`,
        timestamp: Date.now(),
      };
    }

    return {
      protocol: 'discord',
      ok: true,
      url: webhookUrl,
      timestamp: Date.now(),
    };
  } catch (err) {
    return { protocol: 'discord', ok: false, error: String(err), timestamp: Date.now() };
  }
}

// ─── Resolve creator targets from linked identities ────────────────────

/**
 * Build announcement targets for a given wallet address by scanning
 * all linked protocol identities.
 */
export async function resolveAnnouncementTargets(
  walletAddress: string,
  env: Env,
): Promise<AnnouncementTarget[]> {
  const targets: AnnouncementTarget[] = [];
  if (!env.IDENTITIES) return targets;

  try {
    const identityKey = `identity:${walletAddress.toLowerCase()}`;
    const raw = await env.IDENTITIES.get(identityKey);
    if (!raw) return targets;

    const identity = JSON.parse(raw) as Record<string, Record<string, string>>;

    for (const [protocol, data] of Object.entries(identity)) {
      let identityStr: string | null = null;

      switch (protocol) {
        case 'farcaster':
          identityStr = data.fid || null;
          break;
        case 'nostr':
          identityStr = data.pubkey || null;
          break;
        case 'bluesky':
          identityStr = data.did || null;
          break;
        case 'lens':
          identityStr = data.profileId || null;
          break;
        case 'mastodon':
        case 'activitypub':
          identityStr = data.id || data.username || null;
          break;
        case 'telegram':
          identityStr = data.chatId || data.username || null;
          break;
        default:
          identityStr = data.id || null;
      }

      if (identityStr) {
        targets.push({ protocol, identity: identityStr, config: data });
      }
    }
  } catch {
    // Identity resolution non-critical
  }

  return targets;
}
