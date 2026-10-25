// ─── Unified post construction ────────────────────────────────────────

import type {
  Embed,
  EngagementMetrics,
  MediaAttachment,
  Protocol,
  UnifiedIdentity,
  UnifiedPost,
} from '@degenfeed/types';
import { detectNiches, extractEmbeds } from './relevance';

function dedupeKey(protocol: Protocol, nativeId: string): string {
  return `${protocol}:${nativeId}`;
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
  /** Media attachments (images/videos/audio). Defaults to a derivation
   * from `embeds` image/video entries so every provider gets a stable
   * `media` array even when it only populates embeds. */
  media?: MediaAttachment[];
  parentNativeId?: string;
  rootNativeId?: string;
  createdAt: number;
  metrics?: Partial<EngagementMetrics>;
  viewer?: { liked?: boolean; reposted?: boolean; bookmarked?: boolean };
  raw: unknown;
}): UnifiedPost {
  const metrics = { ...emptyMetrics(), ...args.metrics };
  const embeds = args.embeds ?? extractEmbeds(args.text);
  const media = args.media ?? mediaFromEmbeds(embeds);
  return {
    id: dedupeKey(args.protocol, args.nativeId),
    protocol: args.protocol,
    author: args.author,
    text: args.text,
    html: args.html,
    embeds,
    media: media.length > 0 ? media : undefined,
    parentId: args.parentNativeId ? dedupeKey(args.protocol, args.parentNativeId) : undefined,
    rootId: args.rootNativeId ? dedupeKey(args.protocol, args.rootNativeId) : undefined,
    createdAt: args.createdAt,
    metrics,
    engagement: {
      viewerLiked: args.viewer?.liked ?? false,
      viewerReposted: args.viewer?.reposted ?? false,
      viewerBookmarked: args.viewer?.bookmarked ?? false,
      raw: metrics,
    },
    raw: args.raw,
    niches: detectNiches(args.text),
  };
}

/**
 * Derive media attachments from embed entries (image/video/audio kinds).
 * Used by buildUnifiedPost as the default `media` and by the worker
 * sanitize/normalization layer as a safety net for providers that only
 * populate embeds.
 */
export function mediaFromEmbeds(embeds: Embed[] | undefined | null): MediaAttachment[] {
  if (!embeds) return [];
  const media: MediaAttachment[] = [];
  const seen = new Set<string>();
  for (const e of embeds) {
    if (e.kind === 'image' || e.kind === 'video' || e.kind === 'audio' || e.kind === 'frame') {
      if (!e.url || seen.has(e.url)) continue;
      seen.add(e.url);
      const type =
        e.kind === 'image'
          ? 'image'
          : e.kind === 'video'
            ? 'video'
            : e.kind === 'audio'
              ? 'audio'
              : 'image';
      const meta = (e.meta ?? {}) as Record<string, unknown>;
      media.push({
        type,
        url: e.url,
        width: typeof meta.width === 'number' ? meta.width : undefined,
        height: typeof meta.height === 'number' ? meta.height : undefined,
        alt: typeof meta.alt === 'string' ? meta.alt : undefined,
      });
    }
  }
  return media;
}

// ─── Cross-Protocol Threading ───────────────────────────────────────────
