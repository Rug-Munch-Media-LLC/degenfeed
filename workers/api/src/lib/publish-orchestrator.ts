/**
 * @degenfeed/api-worker — Publish Orchestrator
 *
 * Routes content to one or more protocols by calling the actual SDKs
 * with real API calls — no stubs, no placeholders.
 *
 * Each protocol handler:
 *   1. Accepts text + optional media + auth tokens
 *   2. Formats content using the format-translator
 *   3. Calls the protocol SDK
 *   4. Returns publish result with nativeId
 *
 * Supports: ActivityPub (Mastodon/GtS), AT Protocol (Bluesky),
 * Nostr, Farcaster, Lens, Telegram, RSS
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../index';
import type { BlobRef } from '@degenfeed/bluesky-sdk';
import type { MediaAttachment } from './format-translator';
import { formatForActivityPub, formatForTelegram } from './format-translator';
import { createEvent } from './realtime-sync';
import { withReliability, recordBridgeOperation } from './bridge-reliability';

// ─── Reliability Helper ────────────────────────────────────────────────────

/**
 * Execute a protocol publish operation with reliability (retry + circuit breaker).
 * Records outcome for stats and alerting.
 */
async function reliablePublish<T>(
  protocol: string,
  operation: () => Promise<T>,
  env: Env,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await withReliability(protocol, operation, { env });
    await recordBridgeOperation(env, protocol, true, Math.round(performance.now() - start));
    return result;
  } catch (err) {
    await recordBridgeOperation(
      env,
      protocol,
      false,
      Math.round(performance.now() - start),
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface PublishResult {
  ok: boolean;
  nativeId?: string;
  nativeUri?: string;
  error?: string;
}

export interface PublishInput {
  /** Main text content */
  text: string;
  /** Optional title (for long-form / RSS) */
  title?: string;
  /** Protocol targets to publish to */
  targets: Protocol[];
  /** Per-protocol auth tokens */
  auth?: Record<string, string>;
  /** Images to attach */
  images?: MediaAttachment[];
  /** Links to include */
  links?: string[];
  /** Hashtags to include */
  hashtags?: string[];
  /** Pre-signed messages (for protocols requiring client-side signing) */
  signedMessage?: string;
  typedDataId?: string;
  signature?: string;
  /** Parent post for replies */
  parentNativeId?: string;
  parentProtocol?: Protocol;
}

export interface PublishReport {
  results: Record<string, PublishResult>;
  /** Timestamps */
  startedAt: number;
  completedAt: number;
  /** How many succeeded */
  successCount: number;
  failureCount: number;
}

// ─── Main Orchestrator ────────────────────────────────────────────────────

/**
 * Publish content to one or more protocols.
 * Returns a report with per-protocol results.
 */
export async function orchestratePublish(
  input: PublishInput,
  env: Env,
): Promise<PublishReport> {
  const startedAt = Date.now();
  const results: Record<string, PublishResult> = {};

  // Publish to all targets in parallel where possible
  const promises = input.targets.map(async (protocol) => {
    try {
      const result = await publishToProtocol(protocol, input, env);
      results[protocol] = result;
    } catch (err) {
      results[protocol] = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  await Promise.all(promises);

  const successCount = Object.values(results).filter((r) => r.ok).length;
  const failureCount = Object.values(results).filter((r) => !r.ok).length;

  // ── Fire real-time sync events for successful publishes ────────────
  fireSyncEvents(input, results, env).catch((err) =>
    console.error('[orchestrator] realtime sync event failed:', err),
  );

  return {
    results,
    startedAt,
    completedAt: Date.now(),
    successCount,
    failureCount,
  };
}

/**
 * Fire real-time sync events for all successfully published protocols.
 * This ensures that cross-protocol siblings are aware of the new content
 * within seconds, not minutes.
 */
async function fireSyncEvents(
  input: PublishInput,
  results: Record<string, PublishResult>,
  env: Env,
): Promise<void> {
  // For each successful target, enqueue a sync event
  for (const [protocol, result] of Object.entries(results)) {
    if (!result.ok || !result.nativeId) continue;

    try {
      const { onEvent } = await import('./realtime-sync');

      const event = createEvent(
        protocol as Protocol,
        'post',
        result.nativeId,
        {
          id: result.nativeId,
          handle: input.auth?.[`${protocol}_handle`],
        },
        {
          text: input.text,
          title: input.title,
          subjectId: result.nativeId,
          subjectUri: result.nativeUri,
          raw: {
            images: input.images,
            links: input.links,
            hashtags: input.hashtags,
            parentNativeId: input.parentNativeId,
            parentProtocol: input.parentProtocol,
          },
        },
      );

      // Fire-and-forget: sync to siblings in background
      onEvent(protocol as Protocol, event, env).catch((e) =>
        console.error(`[orchestrator] sync event failed for ${protocol}:`, e),
      );
    } catch (e) {
      console.error(`[orchestrator] fireSyncEvents error for ${protocol}:`, e);
    }
  }
}

// ─── Protocol Router ──────────────────────────────────────────────────────

async function publishToProtocol(
  protocol: string,
  input: PublishInput,
  env: Env,
): Promise<PublishResult> {
  const auth = input.auth ?? {};

  switch (protocol) {
    case 'mastodon':
      return publishToActivityPub(input, auth, env);

    case 'bluesky':
      return publishToAtProtocol(input, auth, env);

    case 'nostr':
      return publishToNostr(input, auth, env);

    case 'farcaster':
      return publishToFarcaster(input, auth, input.signedMessage, env);

    case 'lens':
      return publishToLens(input, auth, input.typedDataId, input.signature, env);

    case 'telegram':
      return publishToTelegram(input, auth, env);

    case 'rss':
      return publishToRss(input, auth, env);

    case 'threads':
      return publishToThreads(input, auth, env);

    default:
      return { ok: false, error: `Protocol '${protocol}' is not supported by the orchestrator` };
  }
}

// ─── ActivityPub (Mastodon / GoToSocial) ────────────────────────────────

async function publishToActivityPub(
  input: PublishInput,
  auth: Record<string, string>,
  env: Env,
): Promise<PublishResult> {
  const { GtSClient } = await import('@degenfeed/mastodon-sdk');

  const instance = auth.mastodon_instance || env.GTS_INSTANCE_URL || 'https://social.degenfeed.xyz';
  const accessToken = auth.mastodon || auth.mastodon_token;

  if (!accessToken) {
    return { ok: false, error: 'No Mastodon access token provided' };
  }

  try {
    const result = await reliablePublish('activitypub', async () => {
      const client = new GtSClient(instance, accessToken);
      const formatted = formatForActivityPub({
        text: input.text,
        images: input.images,
        links: input.links,
        hashtags: input.hashtags,
      });

      // Upload media attachments first (if any)
      const mediaIds: string[] = [];
      if (input.images && input.images.length > 0) {
        for (const img of input.images) {
          try {
            const uploadUrl = `${instance}/api/v2/media`;
            const formData = new FormData();
            // Fetch the image and re-post it
            const imgRes = await fetch(img.url);
            if (imgRes.ok) {
              const blob = await imgRes.blob();
              formData.append('file', blob, 'media.jpg');
              formData.append('description', img.alt ?? '');
              const uploadRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                  authorization: `Bearer ${accessToken}`,
                },
                body: formData,
              });
              if (uploadRes.ok) {
                const uploadData = (await uploadRes.json()) as { id: string };
                mediaIds.push(uploadData.id);
              }
            }
          } catch (e) {
            console.error('[orchestrator] Mastodon media upload failed:', e);
          }
        }
      }

      const publishResult = await client.publish(formatted.status, {
        visibility: 'public',
        mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
      });

      return publishResult;
    }, env);

    return {
      ok: true,
      nativeId: result.id,
      nativeUri: result.uri,
    };
  } catch (err) {
    return {
      ok: false,
      error: `ActivityPub publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── AT Protocol (Bluesky) ────────────────────────────────────────────────

async function publishToAtProtocol(
  input: PublishInput,
  auth: Record<string, string>,
  env: Env,
): Promise<PublishResult> {
  const { PdsClient } = await import('@degenfeed/bluesky-sdk');
  const { formatForAtProtocol } = await import('./format-translator');

  const accessJwt = auth.bluesky_jwt || auth.bluesky_accessJwt || auth.accessJwt;
  const repoDid = auth.bluesky_did || auth.did;

  if (!accessJwt) {
    return { ok: false, error: 'No Bluesky accessJwt provided' };
  }
  if (!repoDid) {
    return { ok: false, error: 'No Bluesky DID provided — pass auth.bluesky_did' };
  }

  try {
    const result = await reliablePublish('bluesky', async () => {
      const pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';
      const client = new PdsClient(pdsUrl);
      // Set auth and DID directly — these are private fields but we set them
      // for pre-authenticated calls (the PdsClient normally sets these via createSession)
      (client as unknown as { accessJwt: string }).accessJwt = accessJwt;
      (client as unknown as { did: string }).did = repoDid;

      // Upload images if present (Bluesky supports up to 4)
      let uploadedImages:
        | Array<{ image: { $type: string; ref: { $link: string }; mimeType: string; size: number }; alt: string }>
        | undefined;

      if (input.images && input.images.length > 0) {
        const uploads = await Promise.all(
          input.images.slice(0, 4).map(async (img) => {
            try {
              const imgRes = await fetch(img.url);
              if (!imgRes.ok) return null;
              const buf = await imgRes.arrayBuffer();
              const blob = new Uint8Array(buf);
              const uploaded = await client.uploadBlob(blob, {
                encoding: img.mimeType ?? 'image/jpeg',
              });
              return {
                image: uploaded.blob,
                alt: img.alt ?? '',
              };
            } catch {
              return null;
            }
          }),
        );

        const validUploads = uploads.filter(Boolean) as Array<{
          image: BlobRef;
          alt: string;
        }>;
        if (validUploads.length > 0) {
          uploadedImages = validUploads;
        }
      }

      // Build the AT Protocol record with facets
      const formatted = await formatForAtProtocol(
        {
          text: input.text,
          images: input.images,
          links: input.links,
          mentions: input.hashtags,
          hashtags: input.hashtags,
          parentNativeId: input.parentNativeId,
          parentProtocol: input.parentProtocol,
        },
        pdsUrl,
      );

      const embedInput = uploadedImages
        ? {
            $type: 'app.bsky.embed.images' as const,
            images: uploadedImages,
          }
        : formatted.embed
          ? {
              $type: 'app.bsky.embed.images' as const,
              images: (formatted.embed as { images?: Array<{ image: BlobRef; alt: string }> }).images?.map((img) => ({
                image: img.image,
                alt: img.alt,
              })) ?? [],
            }
          : undefined;

      return client.createPost({
        text: formatted.text,
        facets: formatted.facets,
        embed: embedInput,
        langs: ['en'],
        createdAt: new Date().toISOString(),
      });
    }, env);

    return {
      ok: true,
      nativeId: result.uri,
      nativeUri: result.uri,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Bluesky publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Nostr ────────────────────────────────────────────────────────────────

async function publishToNostr(
  input: PublishInput,
  auth: Record<string, string>,
  env: Env,
): Promise<PublishResult> {
  const nostr = await import('@degenfeed/nostr-sdk');
  const { formatForNostr } = await import('./format-translator');

  const nsec = auth.nostr || auth.nsec || auth.nostr_nsec;
  if (!nsec) {
    return {
      ok: false,
      error: 'No Nostr nsec provided. Pass auth.nostr or auth.nsec.',
    };
  }

  try {
    const signedEvent = await reliablePublish('nostr', async () => {
      const pubkey = nostr.getPublicKey(nsec);
      const formatted = formatForNostr(
        {
          text: input.text,
          title: input.title,
          images: input.images,
          links: input.links,
          hashtags: input.hashtags,
          mentions: input.hashtags,
          parentNativeId: input.parentNativeId,
          parentProtocol: input.parentProtocol,
        },
        pubkey,
      );

      // Build the relay pool
      const relayUrls = (env.RELAY_URLS || 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net')
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 5000 });

      // Create and sign the event
      const unsigned = {
        pubkey,
        created_at: formatted.created_at,
        kind: formatted.kind,
        tags: formatted.tags,
        content: formatted.content,
      } satisfies {
        pubkey: string;
        created_at: number;
        kind: number;
        tags: string[][];
        content: string;
      };

      const signed = nostr.signEvent(unsigned, nsec);
      await pool.publish(signed);
      pool.disconnectAll();
      return signed;
    }, env);

    return {
      ok: true,
      nativeId: signedEvent.id,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Nostr publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Farcaster ────────────────────────────────────────────────────────────

async function publishToFarcaster(
  input: PublishInput,
  auth: Record<string, string>,
  signedMessage: string | undefined,
  env: Env,
): Promise<PublishResult> {
  const { HubClient } = await import('@degenfeed/farcaster-sdk');
  const { formatForFarcaster } = await import('./format-translator');

  // Farcaster requires either a pre-signed message from the client,
  // or a signer key + fid for server-side signing
  if (signedMessage) {
    // Pre-signed message path — submit directly to Hub
    return reliablePublish('farcaster', async () => {
      const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
      const client = new HubClient(hubUrl);

      let messageBody: string | ArrayBuffer = signedMessage;
      const hex = signedMessage.startsWith('0x') ? signedMessage.slice(2) : signedMessage;
      if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
        messageBody = bytes.buffer as ArrayBuffer;
      }

      await client.submitMessage(messageBody);
      return { ok: true, nativeId: hex.slice(0, 40) };
    }, env);
  }

  // Server-side signing path (requires signer key + fid)
  const signerKey = auth.farcaster_signer || auth.signer;
  const fidStr = auth.farcaster_fid || auth.fid;

  if (!signerKey || !fidStr) {
    return {
      ok: false,
      error:
        'Farcaster requires pre-signedMessage OR auth.farcaster_signer + auth.farcaster_fid. ' +
        'Pass signedMessage from client-side buildFarcasterCastMessage() for server-submit.',
    };
  }

  try {
    return reliablePublish('farcaster', async () => {
      const { buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');
      const fid = parseInt(fidStr, 10);
      if (Number.isNaN(fid) || fid <= 0) {
        return { ok: false, error: 'Invalid Farcaster FID' };
      }

      const formatted = formatForFarcaster({
        text: input.text,
        images: input.images,
        links: input.links,
        parentNativeId: input.parentNativeId,
        parentProtocol: input.parentProtocol,
      });

      // Append embed URLs to the text so they render as links
      let castText = formatted.text;
      for (const embed of formatted.embeds) {
        if (!castText.includes(embed.url)) {
          castText += `\n${embed.url}`;
        }
      }
      castText = castText.slice(0, 320);

      // Build and sign the cast (BuildCastMessageOpts does not support embeds natively)
      const signed = buildFarcasterCastMessage({
        signerKeyHex: signerKey,
        fid,
        text: castText,
        parentFid: input.parentNativeId ? parseInt(input.parentNativeId, 10) : undefined,
        parentHashHex: input.parentNativeId,
      });

      if (!signed.ok || !signed.messageHex) {
        return { ok: false, error: signed.error ?? 'Failed to build Farcaster cast message' };
      }

      // Submit to Hub
      const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
      const client = new HubClient(hubUrl);
      await client.submitMessage(signed.messageHex);

      // Create a fake nativeId from hash
      const fakeHash = signed.messageHex.slice(0, 40);
      return { ok: true, nativeId: fakeHash };
    }, env);
  } catch (err) {
    return {
      ok: false,
      error: `Farcaster publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Lens ────────────────────────────────────────────────────────────────

async function publishToLens(
  input: PublishInput,
  auth: Record<string, string>,
  typedDataId: string | undefined,
  signature: string | undefined,
  env: Env,
): Promise<PublishResult> {
  const { LensClient } = await import('@degenfeed/lens-sdk');
  const { formatForLens } = await import('./format-translator');

  // Lens requires client-side signing of typed data.
  // The client must create a post via the Lens API, sign the typed data,
  // then pass typedDataId + signature to this endpoint for broadcast.
  if (typedDataId && signature) {
    return reliablePublish('lens', async () => {
      const lensApi = env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';

      const broadcastRes = await fetch(lensApi, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `mutation Broadcast($request: BroadcastRequest!) {
            broadcast(request: $request) {
              ... on RelayerResult { txHash }
              ... on RelayError { reason }
            }
          }`,
          variables: { request: { id: typedDataId, signature } },
        }),
      });

      if (!broadcastRes.ok) {
        const errText = await broadcastRes.text();
        return { ok: false, error: `Lens broadcast HTTP ${broadcastRes.status}: ${errText.slice(0, 200)}` };
      }

      const broadcastData = (await broadcastRes.json()) as Record<string, unknown>;
      const result = (broadcastData.data as Record<string, unknown>)?.broadcast as
        | Record<string, unknown>
        | undefined;

      return {
        ok: !!result?.txHash,
        nativeId: (result?.txHash as string) ?? undefined,
        error: (result?.reason as string) ?? undefined,
      };
    }, env);
  }

  // If we have a Lens API access token, we can try to create a post
  // via the Lens API without client-side signing (if the API supports it)
  const accessToken = auth.lens_token || auth.lens_accessToken;
  if (accessToken) {
    return reliablePublish('lens', async () => {
      const client = new LensClient(env.LENS_API_URL ?? undefined);
      client.setAuth(accessToken);

      // For the post/create mutation, we use the Lens client's request method
      // This requires the access token to have write permission
      const formatted = formatForLens({
        text: input.text,
        images: input.images,
        links: input.links,
        hashtags: input.hashtags,
        parentNativeId: input.parentNativeId,
        parentProtocol: input.parentProtocol,
      });

      const data = await client.request(
        `mutation CreatePost($request: CreatePostRequest!) {
          post(request: $request) {
            ... on RelayResult { txHash }
            ... on RelayError { reason }
          }
        }`,
        {
          request: {
            content: formatted.content,
            locale: 'en',
          },
        },
      );

      const result = (data as Record<string, unknown>)?.post as
        | Record<string, unknown>
        | undefined;

      return {
        ok: !!result?.txHash,
        nativeId: (result?.txHash as string) ?? undefined,
        error: (result?.reason as string) ?? undefined,
      };
    }, env);
  }

  return {
    ok: false,
    error:
      'Lens requires typedDataId + signature (client-side signed) or auth.lens_token. ' +
      'Sign the typed data with your wallet, then pass typedDataId + signature.',
  };
}

// ─── Telegram ─────────────────────────────────────────────────────────────

async function publishToTelegram(
  input: PublishInput,
  auth: Record<string, string>,
  env: Env,
): Promise<PublishResult> {
  const { TGBotClient, uploadMediaGroup } = await import('@degenfeed/telegram-sdk');

  const botToken = auth.telegram_bot_token || env.TELEGRAM_BOT_TOKEN;
  const chatId = auth.telegram_chat_id || auth.chat_id;

  if (!botToken) {
    return { ok: false, error: 'No Telegram bot token provided (auth.telegram_bot_token)' };
  }
  if (!chatId) {
    return { ok: false, error: 'No Telegram chat ID provided (auth.telegram_chat_id)' };
  }

  try {
    return reliablePublish('telegram', async () => {
      const bot = new TGBotClient(botToken);
      const formatted = formatForTelegram({
        text: input.text,
        images: input.images,
        links: input.links,
        hashtags: input.hashtags,
      });

      if (formatted.mediaUrls && formatted.mediaUrls.length > 0) {
        // Send as media group with caption on first image
        const mediaResult = await uploadMediaGroup(
          bot,
          chatId,
          formatted.mediaUrls,
          formatted.text,
        );
        if (mediaResult.ok && mediaResult.messageIds) {
          return {
            ok: true,
            nativeId: String(mediaResult.messageIds[0]),
          };
        }
        // Fallback: send as text if media group fails
      }

      // Send as text message
      const msgResult = await bot.sendMessage(chatId, formatted.text, {
        parseMode: 'HTML',
      });

      return {
        ok: true,
        nativeId: String(msgResult.messageId),
      };
    }, env);
  } catch (err) {
    return {
      ok: false,
      error: `Telegram publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── RSS ──────────────────────────────────────────────────────────────────

async function publishToRss(
  input: PublishInput,
  auth: Record<string, string>,
  env: Env,
): Promise<PublishResult> {
  const { formatForRss } = await import('./format-translator');

  const feedUrl = auth.rss_feed_url || (env as Record<string, string | undefined>).RSS_FEED_URL;
  const publishUrl = auth.rss_publish_url || (env as Record<string, string | undefined>).RSS_PUBLISH_URL;

  if (!feedUrl) {
    return { ok: false, error: 'No RSS feed URL provided' };
  }

  try {
    return reliablePublish('rss', async () => {
      const xml = formatForRss(
        {
          text: input.text,
          title: input.title,
          images: input.images,
          links: input.links,
        },
        feedUrl,
      );

      // If a publish endpoint is configured, POST the XML there
      if (publishUrl) {
        const res = await fetch(publishUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/rss+xml',
            authorization: auth.rss_token ? `Bearer ${auth.rss_token}` : '',
          },
          body: xml,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return {
            ok: false,
            error: `RSS publish endpoint returned ${res.status}: ${errText.slice(0, 200)}`,
          };
        }

        return { ok: true, nativeId: `rss:${Date.now()}` };
      }

      // Without a publish URL, we return the XML for the caller to use
      return {
        ok: true,
        nativeId: `rss:${Date.now()}`,
        nativeUri: `data:application/rss+xml,${encodeURIComponent(xml)}`,
      };
    }, env);
  } catch (err) {
    return {
      ok: false,
      error: `RSS publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Threads (Meta Graph API) ────────────────────────────────────────────

async function publishToThreads(
  input: PublishInput,
  auth: Record<string, string>,
  env: Env,
): Promise<PublishResult> {
  const accessToken = auth.threads_jwt || auth.threads_accessToken || auth.accessJwt;
  const threadsUserId = auth.threads_userId || auth.threads_did || '';

  if (!accessToken) {
    return { ok: false, error: 'No Threads access token provided' };
  }
  if (!threadsUserId) {
    return { ok: false, error: 'No Threads user ID provided' };
  }

  try {
    return reliablePublish('threads', async () => {
      // Step 1: Create the thread
      const createRes = await fetch(
        `https://graph.threads.net/v1.0/${threadsUserId}/threads?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            text: input.text.slice(0, 500),
            media_type: 'TEXT',
          }),
        },
      );

      if (!createRes.ok) {
        const errText = await createRes.text();
        return { ok: false, error: `Threads create failed: ${errText.slice(0, 200)}` };
      }

      const createData = (await createRes.json()) as { id: string };

      // Step 2: Publish the thread
      const publishRes = await fetch(
        `https://graph.threads.net/v1.0/${threadsUserId}/threads_publish?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ creation_id: createData.id }),
        },
      );

      if (!publishRes.ok) {
        const errText = await publishRes.text();
        return { ok: false, error: `Threads publish failed: ${errText.slice(0, 200)}` };
      }

      const publishData = (await publishRes.json()) as { id: string };
      return { ok: true, nativeId: publishData.id };
    }, env);
  } catch (err) {
    return {
      ok: false,
      error: `Threads publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
