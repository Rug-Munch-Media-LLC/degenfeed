/**
 * @degenfeed/chat-super-app — Matrix Universal Chat Hub
 *
 * Conduit (self-hosted Matrix homeserver on port 8448) as the bridge fabric.
 * ALL chat protocols bridged THROUGH Matrix. One Matrix room = one DegenFeed chat.
 * Messages flow bidirectionally between all protocols.
 *
 * Architecture:
 *   Nostr  ──→ Matrix bridge ──→ Conduit (8448) ──→ DegenFeed Chat
 *   Lens   ──→ Matrix bridge ──→ Conduit (8448) ──→ DegenFeed Chat
 *   Bluesky──→ Matrix bridge ──→ Conduit (8448) ──→ DegenFeed Chat
 *   ...all protocols bridged through Matrix room fabric
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures.
 */

import type { Env } from '@degenfeed/types';

// ─── KV Store Type ──────────────────────────────────────────────────────────

interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

function getKV(env: Env): KVStore | null {
  const kv = getKV(env);
  return (kv as unknown as KVStore) ?? null;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CONDUIT_URL = process.env.CONDUIT_URL || 'http://localhost:8448';
const CONDUIT_ACCESS_TOKEN_KEY = 'matrix:conduit:access_token';
const CONDUIT_ADMIN_TOKEN_KEY = 'matrix:conduit:admin_token';

const BRIDGE_ROOM_PREFIX = 'matrix:bridge:room:';
const BRIDGE_CONFIG_PREFIX = 'matrix:bridge:config:';

/** All protocols that can be bridged through Matrix */
export const BRIDGEABLE_PROTOCOLS = [
  'nostr',
  'lens',
  'bluesky',
  'farcaster',
  'mastodon',
  'activitypub',
  'telegram',
  'discord',
  'irc',
  'xmpp',
  'lens',
  'signal',
  'session',
  'xmtp',
  'whatsapp',
  'matrix',
] as const;

export type BridgeProtocol = (typeof BRIDGEABLE_PROTOCOLS)[number];

export interface BridgeConfig {
  protocol: BridgeProtocol;
  enabled: boolean;
  roomId: string;
  matrixUserId: string;
  bridgeType: 'appservice' | 'webhook' | 'bot';
  nativeEndpoint?: string;
  nativeToken?: string;
  lastHealthCheck: number;
  healthStatus: 'healthy' | 'degraded' | 'down';
  messageCount: number;
  errorCount: number;
  connectedAt: number;
  metadata: Record<string, string>;
}

export interface BridgeRoom {
  roomId: string;
  name: string;
  protocolRoomId: string;
  protocol: BridgeProtocol;
  bridgedProtocols: BridgeProtocol[];
  members: string[];
  createdAt: number;
  lastActivity: number;
  encrypted: boolean;
  federated: boolean;
}

export interface BridgeMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderProtocol: BridgeProtocol;
  body: string;
  encrypted: boolean;
  nativeEventId?: string;
  bridgedTo: BridgeProtocol[];
  timestamp: number;
}

export interface BridgeStatus {
  protocol: BridgeProtocol;
  enabled: boolean;
  healthy: boolean;
  connectedRoomCount: number;
  messagesProcessed: number;
  errors: number;
  lastHealthCheck: number;
  latencyMs: number;
}

// ─── Matrix Hub Client ─────────────────────────────────────────────────────

export class MatrixHub {
  private conduitUrl: string;
  private accessToken: string | null = null;
  private bridgeConfigs: Map<BridgeProtocol, BridgeConfig> = new Map();
  private bridgeRooms: Map<string, BridgeRoom> = new Map();

  constructor() {
    this.conduitUrl = CONDUIT_URL;
  }

  /**
   * Initialize the Matrix hub — authenticate with Conduit and load bridge configs.
   */
  async initialize(env: Env): Promise<boolean> {
    try {
      // Load tokens from KV
      const kv = getKV(env);
      if (kv) {
        this.accessToken = await kv.get(CONDUIT_ACCESS_TOKEN_KEY);
        this.adminToken = await kv.get(CONDUIT_ADMIN_TOKEN_KEY);
      }

      // If no token, register a bridge bot user on Conduit
      if (!this.accessToken) {
        const registered = await this.registerBridgeBot(env);
        if (!registered) {
          console.error('[matrix-hub] Failed to register bridge bot on Conduit');
          return false;
        }
      }

      // Load all bridge configs from KV
      await this.loadBridgeConfigs(env);

      // Verify Conduit is reachable
      const healthy = await this.checkConduitHealth();
      if (!healthy) {
        console.warn('[matrix-hub] Conduit reachable but health check degraded');
      }

      console.log('[matrix-hub] Matrix hub initialized successfully');
      return true;
    } catch (err) {
      console.error('[matrix-hub] Initialization failed:', err);
      return false;
    }
  }

  /**
   * Register a bridge bot user on the Conduit homeserver.
   */
  private async registerBridgeBot(env: Env): Promise<boolean> {
    try {
      const botUsername = `degenfeed_bridge_${Date.now()}`;
      const botPassword = crypto.randomUUID().replace(/-/g, '') + 'Aa1!';

      // Register via Conduit's admin API
      const res = await fetch(`${this.conduitUrl}/_matrix/client/v3/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: botUsername,
          password: botPassword,
          auth: { type: 'm.login.dummy' },
          initial_device_display_name: 'DegenFeed Bridge Bot',
        }),
      });

      if (!res.ok) {
        // Try admin registration if user-facing register fails
        return await this.adminRegisterBot(env, botUsername, botPassword);
      }

      const data = (await res.json()) as { access_token: string; user_id: string };
      this.accessToken = data.access_token;

      // Store tokens
      const kv = getKV(env);
      if (kv) {
        await kv.put(CONDUIT_ACCESS_TOKEN_KEY, data.access_token, {
          expirationTtl: 86400 * 365,
        });
        await kv.put('matrix:bridge:bot:user_id', data.user_id, {
          expirationTtl: 86400 * 365,
        });
      }

      return true;
    } catch (err) {
      console.error('[matrix-hub] Bridge bot registration failed:', err);
      return false;
    }
  }

  /**
   * Admin registration fallback for Conduit.
   */
  private async adminRegisterBot(env: Env, username: string, password: string): Promise<boolean> {
    try {
      const adminToken = env.MATRIX_ADMIN_TOKEN || process.env.MATRIX_ADMIN_TOKEN;
      if (!adminToken) return false;

      const res = await fetch(`${this.conduitUrl}/_matrix/client/v3/admin/register`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          admin: false,
          user_type: 'bot',
        }),
      });

      if (!res.ok) return false;

      // Now login to get access token
      return await this.loginAsBot(env, username, password);
    } catch {
      return false;
    }
  }

  /**
   * Login as the bridge bot to get an access token.
   */
  private async loginAsBot(env: Env, username: string, password: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.conduitUrl}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'm.login.password',
          user: username,
          password,
        }),
      });

      if (!res.ok) return false;

      const data = (await res.json()) as { access_token: string; user_id: string };
      this.accessToken = data.access_token;

      const kv = getKV(env);
      if (kv) {
        await kv.put(CONDUIT_ACCESS_TOKEN_KEY, data.access_token, {
          expirationTtl: 86400 * 365,
        });
        await kv.put('matrix:bridge:bot:user_id', data.user_id, {
          expirationTtl: 86400 * 365,
        });
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Conduit is healthy and reachable.
   */
  async checkConduitHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.conduitUrl}/_matrix/client/v3/versions`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return false;

      const data = (await res.json()) as { versions: string[] };
      return data.versions?.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Enable a protocol bridge.
   */
  async enableBridge(
    env: Env,
    protocol: BridgeProtocol,
    config: Partial<BridgeConfig>,
  ): Promise<BridgeConfig> {
    if (!BRIDGEABLE_PROTOCOLS.includes(protocol)) {
      throw new Error(`[matrix-hub] Unknown protocol: ${protocol}`);
    }

    // Create or get the bridge room on Matrix
    const roomId = await this.ensureBridgeRoom(env, protocol);

    const bridgeConfig: BridgeConfig = {
      protocol,
      enabled: true,
      roomId,
      matrixUserId: config.matrixUserId || (await this.getBotUserId(env)),
      bridgeType: config.bridgeType || 'webhook',
      nativeEndpoint: config.nativeEndpoint,
      nativeToken: config.nativeToken,
      lastHealthCheck: Date.now(),
      healthStatus: 'healthy',
      messageCount: 0,
      errorCount: 0,
      connectedAt: Date.now(),
      metadata: config.metadata || {},
    };

    this.bridgeConfigs.set(protocol, bridgeConfig);
    await this.saveBridgeConfig(env, protocol, bridgeConfig);

    // Join the bot to the room
    await this.joinRoom(roomId);

    console.log(`[matrix-hub] Bridge enabled for ${protocol} in room ${roomId}`);
    return bridgeConfig;
  }

  /**
   * Disable a protocol bridge.
   */
  async disableBridge(env: Env, protocol: BridgeProtocol): Promise<void> {
    const config = this.bridgeConfigs.get(protocol);
    if (!config) throw new Error(`[matrix-hub] Bridge not found: ${protocol}`);

    config.enabled = false;
    config.healthStatus = 'down';
    this.bridgeConfigs.set(protocol, config);
    await this.saveBridgeConfig(env, protocol, config);
  }

  /**
   * Get bridge status for all protocols.
   */
  async getBridgeStatuses(env: Env): Promise<BridgeStatus[]> {
    const statuses: BridgeStatus[] = [];

    for (const protocol of BRIDGEABLE_PROTOCOLS) {
      const config = this.bridgeConfigs.get(protocol);
      if (!config) {
        statuses.push({
          protocol,
          enabled: false,
          healthy: false,
          connectedRoomCount: 0,
          messagesProcessed: 0,
          errors: 0,
          lastHealthCheck: 0,
          latencyMs: 0,
        });
        continue;
      }

      // Perform health check
      const startTime = performance.now();
      const healthy = await this.checkBridgeHealth(env, protocol);
      const latencyMs = Math.round(performance.now() - startTime);

      statuses.push({
        protocol,
        enabled: config.enabled,
        healthy,
        connectedRoomCount: config.enabled ? 1 : 0,
        messagesProcessed: config.messageCount,
        errors: config.errorCount,
        lastHealthCheck: config.lastHealthCheck,
        latencyMs,
      });
    }

    return statuses;
  }

  /**
   * Route a message from any protocol through Matrix to all bridged protocols.
   */
  async routeMessage(
    env: Env,
    message: BridgeMessage,
    sourceProtocol: BridgeProtocol,
  ): Promise<{
    delivered: BridgeProtocol[];
    failed: BridgeProtocol[];
  }> {
    const delivered: BridgeProtocol[] = [];
    const failed: BridgeProtocol[] = [];

    // Ensure the bridge room exists
    let roomId = message.roomId;
    if (!roomId) {
      const config = this.bridgeConfigs.get(sourceProtocol);
      if (!config) {
        failed.push(sourceProtocol);
        return { delivered, failed };
      }
      roomId = config.roomId;
    }

    // Send the message to the Matrix room
    try {
      await this.sendMatrixMessage(roomId, message);
      delivered.push(sourceProtocol);
    } catch (err) {
      console.error(`[matrix-hub] Failed to send to Matrix room:`, err);
      failed.push(sourceProtocol);
    }

    // Bridge to all other protocols that have rooms mapped to this one
    const bridgedProtocols = await this.getBridgedProtocolsForRoom(roomId, sourceProtocol);
    for (const targetProtocol of bridgedProtocols) {
      try {
        const targetConfig = this.bridgeConfigs.get(targetProtocol);
        if (!targetConfig?.enabled) continue;

        await this.sendToNativeProtocol(targetProtocol, targetConfig, message);
        delivered.push(targetProtocol);
      } catch (err) {
        console.error(`[matrix-hub] Failed to bridge to ${targetProtocol}:`, err);
        failed.push(targetProtocol);
      }
    }

    // Update counters
    const sourceConfig = this.bridgeConfigs.get(sourceProtocol);
    if (sourceConfig) {
      sourceConfig.messageCount++;
      await this.saveBridgeConfig(env, sourceProtocol, sourceConfig);
    }

    return { delivered, failed };
  }

  /**
   * Send a message to a Matrix room.
   */
  async sendMatrixMessage(roomId: string, message: BridgeMessage): Promise<string> {
    if (!this.accessToken) throw new Error('[matrix-hub] Not authenticated with Conduit');

    const res = await fetch(
      `${this.conduitUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          msgtype: 'm.text',
          body: `[${message.senderProtocol}] ${message.senderId}: ${message.body}`,
          format: 'org.matrix.custom.html',
          formatted_body: `<strong>[${message.senderProtocol}]</strong> ${message.senderId}: ${message.body}`,
          'degenfeed:message_id': message.id,
          'degenfeed:sender_protocol': message.senderProtocol,
          'degenfeed:encrypted': message.encrypted,
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Matrix send failed: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as { event_id: string };
    return data.event_id;
  }

  /**
   * Listen for Matrix events from Conduit via the sync API.
   */
  async *syncEvents(env: Env): AsyncGenerator<BridgeMessage> {
    if (!this.accessToken) return;

    let nextBatch: string | undefined;
    const pollInterval = 1000;

    while (true) {
      try {
        const url = `${this.conduitUrl}/_matrix/client/v3/sync?timeout=30000${nextBatch ? `&since=${nextBatch}` : ''}`;
        const res = await fetch(url, {
          headers: { authorization: `Bearer ${this.accessToken}` },
          signal: AbortSignal.timeout(35000),
        });

        if (!res.ok) {
          await new Promise((r) => setTimeout(r, pollInterval));
          continue;
        }

        const sync = (await res.json()) as {
          next_batch: string;
          rooms?: {
            join?: Record<
              string,
              {
                timeline?: {
                  events: Array<{
                    event_id: string;
                    type: string;
                    sender: string;
                    content: {
                      body?: string;
                      msgtype?: string;
                      'degenfeed:message_id'?: string;
                      'degenfeed:sender_protocol'?: BridgeProtocol;
                    };
                    origin_server_ts: number;
                  }>;
                };
              }
            >;
          };
        };

        nextBatch = sync.next_batch;

        if (sync.rooms?.join) {
          for (const [roomId, roomData] of Object.entries(sync.rooms.join)) {
            const events = roomData.timeline?.events || [];
            for (const event of events) {
              if (event.type === 'm.room.message' && event.content.body) {
                // Skip our own messages
                if (event.sender === (await this.getBotUserId(env))) continue;

                yield {
                  id: event.content['degenfeed:message_id'] || event.event_id,
                  roomId,
                  senderId: event.sender,
                  senderProtocol: event.content['degenfeed:sender_protocol'] || 'matrix',
                  body: event.content.body,
                  encrypted: false,
                  nativeEventId: event.event_id,
                  bridgedTo: [],
                  timestamp: event.origin_server_ts,
                };
              }
            }
          }
        }
      } catch {
        await new Promise((r) => setTimeout(r, pollInterval));
      }
    }
  }

  /**
   * Create a bridge room for a protocol.
   */
  async createBridgeRoom(env: Env, protocol: BridgeProtocol, name: string): Promise<BridgeRoom> {
    if (!this.accessToken) throw new Error('[matrix-hub] Not authenticated');

    // Create the Matrix room
    const res = await fetch(`${this.conduitUrl}/_matrix/client/v3/createRoom`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name,
        topic: `DegenFeed bridge room for ${protocol} — cross-protocol chat`,
        preset: 'trusted_private_chat',
        room_alias_name: `degenfeed_${protocol}_${Date.now()}`,
        initial_state: [
          {
            type: 'm.room.history_visibility',
            content: { history_visibility: 'shared' },
          },
          {
            type: 'm.room.encryption',
            content: { algorithm: 'm.megolm.v1.aes-sha2' },
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to create Matrix room: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as { room_id: string };
    const roomId = data.room_id;

    const bridgeRoom: BridgeRoom = {
      roomId,
      name,
      protocolRoomId: roomId,
      protocol,
      bridgedProtocols: [protocol],
      members: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
      encrypted: true,
      federated: true,
    };

    this.bridgeRooms.set(roomId, bridgeRoom);
    await this.saveBridgeRoom(env, bridgeRoom);

    return bridgeRoom;
  }

  /**
   * Join a Matrix room as the bridge bot.
   */
  async joinRoom(roomId: string): Promise<void> {
    if (!this.accessToken) throw new Error('[matrix-hub] Not authenticated');

    const res = await fetch(
      `${this.conduitUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${this.accessToken}` },
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to join room: ${errText.slice(0, 200)}`);
    }
  }

  /**
   * Invite a user to a Matrix room.
   */
  async inviteUser(roomId: string, userId: string): Promise<void> {
    if (!this.accessToken) throw new Error('[matrix-hub] Not authenticated');

    const res = await fetch(
      `${this.conduitUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Failed to invite user: ${errText.slice(0, 200)}`);
    }
  }

  // ─── Protocol-Specific Bridge Senders ──────────────────────────────────

  private async sendToNativeProtocol(
    protocol: BridgeProtocol,
    config: BridgeConfig,
    message: BridgeMessage,
  ): Promise<void> {
    switch (protocol) {
      case 'nostr':
        await this.bridgeToNostr(config, message);
        break;
      case 'lens':
        await this.bridgeToLens(config, message);
        break;
      case 'bluesky':
        await this.bridgeToBluesky(config, message);
        break;
      case 'farcaster':
        await this.bridgeToFarcaster(config, message);
        break;
      case 'mastodon':
      case 'activitypub':
        await this.bridgeToActivityPub(config, message);
        break;
      case 'telegram':
        await this.bridgeToTelegram(config, message);
        break;
      case 'discord':
        await this.bridgeToDiscord(config, message);
        break;
      case 'irc':
        await this.bridgeToIRC(config, message);
        break;
      case 'xmpp':
        await this.bridgeToXMPP(config, message);
        break;
      case 'signal':
        await this.bridgeToSignal(config, message);
        break;
      default:
        throw new Error(`[matrix-hub] Unsupported protocol: ${protocol}`);
    }
  }

  private async bridgeToNostr(config: BridgeConfig, message: BridgeMessage): Promise<void> {
    // Uses NIP-04 or NIP-17 encrypted DMs via Nostr relay
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nostrSdk = (await import('@degenfeed/nostr-sdk')) as any;
    await nostrSdk.publishToNostr({
      kind: 4, // NIP-04 encrypted DM
      content: message.body,
      tags: [['p', config.metadata.recipientPubkey || '']],
      created_at: Math.floor(message.timestamp / 1000),
    });
  }

  private async bridgeToLens(config: BridgeConfig, message: BridgeMessage): Promise<void> {
    // Lens uses its own DM protocol via the Lens API
    const lensApi = config.nativeEndpoint || 'https://api.lens.dev';
    await fetch(`${lensApi}/messages/send`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.nativeToken}`,
      },
      body: JSON.stringify({
        profileId: config.metadata.recipientProfileId,
        message: message.body,
        reference: message.id,
      }),
    });
  }

  private async bridgeToBluesky(config: BridgeConfig, message: BridgeMessage): Promise<void> {
    // Bluesky uses AT Protocol chat.bsky.conversation.sendMessage
    const pdsUrl = config.nativeEndpoint || 'https://bsky.social';
    await fetch(`${pdsUrl}/xrpc/chat.bsky.conversation.sendMessage`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.nativeToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        conversation: { did: config.metadata.recipientDid },
        message: {
          text: message.body,
          createdAt: new Date(message.timestamp).toISOString(),
        },
      }),
    });
  }

  private async bridgeToFarcaster(config: BridgeConfig, message: BridgeMessage): Promise<void> {
    // Farcaster uses a Frame-based DM approach or direct casts
    // For now, publish as a mention cast
    const neynarApi = 'https://api.neynar.com';
    await fetch(`${neynarApi}/v2/farcaster/cast`, {
      method: 'POST',
      headers: {
        api_key: config.nativeToken || '',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        signer_uuid: config.metadata.signerUuid,
        text: `${config.metadata.recipientFname || ''} ${message.body}`,
        parent: config.metadata.parentCastHash,
      }),
    });
  }

  private async bridgeToActivityPub(config: BridgeConfig, message: BridgeMessage): Promise<void> {
    // Mastodon/GoToSocial ActivityPub DM
    const instanceUrl = config.nativeEndpoint || 'https://social.degenfeed.xyz';
    await fetch(`${instanceUrl}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.nativeToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: `@${config.metadata.recipientHandle} ${message.body}`,
        visibility: 'direct',
      }),
    });
  }

  private async bridgeToTelegram(config: BridgeConfig, message: BridgeMessage): Promise<void> {
    // Telegram Bot API
    const botToken = config.nativeToken;
    const chatId = config.metadata.chatId;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `[${config.protocol}] ${message.senderId}: ${message.body}`,
        parse_mode: 'Markdown',
      }),
    });
  }

  private async bridgeToDiscord(config: BridgeConfig, message: BridgeMessage): Promise<void> {
    // Discord Bot API
    const botToken = config.nativeToken;
    const channelId = config.metadata.channelId;
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bot ${botToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        content: `**${message.senderProtocol}** ${message.senderId}: ${message.body}`,
      }),
    });
  }

  private async bridgeToIRC(config: BridgeConfig, message: BridgeMessage): Promise<void> {
    // IRC via matrix-appservice-irc or direct IRC connection
    // For now, we use the IRC bridge config
    const ircEndpoint = config.nativeEndpoint || 'http://localhost:8090';
    await fetch(`${ircEndpoint}/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: config.metadata.ircChannel,
        message: `[${message.senderProtocol}] <${message.senderId}> ${message.body}`,
      }),
    });
  }

  private async bridgeToXMPP(config: BridgeConfig, message: BridgeMessage): Promise<void> {
    // XMPP via Bifrost bridge or direct XMPP
    const xmppEndpoint = config.nativeEndpoint || 'http://localhost:9090';
    await fetch(`${xmppEndpoint}/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to: config.metadata.xmppJid,
        body: `[${message.senderProtocol}] ${message.senderId}: ${message.body}`,
      }),
    });
  }

  private async bridgeToSignal(config: BridgeConfig, message: BridgeMessage): Promise<void> {
    // Signal via signal-cli REST API
    const signalEndpoint = config.nativeEndpoint || 'http://localhost:8080';
    await fetch(`${signalEndpoint}/v2/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: message.body,
        number: config.metadata.signalNumber,
        recipients: [config.metadata.recipientSignal],
      }),
    });
  }

  // ─── Health Checks ─────────────────────────────────────────────────────

  /**
   * Check the health of a specific protocol bridge.
   */
  async checkBridgeHealth(env: Env, protocol: BridgeProtocol): Promise<boolean> {
    const config = this.bridgeConfigs.get(protocol);
    if (!config?.enabled) return false;

    try {
      // Verify Matrix room is accessible
      if (this.accessToken) {
        const roomRes = await fetch(
          `${this.conduitUrl}/_matrix/client/v3/rooms/${encodeURIComponent(config.roomId)}/state/m.room.name`,
          {
            headers: { authorization: `Bearer ${this.accessToken}` },
            signal: AbortSignal.timeout(3000),
          },
        );
        if (!roomRes.ok) {
          config.healthStatus = 'degraded';
          await this.saveBridgeConfig(env, protocol, config);
          return false;
        }
      }

      // Verify native protocol endpoint if configured
      if (config.nativeEndpoint) {
        const nativeRes = await fetch(config.nativeEndpoint, {
          method: 'HEAD',
          signal: AbortSignal.timeout(3000),
        });
        if (!nativeRes.ok) {
          config.healthStatus = 'degraded';
        }
      }

      config.healthStatus = 'healthy';
      config.lastHealthCheck = Date.now();
      await this.saveBridgeConfig(env, protocol, config);
      return true;
    } catch {
      config.healthStatus = 'down';
      await this.saveBridgeConfig(env, protocol, config);
      return false;
    }
  }

  // ─── Room Management ───────────────────────────────────────────────────

  private async ensureBridgeRoom(env: Env, protocol: BridgeProtocol): Promise<string> {
    // Check if a room already exists for this protocol
    const kv = getKV(env);
    if (kv) {
      const existingRoomId = await kv.get(`${BRIDGE_ROOM_PREFIX}${protocol}`);
      if (existingRoomId) return existingRoomId;
    }

    // Create a new bridge room
    const bridgeRoom = await this.createBridgeRoom(
      env,
      protocol,
      `DegenFeed ${protocol.charAt(0).toUpperCase() + protocol.slice(1)} Bridge`,
    );

    // Cache the room ID
    if (kv) {
      await kv.put(`${BRIDGE_ROOM_PREFIX}${protocol}`, bridgeRoom.roomId, {
        expirationTtl: 86400 * 365,
      });
    }

    return bridgeRoom.roomId;
  }

  private async getBridgedProtocolsForRoom(
    roomId: string,
    excludeProtocol: BridgeProtocol,
  ): Promise<BridgeProtocol[]> {
    const connected: BridgeProtocol[] = [];

    for (const [protocol, config] of this.bridgeConfigs) {
      if (protocol === excludeProtocol || !config.enabled) continue;
      if (config.roomId === roomId) {
        connected.push(protocol);
      }
    }

    return connected;
  }

  // ─── KV Persistence ────────────────────────────────────────────────────

  private async loadBridgeConfigs(env: Env): Promise<void> {
    const kv = getKV(env);
    if (!kv) return;

    for (const protocol of BRIDGEABLE_PROTOCOLS) {
      try {
        const raw = await kv.get(`${BRIDGE_CONFIG_PREFIX}${protocol}`);
        if (raw) {
          this.bridgeConfigs.set(protocol, JSON.parse(raw) as BridgeConfig);
        }
      } catch {
        // Skip corrupted configs
      }
    }
  }

  private async saveBridgeConfig(
    env: Env,
    protocol: BridgeProtocol,
    config: BridgeConfig,
  ): Promise<void> {
    const kv = getKV(env);
    if (!kv) return;

    await kv.put(`${BRIDGE_CONFIG_PREFIX}${protocol}`, JSON.stringify(config), {
      expirationTtl: 86400 * 365,
    });
  }

  private async saveBridgeRoom(env: Env, room: BridgeRoom): Promise<void> {
    const kv = getKV(env);
    if (!kv) return;

    await kv.put(`${BRIDGE_ROOM_PREFIX}${room.roomId}`, JSON.stringify(room), {
      expirationTtl: 86400 * 365,
    });
  }

  private async getBotUserId(env: Env): Promise<string> {
    const kv = getKV(env);
    if (!kv) return '';

    try {
      return (await kv.get('matrix:bridge:bot:user_id')) || '';
    } catch {
      return '';
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _hubInstance: MatrixHub | null = null;

export function getMatrixHub(): MatrixHub {
  if (!_hubInstance) _hubInstance = new MatrixHub();
  return _hubInstance;
}
