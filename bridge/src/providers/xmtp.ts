/**
 * XMTP Provider
 *
 * XMTP is a decentralized messaging protocol for secure, end-to-end
 * encrypted communication between blockchain identities.
 *
 * For the bridge, we monitor XMTP conversations for public topics and
 * integrate as a gateway service for DegenFeed users.
 *
 * Architecture:
 * - XMTP Gateway Service (self-hosted) for sending
 * - XMTP nodes (public) for receiving/conversation monitoring
 * - Connect-RPC / gRPC for node communication
 * - MLS (Messaging Layer Security) for group chats
 *
 * Since XMTP is primarily private messaging, we:
 * 1. Track public conversation topics
 * 2. Serve as a gateway for DegenFeed users to receive XMTP messages
 * 3. Bridge XMTP conversations to other protocols
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

const XMTP_GATEWAY = process.env.XMTP_GATEWAY_URL || 'http://127.0.0.1:5050';
const XMTP_NETWORK = process.env.XMTP_NETWORK || 'testnet';

// ─── Types ─────────────────────────────────────────────────────────────

interface XMTPConversation {
  topic: string;
  created_at: string;
  last_message_at?: string;
  peer_address: string;
  context?: string;
  wallet_address?: string;
  environment?: string;
}

interface XMTPMessage {
  id: string;
  topic: string;
  content: string;
  sender_address: string;
  sent_at: string;
  content_type?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessXmtpNiches(text: string): string[] {
  const lower = text.toLowerCase();
  const n: string[] = [];
  if (/\b(crypto|web3|blockchain|bitcoin|eth|sol)\b/.test(lower)) n.push('crypto');
  if (/\b(xmtp|messaging|encrypted|private|secure)\b/.test(lower)) n.push('privacy');
  if (/\b(dao|community|group|chat|discussion)\b/.test(lower)) n.push('community');
  if (/\b(gm|hello|hi|welcome|intro)\b/.test(lower)) n.push('social');
  if (n.length === 0) n.push('messaging');
  return n;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function _xmtpMessageToPost(msg: XMTPMessage): UnifiedPost {
  const text = msg.content?.slice(0, 2000) || '';
  return {
    id: `xmtp:${msg.id}`,
    protocol: 'xmtp',
    author: {
      id: `xmtp:${msg.sender_address}`,
      primary: { protocol: 'xmtp', id: msg.sender_address },
      handles: { xmtp: msg.sender_address?.slice(0, 10) },
      displayName: `${msg.sender_address?.slice(0, 6)}...${msg.sender_address?.slice(-4)}`,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: [
      { kind: 'link', url: `https://xmtp.org/chat/${msg.topic}`, meta: { topic: msg.topic } },
    ],
    contentType: 'message',
    createdAt: new Date(msg.sent_at).getTime(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: msg,
    niches: guessXmtpNiches(text),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchGatewayStatus(): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(`${XMTP_GATEWAY}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];

    // Return gateway info as a status update
    return [
      {
        id: `xmtp:gateway:${Date.now()}`,
        protocol: 'xmtp',
        author: {
          id: 'xmtp:gateway',
          primary: { protocol: 'xmtp', id: 'gateway' },
          handles: { xmtp: 'gateway' },
          displayName: 'XMTP Gateway',
          bio: 'XMTP messaging gateway for DegenFeed',
          avatarUrl: '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text: `🔐 XMTP Gateway active on ${XMTP_NETWORK}. Secure decentralized messaging ready.`,
        embeds: [],
        contentType: 'status',
        createdAt: Date.now(),
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: { network: XMTP_NETWORK, gateway: XMTP_GATEWAY },
        niches: ['messaging', 'web3'],
      },
    ];
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'xmtp',
  name: 'XMTP',
  description: 'Decentralized Web3 messaging protocol — MLS encrypted',
  endpoint: '/api/feed/xmtp',
  requiresAuth: true,
  authEnvVar: 'XMTP_PAYER_KEY',
  contentType: 'message',
};

export async function fetchXmtpPosts(_limit = 20): Promise<UnifiedPost[]> {
  const posts = await fetchGatewayStatus();
  console.log(`[bridge] XMTP: ${posts.length} gateway status`);
  return posts;
}

export const fetch = fetchXmtpPosts;
