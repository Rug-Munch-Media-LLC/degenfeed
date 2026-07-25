/**
 * @degenfeed/api-worker — Telegram Group Chat Bridge
 *
 * Bridges Telegram groups to DegenFeed social feeds:
 *   1. Subscribe — group messages appear in DegenFeed (opt-in by group owner)
 *   2. Cross-post — DegenFeed posts auto-publish to Telegram groups
 *   3. Creator coin chat — every creator coin gets an auto-created Telegram group
 *   4. Tipping — users tip each other in Telegram groups via Lightning
 *   5. Token-gated groups — require minimum coin holdings to join
 *
 * KV Keys:
 *   telegram:group:{groupId}                   — Group config
 *   telegram:group:feed:{groupId}:{msgId}      — Bridged message
 *   telegram:group:tip:{groupId}:{txId}        — Tip record
 *   telegram:coingroup:{symbol}                — Coin→Group mapping
 *   telegram:gatelist:{groupId}:{userId}       — Token gate verification
 */

import type { Env } from '../index';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TelegramGroupBridgeConfig {
  groupId: string;
  title: string;
  inviteLink?: string;
  /** Wallet of the group owner / creator */
  ownerWallet?: string;
  /** Associated creator coin symbol (if this is a coin community group) */
  coinSymbol?: string;
  /** Minimum tokens required to join (0 = no gate) */
  minHoldRequirement: string;
  /** Whether group messages are bridged to DegenFeed */
  feedEnabled: boolean;
  /** Whether DegenFeed posts auto-publish to this group */
  crossPostEnabled: boolean;
  /** Whether in-group tipping is enabled */
  tippingEnabled: boolean;
  /** Whether the group is token-gated */
  tokenGated: boolean;
  /** Last bridged message timestamp (for pagination) */
  lastBridgedAt: number;
  /** When the bridge was created */
  connectedAt: number;
}

export interface BridgedMessage {
  messageId: number;
  groupId: string;
  text: string;
  fromUser: string;
  fromWallet?: string;
  timestamp: number;
  bridgedToDegenFeed: boolean;
  degenFeedPostId?: string;
}

export interface GroupTipRecord {
  txId: string;
  groupId: string;
  fromWallet: string;
  toWallet: string;
  fromUsername: string;
  toUsername: string;
  amount: string;
  currency: 'BTC' | 'USD' | 'COIN';
  coinSymbol?: string;
  timestamp: number;
  lightningInvoice?: string;
  settled: boolean;
}

// ─── KV key helpers ─────────────────────────────────────────────────────────

function groupConfigKey(groupId: string): string {
  return `telegram:group:${groupId}`;
}

function bridgedMessageKey(groupId: string, messageId: number): string {
  return `telegram:group:feed:${groupId}:${messageId}`;
}

function groupFeedIndexKey(groupId: string): string {
  return `telegram:group:feed:${groupId}:index`;
}

function tipRecordKey(txId: string): string {
  return `telegram:group:tip:${txId}`;
}

function groupTipsIndexKey(groupId: string): string {
  return `telegram:group:tip:${groupId}:index`;
}

function coinGroupKey(symbol: string): string {
  return `telegram:coingroup:${symbol.toLowerCase()}`;
}

function gateKey(groupId: string, userId: number): string {
  return `telegram:gatelist:${groupId}:${userId}`;
}

function gateIndexKey(groupId: string): string {
  return `telegram:gatelist:${groupId}:index`;
}

// ─── Group Configuration ────────────────────────────────────────────────────

/**
 * Register a Telegram group bridge configuration.
 */
export async function registerGroupBridge(
  env: Env,
  config: TelegramGroupBridgeConfig,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const key = groupConfigKey(config.groupId);
    await env.CACHE?.put(key, JSON.stringify(config), {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    // If coin group, index it
    if (config.coinSymbol) {
      await env.CACHE?.put(coinGroupKey(config.coinSymbol), JSON.stringify(config), {
        expirationTtl: 60 * 60 * 24 * 365,
      });
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage failed' };
  }
}

/**
 * Get bridge config for a Telegram group.
 */
export async function getGroupBridgeConfig(
  env: Env,
  groupId: string,
): Promise<TelegramGroupBridgeConfig | null> {
  try {
    const raw = await env.CACHE?.get(groupConfigKey(groupId));
    if (!raw) return null;
    return JSON.parse(raw) as TelegramGroupBridgeConfig;
  } catch {
    return null;
  }
}

/**
 * Get coin group by symbol.
 */
export async function getCoinGroup(
  env: Env,
  symbol: string,
): Promise<TelegramGroupBridgeConfig | null> {
  try {
    const raw = await env.CACHE?.get(coinGroupKey(symbol));
    if (!raw) return null;
    return JSON.parse(raw) as TelegramGroupBridgeConfig;
  } catch {
    return null;
  }
}

/**
 * Update group bridge config partial fields.
 */
export async function updateGroupBridgeConfig(
  env: Env,
  groupId: string,
  updates: Partial<TelegramGroupBridgeConfig>,
): Promise<boolean> {
  try {
    const existing = await getGroupBridgeConfig(env, groupId);
    if (!existing) return false;
    const updated = { ...existing, ...updates };
    await env.CACHE?.put(groupConfigKey(groupId), JSON.stringify(updated), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * List all bridged groups (via owner wallet index).
 */
export async function listOwnerGroups(
  env: Env,
  wallet: string,
): Promise<TelegramGroupBridgeConfig[]> {
  // Scan groups — in production, use a dedicated index key
  try {
    const list = await env.CACHE?.list({ prefix: 'telegram:group:' });
    if (!list) return [];

    const groups: TelegramGroupBridgeConfig[] = [];
    for (const key of list.keys) {
      try {
        const raw = await env.CACHE?.get(key.name);
        if (raw) {
          const config = JSON.parse(raw) as TelegramGroupBridgeConfig;
          if (config.ownerWallet?.toLowerCase() === wallet.toLowerCase()) {
            groups.push(config);
          }
        }
      } catch {
        // skip corrupt entries
      }
    }
    return groups;
  } catch {
    return [];
  }
}

// ─── Message Bridging ───────────────────────────────────────────────────────

/**
 * Bridge a Telegram group message into DegenFeed.
 * Stores the message and optionally creates a DegenFeed post.
 */
export async function bridgeGroupMessage(
  env: Env,
  message: Omit<BridgedMessage, 'bridgedToDegenFeed' | 'degenFeedPostId'>,
): Promise<{ ok: boolean; messageId?: string }> {
  const groupId = message.groupId;

  try {
    // Check if bridge is enabled for this group
    const config = await getGroupBridgeConfig(env, groupId);
    if (!config?.feedEnabled) {
      return { ok: false };
    }

    // Store the bridged message
    const record: BridgedMessage = {
      ...message,
      bridgedToDegenFeed: true,
    };

    const msgKey = bridgedMessageKey(groupId, message.messageId);
    await env.CACHE?.put(msgKey, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 7, // 7 days retention
    });

    // Index in group's feed
    try {
      const indexKey = groupFeedIndexKey(groupId);
      const raw = (await env.CACHE?.get(indexKey)) ?? '[]';
      const index = JSON.parse(raw) as number[];
      index.push(message.messageId);
      // Keep last 500 messages indexed
      const trimmed = index.slice(-500);
      await env.CACHE?.put(indexKey, JSON.stringify(trimmed), {
        expirationTtl: 60 * 60 * 24 * 7,
      });
    } catch {
      // best-effort index
    }

    // Update last bridged timestamp
    await updateGroupBridgeConfig(env, groupId, {
      lastBridgedAt: message.timestamp,
    });

    // Return a synthetic DegenFeed post ID
    const postId = `tg:${groupId}:${message.messageId}`;
    return { ok: true, messageId: postId };
  } catch {
    return { ok: false };
  }
}

/**
 * Fetch recent bridged messages from a group.
 */
export async function getGroupFeed(
  env: Env,
  groupId: string,
  limit = 20,
): Promise<BridgedMessage[]> {
  try {
    const indexKey = groupFeedIndexKey(groupId);
    const raw = await env.CACHE?.get(indexKey);
    if (!raw) return [];

    const index = JSON.parse(raw) as number[];
    const recentIds = index.slice(-limit);

    const messages: BridgedMessage[] = [];
    for (const msgId of recentIds) {
      try {
        const msgRaw = await env.CACHE?.get(bridgedMessageKey(groupId, msgId));
        if (msgRaw) {
          messages.push(JSON.parse(msgRaw) as BridgedMessage);
        }
      } catch {
        // skip corrupt
      }
    }

    return messages;
  } catch {
    return [];
  }
}

// ─── Tipping ────────────────────────────────────────────────────────────────

/**
 * Record a tip sent within a Telegram group.
 */
export async function recordGroupTip(
  env: Env,
  tip: GroupTipRecord,
): Promise<{ ok: boolean; txId?: string }> {
  try {
    const config = await getGroupBridgeConfig(env, tip.groupId);
    if (!config?.tippingEnabled) {
      return { ok: false };
    }

    const key = tipRecordKey(tip.txId);
    await env.CACHE?.put(key, JSON.stringify(tip), {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    // Index
    try {
      const indexKey = groupTipsIndexKey(tip.groupId);
      const raw = (await env.CACHE?.get(indexKey)) ?? '[]';
      const index = JSON.parse(raw) as string[];
      index.push(tip.txId);
      await env.CACHE?.put(indexKey, JSON.stringify(index.slice(-200)), {
        expirationTtl: 60 * 60 * 24 * 365,
      });
    } catch {
      // best-effort
    }

    return { ok: true, txId: tip.txId };
  } catch {
    return { ok: false };
  }
}

/**
 * Get tip history for a group.
 */
export async function getGroupTips(
  env: Env,
  groupId: string,
  limit = 20,
): Promise<GroupTipRecord[]> {
  try {
    const indexKey = groupTipsIndexKey(groupId);
    const raw = await env.CACHE?.get(indexKey);
    if (!raw) return [];

    const index = JSON.parse(raw) as string[];
    const recentTxIds = index.slice(-limit);

    const tips: GroupTipRecord[] = [];
    for (const txId of recentTxIds) {
      try {
        const tipRaw = await env.CACHE?.get(tipRecordKey(txId));
        if (tipRaw) {
          tips.push(JSON.parse(tipRaw) as GroupTipRecord);
        }
      } catch {
        // skip
      }
    }

    return tips;
  } catch {
    return [];
  }
}

// ─── Cross-Posting ──────────────────────────────────────────────────────────

/**
 * Cross-post a DegenFeed post to a Telegram group.
 * Returns the Telegram message ID if successful.
 */
export async function crossPostToGroup(
  env: Env,
  botToken: string,
  groupId: string,
  text: string,
  options?: {
    parseMode?: 'HTML' | 'Markdown';
    linkPreview?: boolean;
    silent?: boolean;
  },
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  try {
    const config = await getGroupBridgeConfig(env, groupId);
    if (!config?.crossPostEnabled) {
      return { ok: false, error: 'Cross-posting disabled for this group' };
    }

    const payload: Record<string, unknown> = {
      chat_id: Number.parseInt(groupId, 10),
      text,
      parse_mode: options?.parseMode ?? 'HTML',
      disable_web_page_preview: !(options?.linkPreview ?? true),
      disable_notification: options?.silent ?? false,
    };

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `Telegram API: ${err.slice(0, 200)}` };
    }

    const data = (await res.json()) as { result?: { message_id?: number } };
    return { ok: true, messageId: data.result?.message_id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Cross-post a DegenFeed post to ALL groups owned by a wallet.
 */
export async function crossPostToAllGroups(
  env: Env,
  botToken: string,
  ownerWallet: string,
  text: string,
): Promise<Array<{ groupId: string; ok: boolean; messageId?: number; error?: string }>> {
  const groups = await listOwnerGroups(env, ownerWallet);
  const results = await Promise.all(
    groups
      .filter((g) => g.crossPostEnabled)
      .map(async (g) => {
        const result = await crossPostToGroup(env, botToken, g.groupId, text);
        return { groupId: g.groupId, ...result };
      }),
  );
  return results;
}

// ─── Token Gating ──────────────────────────────────────────────────────────

/**
 * Verify that a Telegram user meets the minimum token holding requirement
 * for a group.
 */
export async function verifyTokenGate(
  env: Env,
  groupId: string,
  userId: number,
  wallet: string,
): Promise<{
  passed: boolean;
  requirement?: string;
  balance?: string;
  error?: string;
}> {
  try {
    const config = await getGroupBridgeConfig(env, groupId);
    if (!config) {
      return { passed: false, error: 'Group not configured' };
    }

    if (
      !config.tokenGated ||
      !config.minHoldRequirement ||
      Number(config.minHoldRequirement) <= 0
    ) {
      // No gate requirement, always pass
      return { passed: true };
    }

    // Check wallet balance via RPC (placeholder — real implementation would
    // call the token contract or balance API)
    let balance = '0';
    if (config.coinSymbol) {
      try {
        const balanceRes = await fetch(
          `${env.RMI_BACKEND_URL ?? 'http://127.0.0.1:8000'}/api/coins/${config.coinSymbol}/balance/${wallet}`,
          {
            headers: {
              ...(env.RMI_API_KEY ? { Authorization: `Bearer ${env.RMI_API_KEY}` } : {}),
            },
          },
        );
        if (balanceRes.ok) {
          const data = (await balanceRes.json()) as { balance?: string };
          balance = data.balance ?? '0';
        }
      } catch {
        // fall through
      }
    }

    const meetsRequirement = Number(balance) >= Number(config.minHoldRequirement);

    if (meetsRequirement) {
      // Cache the gate pass
      await env.CACHE?.put(
        gateKey(groupId, userId),
        JSON.stringify({
          userId,
          wallet,
          verifiedAt: Date.now(),
          balance,
        }),
        { expirationTtl: 60 * 60 * 24 },
      ); // 24h cache
    }

    return {
      passed: meetsRequirement,
      requirement: config.minHoldRequirement,
      balance,
    };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : 'Gate verification failed',
    };
  }
}

/**
 * Check if a user has passed token gate verification for a group.
 */
export async function checkGateStatus(
  env: Env,
  groupId: string,
  userId: number,
): Promise<{ verified: boolean; verifiedAt?: number; balance?: string }> {
  try {
    const raw = await env.CACHE?.get(gateKey(groupId, userId));
    if (!raw) return { verified: false };

    const data = JSON.parse(raw) as { verifiedAt?: number; balance?: string };
    return { verified: true, verifiedAt: data.verifiedAt, balance: data.balance };
  } catch {
    return { verified: false };
  }
}

// ─── Creator Coin Group Auto-Creation ─────────────────────────────────────

/**
 * Generate configuration for a creator coin's Telegram community group.
 * This doesn't create the actual Telegram group (that requires user action),
 * but stores the mapping so /community commands work.
 */
export async function registerCoinCommunityGroup(
  env: Env,
  config: {
    coinSymbol: string;
    groupId: string;
    title: string;
    inviteLink: string;
    ownerWallet: string;
    minHoldRequirement?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const groupConfig: TelegramGroupBridgeConfig = {
      groupId: config.groupId,
      title: config.title,
      inviteLink: config.inviteLink,
      ownerWallet: config.ownerWallet,
      coinSymbol: config.coinSymbol,
      minHoldRequirement: config.minHoldRequirement ?? '0',
      feedEnabled: true,
      crossPostEnabled: true,
      tippingEnabled: true,
      tokenGated: Number(config.minHoldRequirement ?? 0) > 0,
      lastBridgedAt: 0,
      connectedAt: Date.now(),
    };

    // Store both by group ID and coin symbol
    await env.CACHE?.put(groupConfigKey(config.groupId), JSON.stringify(groupConfig), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    await env.CACHE?.put(coinGroupKey(config.coinSymbol), JSON.stringify(groupConfig), {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Storage failed' };
  }
}
