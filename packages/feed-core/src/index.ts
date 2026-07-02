import type { Embed, EngagementMetrics, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

/**
 * Extract embeds from text content. URLs become link embeds.
 * Protocol-native embeds (images, frames) are passed through.
 */
export function extractEmbeds(text: string, native: unknown[] = []): Embed[] {
  const urlRe = /https?:\/\/[^\s<>"']+/gi;
  const urls = text.match(urlRe) ?? [];
  const linkEmbeds: Embed[] = urls.map((u) => ({ kind: 'link', url: u }));
  // Native embeds are passed by the normalizer when known.
  const passed = native as Embed[];
  return [...linkEmbeds, ...passed];
}

/**
 * Best-effort niche detection from text. Matches known keywords.
 * Returns lowercased tags. Empty array if no matches.
 */
export function detectNiches(text: string): string[] {
  const t = text.toLowerCase();
  const map: Record<string, string[]> = {
    crypto: ['btc', 'eth', 'crypto', 'defi', 'nft', 'token', 'web3', 'solana', 'base', 'bitcoin', 'ethereum'],
    ai: ['ai', 'gpt', 'llm', 'claude', 'gemini', 'agent', 'ml', 'neural', 'rag'],
    oss: ['open source', 'github', 'mit', 'apache', 'repo', 'foss', 'gpl'],
    security: ['sec', 'exploit', 'vuln', 'cve', 'hack', 'audit', 'bug bounty'],
    art: ['art', 'illustration', 'design', 'photo', 'drawing'],
    music: ['music', 'song', 'album', 'spotify', 'soundcloud'],
  };
  const found = new Set<string>();
  for (const [niche, words] of Object.entries(map)) {
    if (words.some((w) => t.includes(w))) {
      found.add(niche);
    }
  }
  return Array.from(found);
}

/** Stable dedupe key across protocols for the same logical post. */
export function dedupeKey(protocol: Protocol, nativeId: string): string {
  return `${protocol}:${nativeId}`;
}

export function emptyIdentity(): UnifiedIdentity {
  return {
    id: '',
    primary: { protocol: 'nostr', id: '' },
    handles: { nostr: null, farcaster: null, lens: null, bluesky: null },
    displayName: '',
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  };
}

export function emptyMetrics(): EngagementMetrics {
  return { likes: 0, reposts: 0, replies: 0, quotes: 0 };
}

export function buildUnifiedPost(args: {
  protocol: Protocol;
  nativeId: string;
  author: UnifiedIdentity;
  text: string;
  html?: string;
  embeds?: Embed[];
  parentNativeId?: string;
  rootNativeId?: string;
  createdAt: number;
  metrics?: Partial<EngagementMetrics>;
  viewer?: { liked?: boolean; reposted?: boolean };
  raw: unknown;
}): UnifiedPost {
  const metrics = { ...emptyMetrics(), ...args.metrics };
  return {
    id: dedupeKey(args.protocol, args.nativeId),
    protocol: args.protocol,
    author: args.author,
    text: args.text,
    html: args.html,
    embeds: args.embeds ?? extractEmbeds(args.text),
    parentId: args.parentNativeId ? dedupeKey(args.protocol, args.parentNativeId) : undefined,
    rootId: args.rootNativeId ? dedupeKey(args.protocol, args.rootNativeId) : undefined,
    createdAt: args.createdAt,
    metrics,
    engagement: {
      viewerLiked: args.viewer?.liked ?? false,
      viewerReposted: args.viewer?.reposted ?? false,
      raw: metrics,
    },
    raw: args.raw,
    niches: detectNiches(args.text),
  };
}