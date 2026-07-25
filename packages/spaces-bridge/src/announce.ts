/**
 * @degenfeed/spaces-bridge — Cross-Platform Space Announcements
 *
 * When a space goes live, this module auto-announces on ALL connected
 * social platforms with native-looking posts:
 *
 *   - Farcaster: Cast with "Join Space" embed
 *   - Lens: Publication with link
 *   - Bluesky: AT Protocol post with card
 *   - Mastodon/GTS: ActivityPub status
 *   - Discord: Webhook message with rich embed
 *   - Telegram: Bot message with inline button
 *   - Twitter/X: Tweet with link
 *
 * Each platform gets an announcement tailored to its native format.
 */

import type { AnnounceBridge, AnnouncePlatform, SpaceAnnouncement, SpaceItem } from './types';

// ─── Farcaster ──────────────────────────────────────────────────────────

const farcasterBridge: AnnounceBridge = {
  platform: 'farcaster',
  async announce(space: SpaceItem, announcement: SpaceAnnouncement) {
    try {
      const fid = process.env.FARCASTER_BOT_FID;
      const signerKey = process.env.FARCASTER_BOT_SIGNER_KEY;
      const hubUrl = process.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
      if (!fid || !signerKey)
        return {
          ok: false,
          error: 'Farcaster bot not configured (FARCASTER_BOT_FID / FARCASTER_BOT_SIGNER_KEY)',
        };

      const text =
        announcement.text.length > 280
          ? `${announcement.text.slice(0, 277)}...`
          : announcement.text;

      // Build and submit cast to Hubble
      const { buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');
      const castResult = buildFarcasterCastMessage({
        signerKeyHex: signerKey,
        fid: Number(fid),
        text,
        embeds: [{ url: space.platforms[0]?.url ?? announcement.spaceUrl }],
      });

      if (!castResult.ok || !castResult.messageHex) {
        return { ok: false, error: `Failed to build cast: ${castResult.error}` };
      }

      const bodyBytes = new Uint8Array(
        castResult.messageHex.match(/.{1,2}/g)?.map((b: string) => parseInt(b, 16)) ?? [],
      );
      const res = await fetch(`${hubUrl}/v1/submitMessage`, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream', 'user-agent': 'DegenFeed/1.0' },
        body: bodyBytes,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        return { ok: false, error: `Hubble rejected cast: ${res.status} ${errText}` };
      }

      return {
        ok: true,
        nativeId: castResult.messageHex.slice(0, 40),
        url: `https://warpcast.com/~/conversations/${castResult.messageHex.slice(0, 40)}`,
      };
    } catch (e) {
      return { ok: false, error: `Farcaster failed: ${e}` };
    }
  },
};

// ─── Lens ───────────────────────────────────────────────────────────────

const lensBridge: AnnounceBridge = {
  platform: 'lens',
  async announce(space: SpaceItem, announcement: SpaceAnnouncement) {
    try {
      const accessToken = process.env.LENS_ACCESS_TOKEN;
      if (!accessToken) return { ok: false, error: 'LENS_ACCESS_TOKEN not configured' };

      const profileId = process.env.LENS_PROFILE_ID;
      if (!profileId) return { ok: false, error: 'LENS_PROFILE_ID not configured' };

      // Post via Lens API (v2)
      const res = await fetch('https://api-v2.lens.dev/graphql', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: `
            mutation CreatePost($request: CreatePublicPostRequest!) {
              createPost(request: $request) { ... on RelayerResult { txHash } ... on RelayError { reason } }
            }
          `,
          variables: {
            request: {
              profileId,
              contentURI: announcement.spaceUrl,
              // Use metadata for rich content
              metadata: {
                content: announcement.text,
                attributes: [
                  { key: 'type', value: 'degenfeed-space' },
                  { key: 'spaceTitle', value: space.title },
                  { key: 'hostName', value: space.hostName },
                ],
              },
            },
          },
        }),
      });

      if (!res.ok) {
        return { ok: false, error: `Lens API error: ${res.status}` };
      }

      const data = (await res.json()) as { data?: { createPost?: { txHash?: string } } };
      return {
        ok: true,
        nativeId: data.data?.createPost?.txHash ?? `lens:${Date.now()}`,
        url: `https://hey.xyz/post/${data.data?.createPost?.txHash}`,
      };
    } catch (e) {
      return { ok: false, error: `Lens failed: ${e}` };
    }
  },
};

// ─── Bluesky ────────────────────────────────────────────────────────────

const blueskyBridge: AnnounceBridge = {
  platform: 'bluesky',
  async announce(space: SpaceItem, announcement: SpaceAnnouncement) {
    try {
      const jwt = process.env.BLUESKY_JWT;
      const did = process.env.BLUESKY_DID;
      const password = process.env.BLUESKY_APP_PASSWORD;
      const identifier = process.env.BLUESKY_IDENTIFIER;

      if (!jwt && (!password || !identifier)) {
        return { ok: false, error: 'Bluesky credentials not configured' };
      }

      let accessJwt = jwt;
      let userDid = did;

      // Login if no JWT provided
      if (!accessJwt && password && identifier) {
        const loginRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        if (!loginRes.ok) {
          return { ok: false, error: 'Bluesky login failed' };
        }
        const loginData = (await loginRes.json()) as { accessJwt: string; did: string };
        accessJwt = loginData.accessJwt;
        userDid = loginData.did;
      }

      if (!accessJwt || !userDid) {
        return { ok: false, error: 'Bluesky: missing auth' };
      }

      // Create rich post with embed card
      const record = {
        $type: 'app.bsky.feed.post',
        text: announcement.text.slice(0, 300),
        createdAt: new Date().toISOString(),
        embed: {
          $type: 'app.bsky.embed.external',
          external: {
            uri: announcement.spaceUrl,
            title: announcement.embed?.title ?? space.title,
            description:
              announcement.embed?.description ??
              space.description ??
              `Join ${space.hostName}'s space on DegenFeed`,
            thumb: announcement.embed?.imageUrl
              ? (await fetchAndUploadBlueskyImage(announcement.embed.imageUrl, accessJwt)).data
              : undefined,
          },
        },
      };

      const res = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessJwt}`,
        },
        body: JSON.stringify({
          repo: userDid,
          collection: 'app.bsky.feed.post',
          record,
        }),
      });

      if (!res.ok) {
        return { ok: false, error: `Bluesky API error: ${res.status}` };
      }

      const data = (await res.json()) as { uri?: string };
      return {
        ok: true,
        nativeId: data.uri ?? `bsky:${Date.now()}`,
        url: `https://bsky.app/profile/${userDid}/post/${(data.uri ?? '').split('/').pop()}`,
      };
    } catch (e) {
      return { ok: false, error: `Bluesky failed: ${e}` };
    }
  },
};

async function fetchAndUploadBlueskyImage(
  _imageUrl: string,
  _accessJwt: string,
): Promise<{ data: { cid: string; mimeType: string } }> {
  // Simplified: return placeholder. In production, download and upload via blob endpoint
  return { data: { cid: '', mimeType: 'image/jpeg' } };
}

// ─── Mastodon ───────────────────────────────────────────────────────────

const mastodonBridge: AnnounceBridge = {
  platform: 'mastodon',
  async announce(_space: SpaceItem, announcement: SpaceAnnouncement) {
    try {
      const token = process.env.MASTODON_ACCESS_TOKEN;
      if (!token) {
        return { ok: false, error: 'MASTODON_ACCESS_TOKEN not configured' };
      }

      const instance = process.env.MASTODON_INSTANCE ?? 'https://social.degenfeed.xyz';
      const statusText = `${announcement.text}\n\n${announcement.spaceUrl}`;

      const res = await fetch(`${instance}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: statusText.slice(0, 500),
          visibility: 'public',
          language: 'en',
        }),
      });

      if (!res.ok) {
        return { ok: false, error: `Mastodon API error: ${res.status}` };
      }

      const data = (await res.json()) as { id?: string; url?: string };
      return {
        ok: true,
        nativeId: data.id ?? `masto:${Date.now()}`,
        url: data.url ?? `${instance}/web/statuses/${data.id}`,
      };
    } catch (e) {
      return { ok: false, error: `Mastodon failed: ${e}` };
    }
  },
};

// ─── Discord ────────────────────────────────────────────────────────────

const discordBridge: AnnounceBridge = {
  platform: 'discord',
  async announce(space: SpaceItem, announcement: SpaceAnnouncement) {
    try {
      const webhookUrl = process.env.DISCORD_SPACES_WEBHOOK_URL;
      if (!webhookUrl) {
        return { ok: false, error: 'DISCORD_SPACES_WEBHOOK_URL not configured' };
      }

      const embed = {
        title: announcement.embed?.title ?? space.title,
        description: announcement.embed?.description ?? space.description ?? '',
        url: announcement.spaceUrl,
        color: 0x00ff41, // DegenFeed green
        author: {
          name: space.hostName,
          icon_url: space.hostAvatarUrl,
        },
        fields: [
          {
            name: '👥 Listeners',
            value: String(space.listeners),
            inline: true,
          },
          {
            name: '🎙️ Speakers',
            value: String(space.speakers.length),
            inline: true,
          },
          {
            name: '📡 Platforms',
            value: space.platforms.map((p) => `\`${p.platform}\``).join(' '),
            inline: false,
          },
        ],
        thumbnail: announcement.embed?.imageUrl ? { url: announcement.embed.imageUrl } : undefined,
        timestamp: new Date().toISOString(),
        footer: {
          text: 'DegenFeed Spaces',
          icon_url: 'https://app.degenfeed.xyz/favicon.ico',
        },
      };

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content: space.status === 'live' ? '🔊 **Space is LIVE!**' : '📅 **Upcoming Space**',
          embeds: [embed],
          allowed_mentions: { parse: ['everyone', 'roles'] },
        }),
      });

      if (!res.ok) {
        return { ok: false, error: `Discord webhook error: ${res.status}` };
      }

      return {
        ok: true,
        nativeId: `discord:${Date.now()}`,
      };
    } catch (e) {
      return { ok: false, error: `Discord failed: ${e}` };
    }
  },
};

// ─── Telegram ───────────────────────────────────────────────────────────

const telegramBridge: AnnounceBridge = {
  platform: 'telegram',
  async announce(space: SpaceItem, announcement: SpaceAnnouncement) {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_SPACES_CHAT_ID;
      if (!botToken || !chatId) {
        return { ok: false, error: 'Telegram bot token or chat ID not configured' };
      }

      const message =
        space.status === 'live'
          ? `🔊 <b>Space LIVE: ${space.title}</b>\n\n${space.description ?? ''}\n\n👤 Host: ${space.hostName}\n👥 ${space.listeners} listening\n\n<a href="${announcement.spaceUrl}">🎧 Join Space</a>`
          : `📅 <b>Upcoming Space: ${space.title}</b>\n\n${space.description ?? ''}\n\n👤 Host: ${space.hostName}\n\n<a href="${announcement.spaceUrl}">🔔 Set Reminder</a>`;

      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: space.status === 'live' ? '🎧 Join Space' : '🔔 Set Reminder',
                  url: announcement.spaceUrl,
                },
              ],
            ],
          },
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { description?: string } | null;
        return { ok: false, error: `Telegram API error: ${errData?.description ?? res.status}` };
      }

      const data = (await res.json()) as { result?: { message_id?: number } };
      return {
        ok: true,
        nativeId: `tg:${data.result?.message_id ?? Date.now()}`,
      };
    } catch (e) {
      return { ok: false, error: `Telegram failed: ${e}` };
    }
  },
};

// ─── Twitter / X ────────────────────────────────────────────────────────

const twitterBridge: AnnounceBridge = {
  platform: 'twitter',
  async announce(_space: SpaceItem, announcement: SpaceAnnouncement) {
    try {
      const apiKey = process.env.TWITTER_API_KEY;
      const apiSecret = process.env.TWITTER_API_SECRET;
      const accessToken = process.env.TWITTER_ACCESS_TOKEN;
      const accessSecret = process.env.TWITTER_ACCESS_SECRET;

      if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        return { ok: false, error: 'Twitter API credentials not configured' };
      }

      // Get OAuth 2.0 bearer token for API v2
      const bearerRes = await fetch('https://api.twitter.com/oauth2/token', {
        method: 'POST',
        headers: {
          authorization: `Basic ${btoa(`${apiKey}:${apiSecret}`)}`, // btoa available in edge
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!bearerRes.ok) {
        return { ok: false, error: 'Twitter OAuth failed' };
      }

      const bearerData = (await bearerRes.json()) as { access_token?: string };
      if (!bearerData.access_token) {
        return { ok: false, error: 'Twitter no bearer token' };
      }

      const tweetText = `${announcement.text.slice(0, 240)}\n\n${announcement.spaceUrl}`;

      const tweetRes = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${bearerData.access_token}`,
        },
        body: JSON.stringify({ text: tweetText }),
      });

      if (!tweetRes.ok) {
        return { ok: false, error: `Twitter API error: ${tweetRes.status}` };
      }

      const tweetData = (await tweetRes.json()) as { data?: { id?: string } };
      return {
        ok: true,
        nativeId: tweetData.data?.id ?? `tw:${Date.now()}`,
        url: `https://twitter.com/i/web/status/${tweetData.data?.id}`,
      };
    } catch (e) {
      return { ok: false, error: `Twitter failed: ${e}` };
    }
  },
};

// ─── Bridge Registry ────────────────────────────────────────────────────

const ANNOUNCE_BRIDGES: Record<AnnouncePlatform, AnnounceBridge> = {
  farcaster: farcasterBridge,
  lens: lensBridge,
  bluesky: blueskyBridge,
  mastodon: mastodonBridge,
  discord: discordBridge,
  telegram: telegramBridge,
  twitter: twitterBridge,
};

export function getAnnounceBridge(platform: AnnouncePlatform): AnnounceBridge {
  const bridge = ANNOUNCE_BRIDGES[platform];
  if (!bridge) throw new Error(`Unknown announce platform: ${platform}`);
  return bridge;
}

export function getConfiguredAnnouncePlatforms(): AnnouncePlatform[] {
  const configMap: Record<AnnouncePlatform, string[]> = {
    farcaster: ['FARCASTER_BOT_FID', 'FARCASTER_BOT_SIGNER_KEY'],
    lens: ['LENS_ACCESS_TOKEN'],
    bluesky: ['BLUESKY_JWT'],
    mastodon: ['MASTODON_ACCESS_TOKEN'],
    discord: ['DISCORD_SPACES_WEBHOOK_URL'],
    telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
    twitter: ['TWITTER_API_KEY', 'TWITTER_API_SECRET'],
  };

  return (Object.entries(configMap) as [AnnouncePlatform, string[]][])
    .filter(([_, keys]) => keys.every((k) => process.env[k]))
    .map(([platform]) => platform);
}

/**
 * Announce a space on multiple social platforms simultaneously.
 */
export async function announceSpace(
  space: SpaceItem,
  platforms?: AnnouncePlatform[],
): Promise<
  Record<AnnouncePlatform, { ok: boolean; nativeId?: string; url?: string; error?: string }>
> {
  const targetPlatforms = platforms ?? getConfiguredAnnouncePlatforms();

  if (targetPlatforms.length === 0) {
    return {} as Record<
      AnnouncePlatform,
      { ok: boolean; nativeId?: string; url?: string; error?: string }
    >;
  }

  // Build announcement content
  const spaceUrl = space.platforms[0]?.url ?? `https://app.degenfeed.xyz/spaces/${space.id}`;
  const hostName = space.hostName;

  const announcement: SpaceAnnouncement = {
    text:
      space.status === 'live'
        ? `🔊 LIVE: ${space.title} — hosted by ${hostName} on DegenFeed Spaces`
        : `📅 Upcoming: ${space.title} — hosted by ${hostName} on DegenFeed Spaces`,
    spaceUrl,
    platform: 'farcaster' as AnnouncePlatform, // Will be overridden per bridge call
    embed: {
      title: space.title,
      description: space.description ?? `Join ${hostName}'s space on DegenFeed`,
      hostName,
      imageUrl: space.hostAvatarUrl,
      url: spaceUrl,
    },
  };

  const results: Record<
    AnnouncePlatform,
    { ok: boolean; nativeId?: string; url?: string; error?: string }
  > = {} as any;

  await Promise.allSettled(
    targetPlatforms.map(async (platform) => {
      try {
        const bridge = getAnnounceBridge(platform);
        const platformAnnouncement = { ...announcement, platform };
        const result = await bridge.announce(space, platformAnnouncement);
        results[platform] = result;
      } catch (e) {
        results[platform] = { ok: false, error: `Bridge error: ${e}` };
      }
    }),
  );

  return results;
}

export {
  blueskyBridge,
  discordBridge,
  farcasterBridge,
  lensBridge,
  mastodonBridge,
  telegramBridge,
  twitterBridge,
};
