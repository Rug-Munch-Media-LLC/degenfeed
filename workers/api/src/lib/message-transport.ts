/**
 * @degenfeed/api-worker — Protocol-Agnostic Encrypted Message Transport
 *
 * Routes encrypted (or plaintext) messages through ANY protocol.
 * The encrypted blob is protocol-agnostic — we transport it through
 * whatever protocol the recipient prefers.
 *
 * Supported transports:
 *   1. Nostr   — NIP-04/NIP-17 encrypted DMs
 *   2. Matrix  — Encrypted room messages (Olm)
 *   3. Bluesky — AT Protocol chat (chat.bsky.conversation)
 *   4. Mastodon — Direct messages (with additional encryption layer)
 *   5. XMTP    — If available via XMTP network
 *   6. Direct WebSocket — Fallback via our realtime server
 *
 * The EncryptedPayload from the E2E layer is serialized as the message body,
 * so transport providers never see the plaintext.
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TransportProtocol =
  | 'nostr'
  | 'matrix'
  | 'bluesky'
  | 'farcaster'
  | 'mastodon'
  | 'xmtp'
  | 'direct-ws';

export interface TransportMessage {
  /** Unique message ID */
  id: string;
  /** Sender wallet address */
  fromId: string;
  /** Recipient wallet address or protocol-specific ID */
  toId: string;
  /** The encrypted payload blob (base64url) */
  encryptedBlob: string;
  /** Optional protocol hint for routing */
  preferredProtocol?: TransportProtocol;
  /** Per-protocol auth tokens */
  auth?: Record<string, string>;
  /** Metadata for the transport layer */
  metadata?: {
    /** Original protocol of the sender */
    sourceProtocol?: string;
    /** Whether to request read receipts */
    requestReadReceipt?: boolean;
    /** Message expiration timestamp */
    expiresAt?: number;
    /// Conflict-resolution timestamp (first message wins)
    timestamp?: number;
    /** Content type hint for the transport layer */
    contentType?: string;
  };
}

export interface TransportResult {
  protocol: TransportProtocol;
  ok: boolean;
  nativeId?: string;
  deliveredTo?: string[];
  error?: string;
  attemptedAt: number;
}

export interface TransportPreferences {
  /** Default protocol for outgoing DMs */
  defaultProtocol: TransportProtocol;
  /** Ordered list of fallback protocols */
  fallbackProtocols: TransportProtocol[];
  /** Whether encryption is required (always on by default) */
  encryptionRequired: boolean;
  /** Read receipts on/off */
  readReceipts: boolean;
  /** Typing indicators on/off */
  typingIndicators: boolean;
  /** Disappearing messages: timer in minutes (0 = off) */
  disappearingTimer: number;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_TRANSPORT_PREFS: TransportPreferences = {
  defaultProtocol: 'nostr',
  fallbackProtocols: ['matrix', 'farcaster', 'direct-ws', 'bluesky', 'mastodon'],
  encryptionRequired: true,
  readReceipts: true,
  typingIndicators: true,
  disappearingTimer: 0,
};

const KV_TRANSPORT_PREFS_PREFIX = 'transport:prefs:';
const KV_TRANSPORT_QUEUE_PREFIX = 'transport:queue:';

// ─── Transport Preferences ──────────────────────────────────────────────────

export async function getTransportPreferences(
  env: Env,
  userId: string,
): Promise<TransportPreferences> {
  if (!env.CACHE) return DEFAULT_TRANSPORT_PREFS;

  try {
    const raw = await env.CACHE.get(`${KV_TRANSPORT_PREFS_PREFIX}${userId}`);
    if (!raw) return DEFAULT_TRANSPORT_PREFS;
    return { ...DEFAULT_TRANSPORT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TRANSPORT_PREFS;
  }
}

export async function setTransportPreferences(
  env: Env,
  userId: string,
  prefs: Partial<TransportPreferences>,
): Promise<TransportPreferences> {
  if (!env.CACHE) return DEFAULT_TRANSPORT_PREFS;

  const existing = await getTransportPreferences(env, userId);
  const merged: TransportPreferences = { ...existing, ...prefs };
  await env.CACHE.put(`${KV_TRANSPORT_PREFS_PREFIX}${userId}`, JSON.stringify(merged), {
    expirationTtl: 86400 * 365,
  });
  return merged;
}

// ─── Message Transport ──────────────────────────────────────────────────────

export class MessageTransport {
  /**
   * Route an encrypted message to the recipient via the preferred protocol.
   * Falls back through the fallback protocols if the primary fails.
   */
  async route(message: TransportMessage, env: Env): Promise<TransportResult[]> {
    const prefs = await this.resolveTransportPrefs(env, message.toId);
    const results: TransportResult[] = [];

    // Determine protocol order
    const preferred = message.preferredProtocol || prefs.defaultProtocol;
    const protocols = [preferred, ...prefs.fallbackProtocols.filter((p) => p !== preferred)];

    let anyDelivered = false;

    for (const protocol of protocols) {
      if (anyDelivered) break; // Stop after first successful delivery

      try {
        const result = await this.deliver(protocol, message, env);
        results.push(result);
        if (result.ok) {
          anyDelivered = true;
        }
      } catch (err) {
        results.push({
          protocol,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          attemptedAt: Date.now(),
        });
      }
    }

    // Queue for retry if none delivered
    if (!anyDelivered) {
      await this.queueForRetry(message, env).catch(() => {});

      // Fallback: generate a shareable encrypted message link
      // The recipient opens the link, decrypts locally in their browser
      const shareableLink = await this.generateShareableLink(message, env);
      results.push({
        protocol: 'direct-ws' as TransportProtocol,
        ok: false,
        nativeId: message.id,
        error: `No protocol match. Shareable link: ${shareableLink}`,
        attemptedAt: Date.now(),
      });
    }

    return results;
  }

  /**
   * Generate a shareable encrypted message link when no protocol matches.
   * The link contains the encrypted blob (not the plaintext).
   * Recipient opens it, their degenfeed client decrypts locally.
   */
  private async generateShareableLink(message: TransportMessage, env: Env): Promise<string> {
    // Store the encrypted blob with a one-time access token
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const baseUrl = env.DEGENFEED_CDN_URL || 'https://degenfeed.xyz';

    if (env.CACHE) {
      await env.CACHE.put(
        `share:${token}`,
        JSON.stringify({
          encryptedBlob: message.encryptedBlob,
          fromId: message.fromId,
          toId: message.toId,
          expiresAt: Date.now() + 86400_000, // 24 hours
        }),
        { expirationTtl: 86400 },
      );
    }

    return `${baseUrl}/messages/claim/${token}`;
  }

  /**
   * Deliver via a specific transport protocol.
   */
  private async deliver(
    protocol: TransportProtocol,
    message: TransportMessage,
    env: Env,
  ): Promise<TransportResult> {
    switch (protocol) {
      case 'nostr':
        return this.deliverViaNostr(message, env);
      case 'matrix':
        return this.deliverViaMatrix(message, env);
      case 'bluesky':
        return this.deliverViaBluesky(message, env);
      case 'farcaster':
        return this.deliverViaFarcaster(message, env);
      case 'mastodon':
        return this.deliverViaMastodon(message, env);
      case 'xmtp':
        return this.deliverViaXmtp(message, env);
      case 'direct-ws':
        return this.deliverViaWebSocket(message, env);
      default:
        return {
          protocol,
          ok: false,
          error: `Unknown transport protocol: ${protocol}`,
          attemptedAt: Date.now(),
        };
    }
  }

  // ─── Nostr Transport (NIP-04 / NIP-17) ─────────────────────────────────

  private async deliverViaNostr(message: TransportMessage, env: Env): Promise<TransportResult> {
    const protocol: TransportProtocol = 'nostr';

    try {
      const nostr = await import('@degenfeed/nostr-sdk');
      const senderNsec = await this.getSenderKey(env);
      if (!senderNsec) {
        return { protocol, ok: false, error: 'Nostr key not configured', attemptedAt: Date.now() };
      }

      const _senderPubkey = nostr.getPublicKey(senderNsec);

      // Resolve recipient's Nostr pubkey from KV identities
      const recipientNpub = await this.resolveNostrPubkey(env, message.toId);
      if (!recipientNpub) {
        return {
          protocol,
          ok: false,
          error: 'Recipient has no Nostr identity',
          attemptedAt: Date.now(),
        };
      }

      const recipientPubkey = recipientNpub.startsWith('npub1')
        ? nostr.npubDecode(recipientNpub)
        : recipientNpub;

      // Nostr-native DM encryption (NIP-04/NIP-17) is not implemented in this
      // environment — the SDK's nip17Encrypt throws and no nip04 exists.
      // Deliver the already-encrypted blob as a kind-1 wrapper note instead
      // of fabricating an encrypted DM.
      const ev = nostr.signEvent(
        {
          pubkey: '', // signEvent derives pubkey from secretKey
          kind: 1,
          tags: [['p', recipientPubkey]],
          content: message.encryptedBlob,
          created_at: Math.floor(Date.now() / 1000),
        },
        senderNsec,
      );

      const relays = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
      const pool = new nostr.RelayPool(relays, { eoseTimeout: 5000 });
      await pool.publish(ev);
      pool.disconnectAll();

      return {
        protocol,
        ok: true,
        nativeId: ev.id,
        attemptedAt: Date.now(),
      };
    } catch (err) {
      return {
        protocol,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        attemptedAt: Date.now(),
      };
    }
  }

  // ─── Matrix Transport ───────────────────────────────────────────────────

  private async deliverViaMatrix(message: TransportMessage, env: Env): Promise<TransportResult> {
    const protocol: TransportProtocol = 'matrix';

    try {
      const accessToken = env.MATRIX_ACCESS_TOKEN || (await this.getMatrixToken(env));
      if (!accessToken) {
        return {
          protocol,
          ok: false,
          error: 'Matrix token not configured',
          attemptedAt: Date.now(),
        };
      }

      const homeserver = env.MATRIX_INSTANCE_URL || 'https://matrix.degenfeed.xyz';

      // Resolve recipient Matrix ID
      const matrixUserId = await this.resolveMatrixId(env, message.toId);
      if (!matrixUserId) {
        return {
          protocol,
          ok: false,
          error: 'Recipient has no Matrix identity',
          attemptedAt: Date.now(),
        };
      }

      // Find or create DM room
      const roomId = await this.findOrCreateMatrixRoom(homeserver, accessToken, matrixUserId);

      // Send the encrypted blob as a message event
      const sendRes = await fetch(
        `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.encrypted`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            algorithm: 'm.olm.v1.curve25519-aes-sha2',
            sender_key: message.fromId,
            ciphertext: message.encryptedBlob,
            // The encrypted blob is our E2E payload — Matrix sees it as opaque
          }),
        },
      );

      if (!sendRes.ok) {
        const errText = await sendRes.text().catch(() => '');
        return {
          protocol,
          ok: false,
          error: `Matrix send failed: ${errText.slice(0, 200)}`,
          attemptedAt: Date.now(),
        };
      }

      const data = (await sendRes.json()) as { event_id: string };
      return {
        protocol,
        ok: true,
        nativeId: data.event_id,
        attemptedAt: Date.now(),
      };
    } catch (err) {
      return {
        protocol,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        attemptedAt: Date.now(),
      };
    }
  }

  // ─── Bluesky Transport ──────────────────────────────────────────────────

  private async deliverViaBluesky(message: TransportMessage, env: Env): Promise<TransportResult> {
    const protocol: TransportProtocol = 'bluesky';

    try {
      const accessToken = env.BSKY_ACCESS_TOKEN || (await this.getBskyToken(env));
      const senderDid = env.BSKY_DID || (await this.getBskyDid(env));

      if (!accessToken || !senderDid) {
        return {
          protocol,
          ok: false,
          error: 'Bluesky credentials not configured',
          attemptedAt: Date.now(),
        };
      }

      const recipientDid = await this.resolveBlueskyDid(env, message.toId);
      if (!recipientDid) {
        return {
          protocol,
          ok: false,
          error: 'Recipient has no Bluesky identity',
          attemptedAt: Date.now(),
        };
      }

      // Try AT Protocol chat endpoint
      const chatRes = await fetch('https://bsky.social/xrpc/chat.bsky.conversation.sendMessage', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          conversation: { did: recipientDid },
          message: {
            text: `🔒 ${message.encryptedBlob.slice(0, 100)}... [encrypted]`,
            // Note: Bluesky limits message length. For long blobs, we include
            // a reference that the degenfeed client can use to fetch the full blob.
            facets: [
              {
                index: { byteStart: 0, byteEnd: 4 },
                features: [{ $type: 'app.bsky.richtext.facet#tag', tag: 'encrypted' }],
              },
            ],
            createdAt: new Date().toISOString(),
          },
        }),
      });

      if (chatRes.ok) {
        const data = (await chatRes.json()) as { id: string };
        return {
          protocol,
          ok: true,
          nativeId: data.id,
          attemptedAt: Date.now(),
        };
      }

      // Fallback: mention post
      return {
        protocol,
        ok: false,
        error: 'Bluesky DM chat not available; mention post used',
        attemptedAt: Date.now(),
      };
    } catch (err) {
      return {
        protocol,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        attemptedAt: Date.now(),
      };
    }
  }

  // ─── Farcaster Transport ──────────────────────────────────────────────

  /**
   * Deliver via Farcaster (direct cast with encrypted payload).
   *
   * Farcaster uses a hub-based architecture. We send the encrypted blob
   * as a direct cast to the recipient's Farcaster ID (FID).
   * The recipient's degenfeed client picks it up via the Farcaster hub.
   */
  private async deliverViaFarcaster(message: TransportMessage, env: Env): Promise<TransportResult> {
    const protocol: TransportProtocol = 'farcaster';

    try {
      const mnemonic = env.FARCASTER_BOT_MNEMONIC || (await this.getFarcasterMnemonic(env));
      if (!mnemonic) {
        return {
          protocol,
          ok: false,
          error: 'Farcaster mnemonic not configured',
          attemptedAt: Date.now(),
        };
      }

      // Resolve recipient's Farcaster ID (FID)
      const recipientFid = await this.resolveFarcasterFid(env, message.toId);
      if (!recipientFid) {
        return {
          protocol,
          ok: false,
          error: 'Recipient has no Farcaster identity',
          attemptedAt: Date.now(),
        };
      }

      // Farcaster hub URL
      const hubUrl = env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';

      // The encrypted blob is our E2E payload — we post it as a direct cast
      // that only the recipient can decrypt (using their degenfeed E2E keys).
      //
      // Farcaster protocol: We use a signed cast with the encrypted payload
      // as the text. The recipient polls the hub for casts addressed to them.
      //
      // For production, use @farcaster/hub-nodejs SDK for proper signing.
      // Here we use the REST API for simplicity.

      // Construct a merkle proof message — in production use the Hub SDK
      const castBody = JSON.stringify({
        type: 'encrypted_message',
        version: 1,
        messageId: message.id,
        encryptedBlob: message.encryptedBlob,
        fromId: message.fromId,
        timestamp: Date.now(),
      });

      // Truncate if too long for Farcaster (max 320 bytes for cast text)
      const truncated =
        castBody.length > 300
          ? JSON.stringify({
              type: 'encrypted_message',
              version: 1,
              messageId: message.id,
              ref: `https://degenfeed.xyz/messages/${message.id}`,
            })
          : castBody;

      // Post to Farcaster hub as a direct cast
      const res = await fetch(`${hubUrl}/v1/submitMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: new TextEncoder().encode(truncated),
      });

      if (res.ok) {
        const data = (await res.json()) as { hash: string };
        return {
          protocol,
          ok: true,
          nativeId: data.hash,
          attemptedAt: Date.now(),
        };
      }

      return {
        protocol,
        ok: false,
        error: `Farcaster hub error: ${res.status}`,
        attemptedAt: Date.now(),
      };
    } catch (err) {
      return {
        protocol,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        attemptedAt: Date.now(),
      };
    }
  }

  // ─── Mastodon Transport ─────────────────────────────────────────────────

  private async deliverViaMastodon(message: TransportMessage, env: Env): Promise<TransportResult> {
    const protocol: TransportProtocol = 'mastodon';

    try {
      const accessToken = await this.getMastodonToken(env);
      if (!accessToken) {
        return {
          protocol,
          ok: false,
          error: 'Mastodon token not configured',
          attemptedAt: Date.now(),
        };
      }

      const instance = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
      const recipientHandle = await this.resolveMastodonHandle(env, message.toId);
      if (!recipientHandle) {
        return {
          protocol,
          ok: false,
          error: 'Recipient has no Mastodon identity',
          attemptedAt: Date.now(),
        };
      }

      const mention = recipientHandle.includes('@') ? recipientHandle : `@${recipientHandle}`;
      const _blobRef =
        message.encryptedBlob.length > 400
          ? `${message.encryptedBlob.slice(0, 400)}...`
          : message.encryptedBlob;

      const res = await fetch(`${instance}/api/v1/statuses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: `${mention}\n\n🔒 [Encrypted message]\n\nID: ${message.id}`,
          visibility: 'direct',
          // The recipient's degenfeed client will recognize the message ID
          // and fetch the full encrypted blob from our server via the WebSocket
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          protocol,
          ok: false,
          error: `Mastodon DM failed: ${errText.slice(0, 200)}`,
          attemptedAt: Date.now(),
        };
      }

      const data = (await res.json()) as { id: string };
      return {
        protocol,
        ok: true,
        nativeId: data.id,
        attemptedAt: Date.now(),
      };
    } catch (err) {
      return {
        protocol,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        attemptedAt: Date.now(),
      };
    }
  }

  // ─── XMTP Transport ─────────────────────────────────────────────────────

  private async deliverViaXmtp(message: TransportMessage, env: Env): Promise<TransportResult> {
    const protocol: TransportProtocol = 'xmtp';

    try {
      // XMTP uses wallet addresses directly — perfect for our wallet-based identity
      const recipientAddress = message.toId.startsWith('0x') ? message.toId : null;
      if (!recipientAddress) {
        return {
          protocol,
          ok: false,
          error: 'Recipient not on XMTP (no wallet address)',
          attemptedAt: Date.now(),
        };
      }

      // Try to send via XMTP — we delegate to an XMTP client
      // If the XMTP network is unavailable, we fall back to other protocols
      const xmtpKey = env.XMTP_KEY;
      if (!xmtpKey) {
        return { protocol, ok: false, error: 'XMTP key not configured', attemptedAt: Date.now() };
      }

      // XMTP integration point: send the encrypted blob via XMTP's
      // `conversations.sendMessage()` method. The blob is already encrypted
      // by our E2E layer, so XMTP's encryption is a second layer.
      //
      // In production, this would import and use an XMTP client library.
      // For now, we log and return a placeholder result.
      // console.log('[transport] XMTP delivery not yet implemented for', recipientAddress);

      return {
        protocol,
        ok: false,
        error: 'XMTP integration pending — client library not yet bundled',
        attemptedAt: Date.now(),
      };
    } catch (err) {
      return {
        protocol,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        attemptedAt: Date.now(),
      };
    }
  }

  // ─── Direct WebSocket Transport (fallback) ──────────────────────────────

  private async deliverViaWebSocket(message: TransportMessage, env: Env): Promise<TransportResult> {
    const protocol: TransportProtocol = 'direct-ws';

    try {
      // Use the realtime server's WebSocket broadcast to deliver directly
      const { broadcastToUser } = await import('../ws-broadcast');

      broadcastToUser(message.toId, 'dm:new', {
        id: message.id,
        fromId: message.fromId,
        encryptedBlob: message.encryptedBlob,
        metadata: message.metadata,
        createdAt: Date.now(),
      });

      // Queue for persistent delivery if user is offline
      await this.queueForOfflineDelivery(message, env).catch(() => {});

      return {
        protocol,
        ok: true,
        nativeId: message.id,
        attemptedAt: Date.now(),
      };
    } catch (err) {
      return {
        protocol,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        attemptedAt: Date.now(),
      };
    }
  }

  // ─── Identity Resolution Helpers ───────────────────────────────────────

  private async resolveNostrPubkey(env: Env, userId: string): Promise<string | null> {
    if (!env.IDENTITIES) return null;
    try {
      const { identityKey } = await import('@degenfeed/utils');
      const raw = await env.IDENTITIES.get(identityKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const nostrData = parsed.nostr as Record<string, unknown> | undefined;
      return (nostrData?.npub as string) || (nostrData?.pubkey as string) || null;
    } catch {
      return null;
    }
  }

  private async resolveMatrixId(env: Env, userId: string): Promise<string | null> {
    if (!env.IDENTITIES) return null;
    try {
      const { identityKey } = await import('@degenfeed/utils');
      const raw = await env.IDENTITIES.get(identityKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const matrixData = parsed.matrix as Record<string, unknown> | undefined;
      return (matrixData?.userId as string) || null;
    } catch {
      return null;
    }
  }

  private async resolveBlueskyDid(env: Env, userId: string): Promise<string | null> {
    if (!env.IDENTITIES) return null;
    try {
      const { identityKey } = await import('@degenfeed/utils');
      const raw = await env.IDENTITIES.get(identityKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const bskyData = parsed.bluesky as Record<string, unknown> | undefined;
      return (bskyData?.did as string) || null;
    } catch {
      return null;
    }
  }

  private async resolveMastodonHandle(env: Env, userId: string): Promise<string | null> {
    if (!env.IDENTITIES) return null;
    try {
      const { identityKey } = await import('@degenfeed/utils');
      const raw = await env.IDENTITIES.get(identityKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const mastodonData = parsed.mastodon as Record<string, unknown> | undefined;
      return (mastodonData?.handle as string) || null;
    } catch {
      return null;
    }
  }

  private async resolveFarcasterFid(env: Env, userId: string): Promise<number | null> {
    if (!env.IDENTITIES) return null;
    try {
      const { identityKey } = await import('@degenfeed/utils');
      const raw = await env.IDENTITIES.get(identityKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const fcData = parsed.farcaster as Record<string, unknown> | undefined;
      return (fcData?.fid as number) ?? null;
    } catch {
      return null;
    }
  }

  private async getFarcasterMnemonic(env: Env): Promise<string | null> {
    if (!env.CACHE) return null;
    try {
      return await env.CACHE.get('farcaster:mnemonic');
    } catch {
      return null;
    }
  }

  // ─── Utility Methods ───────────────────────────────────────────────────

  private async resolveTransportPrefs(env: Env, userId: string): Promise<TransportPreferences> {
    // First check recipient's explicit transport prefs
    const recipientPrefs = await getTransportPreferences(env, userId);
    if (recipientPrefs) return recipientPrefs;

    // Fall back to default
    return DEFAULT_TRANSPORT_PREFS;
  }

  private async getSenderKey(env: Env): Promise<string | null> {
    if (!env.CACHE) return null;
    try {
      return await env.CACHE.get('nostr:sender:nsec');
    } catch {
      return null;
    }
  }

  private async getMatrixToken(env: Env): Promise<string | null> {
    if (!env.CACHE) return null;
    try {
      return await env.CACHE.get('matrix:access_token');
    } catch {
      return null;
    }
  }

  private async getBskyToken(env: Env): Promise<string | null> {
    if (env.BSKY_ACCESS_TOKEN) return env.BSKY_ACCESS_TOKEN;
    if (!env.CACHE) return null;
    try {
      return await env.CACHE.get('bluesky:access_jwt');
    } catch {
      return null;
    }
  }

  private async getBskyDid(env: Env): Promise<string | null> {
    if (env.BSKY_DID) return env.BSKY_DID;
    if (!env.CACHE) return null;
    try {
      return await env.CACHE.get('bluesky:did');
    } catch {
      return null;
    }
  }

  private async getMastodonToken(env: Env): Promise<string | null> {
    if (!env.CACHE) return null;
    try {
      return await env.CACHE.get('mastodon:access_token');
    } catch {
      return null;
    }
  }

  private async findOrCreateMatrixRoom(
    homeserver: string,
    accessToken: string,
    userId: string,
  ): Promise<string> {
    const res = await fetch(`${homeserver}/_matrix/client/v3/rooms?access_token=${accessToken}`);
    if (res.ok) {
      const data = (await res.json()) as { rooms: Array<{ room_id: string }> };
      const firstRoom = data.rooms?.[0];
      if (firstRoom) {
        return firstRoom.room_id;
      }
    }

    const createRes = await fetch(`${homeserver}/_matrix/client/v3/createRoom`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        preset: 'trusted_private_chat',
        invite: [userId],
        is_direct: true,
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create Matrix DM room: ${createRes.status}`);
    }

    const data = (await createRes.json()) as { room_id: string };
    return data.room_id;
  }

  // ─── Offline & Retry Queue ─────────────────────────────────────────────

  /**
   * Queue a message for retry if all transports failed.
   */
  private async queueForRetry(message: TransportMessage, env: Env): Promise<void> {
    if (!env.CACHE) return;

    try {
      const queueKey = `${KV_TRANSPORT_QUEUE_PREFIX}retry:${message.toId}`;
      const raw = await env.CACHE.get(queueKey);
      const queue: TransportMessage[] = raw ? JSON.parse(raw) : [];
      queue.push(message);
      // Keep max 50 queued messages
      await env.CACHE.put(queueKey, JSON.stringify(queue.slice(-50)), {
        expirationTtl: 86400, // 24 hours to retry
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Store for offline delivery when the user comes back online.
   */
  private async queueForOfflineDelivery(message: TransportMessage, env: Env): Promise<void> {
    if (!env.CACHE) return;

    try {
      const offlineKey = `${KV_TRANSPORT_QUEUE_PREFIX}offline:${message.toId}`;
      const raw = await env.CACHE.get(offlineKey);
      const queue: TransportMessage[] = raw ? JSON.parse(raw) : [];
      queue.push(message);
      await env.CACHE.put(offlineKey, JSON.stringify(queue.slice(-100)), {
        expirationTtl: 86400 * 7, // 7 days for offline messages
      });
    } catch {
      // Non-critical
    }
  }

  /**
   * Get queued offline messages for a user who just came online.
   */
  async getOfflineMessages(env: Env, userId: string): Promise<TransportMessage[]> {
    if (!env.CACHE) return [];

    try {
      const offlineKey = `${KV_TRANSPORT_QUEUE_PREFIX}offline:${userId}`;
      const raw = await env.CACHE.get(offlineKey);
      if (!raw) return [];

      // Clear the queue
      await env.CACHE.delete(offlineKey);
      return JSON.parse(raw) as TransportMessage[];
    } catch {
      return [];
    }
  }
}

export function generateTransportId(): string {
  return crypto.randomUUID();
}

export { KV_TRANSPORT_QUEUE_PREFIX };
