/**
 * @degenfeed/api-worker — Live Chat Analytics
 *
 * Real-time analytics for the unified cross-platform live chat:
 *   - Messages per minute (MPM)
 *   - Top chatters
 *   - Sentiment analysis (positive/negative/neutral ratios)
 *   - Platform breakdown (where viewers are chatting from)
 *   - Chat engagement rate
 *   - Peak concurrency per protocol
 */

import type { Env } from '../index';
import type { LiveChatMessage, ChatProtocol, ALL_PROTOCOLS } from './unified-chat';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ChatAnalyticsSnapshot {
  streamId: string;
  /** Messages per minute (rolling 5-min avg) */
  messagesPerMinute: number;
  /** Total messages in this session */
  totalMessages: number;
  /** Top chatters (userId → message count) */
  topChatters: Array<{ userId: string; displayName: string; count: number; protocol: string }>;
  /** Sentiment breakdown */
  sentiment: { positive: number; neutral: number; negative: number; total: number };
  /** Platform breakdown (protocol → message count) */
  platformBreakdown: Record<string, number>;
  /** Platform breakdown (protocol → viewer count) */
  viewerPlatformBreakdown: Record<string, number>;
  /** Engagement rate (chatters / viewers * 100) */
  engagementRate: number;
  /** Peak messages in any 1-minute window */
  peakMpm: number;
  /** Current viewer count */
  viewerCount: number;
  /** Active chatters (unique users in last 5 min) */
  activeChatters: number;
  /** Timestamp */
  timestamp: number;
}

interface SentimentScore {
  score: number; // -1 to 1
  label: 'positive' | 'neutral' | 'negative';
}

// ═══════════════════════════════════════════════════════════════════════════
// KV KEYS
// ═══════════════════════════════════════════════════════════════════════════

function analyticsKey(streamId: string): string {
  return `livechat:analytics:${streamId}`;
}

function mpmKey(streamId: string): string {
  return `livechat:mpm:${streamId}`;
}

function chattersKey(streamId: string): string {
  return `livechat:chatters:${streamId}`;
}

function peakKey(streamId: string): string {
  return `livechat:peak:${streamId}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS ENGINE
// ═══════════════════════════════════════════════════════════════════════════

const POSITIVE_WORDS = new Set([
  'love', 'amazing', 'great', 'awesome', 'based', 'gm', 'welcome', 'pog', 'fire',
  'bullish', 'moon', 'rocket', 'diamond', 'hands', 'beautiful', 'nice', 'wow',
  'incredible', 'legend', 'king', 'goat', 'best', 'perfect', 'huge', 'massive',
  'winning', 'chad', 'alpha', 'souls', 'wagmi', 'ser', 'banger', 'chefskiss',
]);

const NEGATIVE_WORDS = new Set([
  'rug', 'scam', 'bad', 'terrible', 'awful', 'shit', 'fuck', 'hate', 'worst',
  'dump', 'bearish', 'rekt', 'ngmi', 'cope', 'trash', 'garbage', 'horrible',
  'disaster', 'failure', 'pathetic', 'lolcow', 'ponzi', 'nuke', 'panic',
]);

// Simple lexicon-based sentiment analysis
function analyzeSentiment(text: string): SentimentScore {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  let score = 0;

  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, '');
    if (POSITIVE_WORDS.has(clean)) score += 0.15;
    if (NEGATIVE_WORDS.has(clean)) score -= 0.2;
  }

  // Emoji signals
  if (lower.includes('🚀') || lower.includes('🔥') || lower.includes('💎') || lower.includes('👑')) score += 0.1;
  if (lower.includes('💀') || lower.includes('🤡') || lower.includes('🗑️')) score -= 0.15;

  // Clamp
  score = Math.max(-1, Math.min(1, score));

  return {
    score,
    label: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral',
  };
}

/**
 * Track a new message for analytics.
 * Call this after each message is sent.
 */
export async function trackMessage(env: Env, msg: LiveChatMessage): Promise<void> {
  try {
    const streamId = msg.streamId;

    // Update MPM tracking (sliding window)
    const mpmKeyStr = mpmKey(streamId);
    const raw = await env.CACHE?.get(mpmKeyStr);
    const timestamps: number[] = raw ? JSON.parse(raw) : [];
    timestamps.push(msg.timestamp);
    // Keep only last 5 minutes
    const fiveMinAgo = Date.now() - 300000;
    const trimmed = timestamps.filter((t) => t > fiveMinAgo);
    await env.CACHE?.put(mpmKeyStr, JSON.stringify(trimmed), { expirationTtl: 600 });

    // Update chatter counts
    const chatterKey = chattersKey(streamId);
    const chatterRaw = await env.CACHE?.get(chatterKey);
    const chatters: Record<string, { count: number; displayName: string; protocol: string }> = chatterRaw ? JSON.parse(chatterRaw) : {};
    if (!chatters[msg.userId]) {
      chatters[msg.userId] = { count: 0, displayName: msg.displayName, protocol: msg.protocol };
    }
    chatters[msg.userId]!.count++;
    chatters[msg.userId]!.displayName = msg.displayName;
    await env.CACHE?.put(chatterKey, JSON.stringify(chatters), { expirationTtl: 86400 });

    // Track peak MPM
    const peakStr = await env.CACHE?.get(peakKey(streamId));
    const peak = peakStr ? JSON.parse(peakStr) as { mpm: number; timestamp: number } : { mpm: 0, timestamp: 0 };
    const currentMpm = Math.round((trimmed.length / 5) * 60); // normalize to per-minute
    if (currentMpm > peak.mpm) {
      await env.CACHE?.put(peakKey(streamId), JSON.stringify({ mpm: currentMpm, timestamp: msg.timestamp }), { expirationTtl: 86400 });
    }

    // Update aggregate analytics
    const aggRaw = await env.CACHE?.get(analyticsKey(streamId));
    const agg = aggRaw ? JSON.parse(aggRaw) as { totalMessages: number; positiveCount: number; negativeCount: number; neutralCount: number; protocolCounts: Record<string, number> } : { totalMessages: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0, protocolCounts: {} };
    agg.totalMessages++;
    const sentiment = analyzeSentiment(msg.message);
    if (sentiment.label === 'positive') agg.positiveCount++;
    else if (sentiment.label === 'negative') agg.negativeCount++;
    else agg.neutralCount++;
    agg.protocolCounts[msg.protocol] = (agg.protocolCounts[msg.protocol] || 0) + 1;
    await env.CACHE?.put(analyticsKey(streamId), JSON.stringify(agg), { expirationTtl: 86400 });

  } catch {
    // Non-critical
  }
}

/**
 * Get a full analytics snapshot for a stream.
 */
export async function getChatAnalytics(
  env: Env,
  streamId: string,
  viewerCount = 0,
): Promise<ChatAnalyticsSnapshot> {
  try {
    const mpmRaw = await env.CACHE?.get(mpmKey(streamId));
    const timestamps: number[] = mpmRaw ? JSON.parse(mpmRaw) : [];
    const fiveMinMs = 300000;
    const recentTimestamps = timestamps.filter((t) => Date.now() - t < fiveMinMs);
    const messagesPerMinute = recentTimestamps.length > 0
      ? Math.round((recentTimestamps.length / 5) * 60)
      : 0;

    const chatterRaw = await env.CACHE?.get(chattersKey(streamId));
    const chatters: Record<string, { count: number; displayName: string; protocol: string }> = chatterRaw ? JSON.parse(chatterRaw) : {};

    const topChatters = Object.entries(chatters)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 20)
      .map(([userId, data]) => ({
        userId,
        displayName: data.displayName,
        count: data.count,
        protocol: data.protocol,
      }));

    const aggRaw = await env.CACHE?.get(analyticsKey(streamId));
    const agg = aggRaw ? JSON.parse(aggRaw) as { totalMessages: number; positiveCount: number; negativeCount: number; neutralCount: number; protocolCounts: Record<string, number> } : { totalMessages: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0, protocolCounts: {} };

    const totalSentiment = agg.positiveCount + agg.negativeCount + agg.neutralCount;
    const sentiment = {
      positive: totalSentiment > 0 ? Math.round((agg.positiveCount / totalSentiment) * 100) : 0,
      neutral: totalSentiment > 0 ? Math.round((agg.neutralCount / totalSentiment) * 100) : 0,
      negative: totalSentiment > 0 ? Math.round((agg.negativeCount / totalSentiment) * 100) : 0,
      total: totalSentiment,
    };

    // Platform breakdown from viewer registrations
    const viewerPlatformBreakdown: Record<string, number> = {};
    for (const chatter of Object.values(chatters)) {
      viewerPlatformBreakdown[chatter.protocol] = (viewerPlatformBreakdown[chatter.protocol] || 0) + 1;
    }

    const peakRaw = await env.CACHE?.get(peakKey(streamId));
    const peak = peakRaw ? (JSON.parse(peakRaw) as { mpm: number; timestamp: number }) : { mpm: 0, timestamp: 0 };

    const activeChatterCount = Object.keys(chatters).length;
    const engagementRate = viewerCount > 0 ? Math.round((activeChatterCount / viewerCount) * 100) : 0;

    return {
      streamId,
      messagesPerMinute,
      totalMessages: agg.totalMessages,
      topChatters,
      sentiment,
      platformBreakdown: agg.protocolCounts,
      viewerPlatformBreakdown,
      engagementRate,
      peakMpm: peak.mpm,
      viewerCount,
      activeChatters: activeChatterCount,
      timestamp: Date.now(),
    };
  } catch {
    return {
      streamId,
      messagesPerMinute: 0,
      totalMessages: 0,
      topChatters: [],
      sentiment: { positive: 0, neutral: 0, negative: 0, total: 0 },
      platformBreakdown: {},
      viewerPlatformBreakdown: {},
      engagementRate: 0,
      peakMpm: 0,
      viewerCount: 0,
      activeChatters: 0,
      timestamp: Date.now(),
    };
  }
}

/**
 * Export chat messages for a stream as JSON.
 */
export async function exportChat(
  env: Env,
  streamId: string,
): Promise<{ messages: LiveChatMessage[]; meta: { total: number; exportedAt: number } }> {
  const { getChatMessages } = await import('./unified-chat');
  const messages = await getChatMessages(env, streamId, 10000);

  return {
    messages,
    meta: {
      total: messages.length,
      exportedAt: Date.now(),
    },
  };
}
