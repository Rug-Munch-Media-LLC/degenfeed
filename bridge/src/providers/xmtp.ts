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

// ─── Helpers ──────────────────────────────────────────────────────────

// ─── Mapping ──────────────────────────────────────────────────────────

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
  // console.log(`[bridge] XMTP: ${posts.length} gateway status`);
  return posts;
}

export const fetch = fetchXmtpPosts;
