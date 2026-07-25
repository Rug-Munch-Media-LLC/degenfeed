/**
 * cross-platform-dedup — Cross-protocol post mapping engine.
 *
 * Maps the same post across protocols:
 *   - Nostr note ↔ Farcaster cast (same author, same time, similar text)
 *   - Bluesky post ↔ Mastodon toot (cross-posted)
 *   - RSS article ↔ Reddit post (same URL)
 *   - YouTube video ↔ PeerTube mirror (same content)
 *   - Lens post ↔ any ActivityPub
 *
 * Uses content fingerprinting, cross-poster detection, and identity
 * resolution to connect the same content across protocols.
 *
 * This module integrates with GlobalDedupRegistry for storage,
 * but adds higher-level cross-platform inference logic.
 */

import type { UnifiedPost } from '@degenfeed/types';
import type { GlobalDedupRegistry } from './global-dedup';

// ─── Types ────────────────────────────────────────────────────────────────

export interface CrossPlatformLink {
  /** Source protocol + native ID */
  source: { protocol: string; id: string; uri?: string };
  /** Target protocol + native ID */
  target: { protocol: string; id: string; uri?: string };
  /** How the link was established */
  method: CrossLinkMethod;
  /** Confidence score 0-1 */
  confidence: number;
  /** When the link was established */
  linkedAt: number;
  /** Whether this link has been verified */
  verified: boolean;
  /** Evidence supporting this link */
  evidence: string[];
  /** Matched text content (populated during analysis) */
  matchedText?: string;
  /** Matched author ID */
  matchedAuthorId?: string;
  /** Matched author name */
  matchedAuthorName?: string;
  /** Matched creation timestamp */
  matchedCreatedAt?: number;
  /** Matched engagement score */
  matchedEngagement?: number;
}

export type CrossLinkMethod =
  | 'same-author-content'
  | 'same-url'
  | 'cross-poster'
  | 'bridge'
  | 'identity-link'
  | 'similar-content'
  | 'embed-match'
  | 'manual';

export interface CrossPlatformPostGroup {
  /** Stable group ID */
  groupId: string;
  /** All posts in this group (across protocols) */
  posts: Array<{
    protocol: string;
    id: string;
    uri?: string;
    text: string;
    authorId: string;
    authorName: string;
    createdAt: number;
    engagement: number;
    /** Whether this is the canonical/original version */
    isOriginal: boolean;
  }>;
  /** Which protocols are represented */
  protocols: string[];
  /** Links between posts */
  links: CrossPlatformLink[];
  /** The best version (highest engagement, most complete) */
  canonicalPost: { protocol: string; id: string } | null;
  /** Group-level score for ranking */
  groupScore: number;
}

// ─── Cross-Platform Detection Logic ──────────────────────────────────────

const CROSS_POST_HEADERS = [
  /^cross.?post(?:ed)?:?/i,
  /^also (?:posted|shared|published) (?:on|to):?/i,
  /^re.?post(?:ed)? (?:from|via):?/i,
  /^syndicated (?:from|to):?/i,
  /^mirror(?:ed)? (?:from|to):?/i,
  /^\[cross.?post\]/i,
  /^📢/i,
  /^♻️/i,
];

// Protocol bridge pairs we know about
const KNOWN_BRIDGES: Array<{ from: string; to: string; name: string }> = [
  { from: 'nostr', to: 'farcaster', name: 'Nostr-Farcaster Bridge' },
  { from: 'farcaster', to: 'nostr', name: 'Nostr-Farcaster Bridge' },
  { from: 'bluesky', to: 'mastodon', name: 'Bridgy Fed' },
  { from: 'mastodon', to: 'bluesky', name: 'Bridgy Fed' },
  { from: 'bluesky', to: 'nostr', name: 'Bluesky-Nostr Bridge' },
  { from: 'nostr', to: 'bluesky', name: 'Bluesky-Nostr Bridge' },
  { from: 'rss', to: 'nostr', name: 'RSS-Nostr Bridge' },
  { from: 'rss', to: 'farcaster', name: 'RSS-Farcaster Bridge' },
  { from: 'reddit', to: 'lemmy', name: 'Reddit-Lemmy Repost' },
  { from: 'lemmy', to: 'reddit', name: 'Reddit-Lemmy Repost' },
  { from: 'youtube', to: 'peertube', name: 'YouTube-PeerTube Mirror' },
  { from: 'peertube', to: 'youtube', name: 'YouTube-PeerTube Mirror' },
  { from: 'rss', to: 'reddit', name: 'RSS-Reddit Crosspost' },
  { from: 'reddit', to: 'rss', name: 'RSS-Reddit Crosspost' },
];

// ─── Text Similarity Helpers ─────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordSet(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const smaller = a.size < b.size ? a : b;
  const larger = a.size < b.size ? b : a;
  for (const w of smaller) {
    if (larger.has(w)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

// ─── Cross-Platform Link Detection Engine ────────────────────────────────

export class CrossPlatformDedup {
  private groups: Map<string, CrossPlatformPostGroup>;

  constructor(dedupRegistry: GlobalDedupRegistry) {
    this.dedupRegistry = dedupRegistry;
    this.groups = new Map();
  }

  /**
   * Analyze a set of posts for cross-platform duplicates.
   * Returns groups of equivalent posts across protocols.
   */
  async analyzePosts(posts: UnifiedPost[]): Promise<CrossPlatformPostGroup[]> {
    const groups: CrossPlatformPostGroup[] = [];
    const processed = new Set<string>();

    for (const post of posts) {
      const postKey = `${post.protocol}:${post.id}`;
      if (processed.has(postKey)) continue;
      processed.add(postKey);

      // Find all cross-platform matches for this post
      const matches = await this.findCrossPlatformMatches(post, posts);
      if (matches.length === 0) {
        // Solo post — create single-post group
        groups.push(this.createSoloGroup(post));
        continue;
      }

      // Create group from matches
      const groupId = `xgroup:${post.protocol}:${post.id}`;
      const groupPosts = [
        {
          protocol: post.protocol,
          id: post.id,
          text: post.text,
          authorId: post.author.id,
          authorName: post.author.displayName,
          createdAt: post.createdAt,
          engagement: post.metrics.likes + post.metrics.reposts * 2 + post.metrics.replies * 3,
          isOriginal: true,
        },
        ...matches.map((m) => ({
          protocol: m.target.protocol,
          id: m.target.id,
          text: m.matchedText ?? '',
          authorId: m.matchedAuthorId ?? '',
          authorName: m.matchedAuthorName ?? '',
          createdAt: m.matchedCreatedAt ?? 0,
          engagement: m.matchedEngagement ?? 0,
          isOriginal: false,
        })),
      ];

      // Mark all matched posts as processed
      for (const m of matches) {
        processed.add(`${m.target.protocol}:${m.target.id}`);
      }

      // Find the best (canonical) version
      groupPosts.sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0));
      const bestPost = groupPosts[0];

      const group: CrossPlatformPostGroup = {
        groupId,
        posts: groupPosts as CrossPlatformPostGroup['posts'],
        protocols: [...new Set(groupPosts.map((p) => p.protocol))],
        links: matches,
        canonicalPost: bestPost ? { protocol: bestPost.protocol, id: bestPost.id } : null,
        groupScore: groupPosts.reduce((sum, p) => sum + (p.engagement ?? 0), 0) / groupPosts.length,
      };

      groups.push(group);
      this.groups.set(groupId, group);
    }

    return groups;
  }

  /**
   * Find cross-platform matches for a single post within a set of posts.
   */
  private async findCrossPlatformMatches(
    post: UnifiedPost,
    allPosts: UnifiedPost[],
  ): Promise<CrossPlatformLink[]> {
    const matches: CrossPlatformLink[] = [];
    const text = post.text || '';
    const urls = extractUrls(text);
    const embedUrls = post.embeds
      .filter((e) => e.kind === 'link' || e.kind === 'image')
      .map((e) => e.url);
    const now = Date.now();

    for (const other of allPosts) {
      if (other.protocol === post.protocol && other.id === post.id) continue;
      if (other.protocol === post.protocol && post.id !== other.id) {
        // Same protocol but different ID — only match if it's a known bridge
        continue;
      }

      const otherText = other.text || '';
      const otherUrls = extractUrls(otherText);

      const otherEngagement =
        (other.metrics.likes ?? 0) +
        (other.metrics.reposts ?? 0) * 2 +
        (other.metrics.replies ?? 0) * 3;

      // ── Method 1: Same URL across protocols ──
      const commonUrls = urls.filter((u) => otherUrls.includes(u));
      if (commonUrls.length > 0) {
        matches.push({
          source: { protocol: post.protocol, id: post.id },
          target: { protocol: other.protocol, id: other.id },
          method: 'same-url',
          confidence: 0.95,
          linkedAt: now,
          verified: true,
          evidence: [`Shared URL: ${commonUrls[0]}`],
          matchedText: otherText,
          matchedAuthorId: other.author.id,
          matchedAuthorName: other.author.displayName,
          matchedCreatedAt: other.createdAt,
          matchedEngagement: otherEngagement,
        });
        continue;
      }

      // ── Method 2: Similar content (Jaccard) + time proximity ──
      const postWords = wordSet(text);
      const otherWords = wordSet(otherText);
      if (postWords.size >= 5 && otherWords.size >= 5) {
        const sim = jaccardSimilarity(postWords, otherWords);
        const timeDiff = Math.abs(post.createdAt - other.createdAt);
        const sameAuthor = post.author.id === other.author.id;

        if (sim >= 0.75 && (sameAuthor || timeDiff < 3600000)) {
          matches.push({
            source: { protocol: post.protocol, id: post.id },
            target: { protocol: other.protocol, id: other.id },
            method: sameAuthor ? 'same-author-content' : 'similar-content',
            confidence: sameAuthor ? 0.9 : 0.7,
            linkedAt: now,
            verified: sameAuthor,
            evidence: [
              `Content similarity: ${(sim * 100).toFixed(0)}%`,
              sameAuthor ? 'Same author' : `Time proximity: ${(timeDiff / 60000).toFixed(0)}min`,
            ],
            matchedText: otherText,
            matchedAuthorId: other.author.id,
            matchedAuthorName: other.author.displayName,
            matchedCreatedAt: other.createdAt,
            matchedEngagement: otherEngagement,
          });
          continue;
        }
      }

      // ── Method 3: Cross-poster header detection ──
      if (CROSS_POST_HEADERS.some((h) => h.test(text))) {
        // The post text contains a cross-post header pointing to the other protocol
        matches.push({
          source: { protocol: post.protocol, id: post.id },
          target: { protocol: other.protocol, id: other.id },
          method: 'cross-poster',
          confidence: 0.85,
          linkedAt: now,
          verified: true,
          evidence: ['Cross-post header detected'],
          matchedText: otherText,
          matchedAuthorId: other.author.id,
          matchedAuthorName: other.author.displayName,
          matchedCreatedAt: other.createdAt,
          matchedEngagement: otherEngagement,
        });
        continue;
      }

      // ── Method 4: Known bridge pair ──
      const isBridged = KNOWN_BRIDGES.some(
        (b) => b.from === post.protocol && b.to === other.protocol,
      );
      if (isBridged && urls.length > 0) {
        // Check if content appears to be bridged (same URL shared in both)
        if (otherUrls.some((u) => urls.includes(u))) {
          matches.push({
            source: { protocol: post.protocol, id: post.id },
            target: { protocol: other.protocol, id: other.id },
            method: 'bridge',
            confidence: 0.8,
            linkedAt: now,
            verified: false,
            evidence: [`Content bridged between ${post.protocol} and ${other.protocol}`],
            matchedText: otherText,
            matchedAuthorId: other.author.id,
            matchedAuthorName: other.author.displayName,
            matchedCreatedAt: other.createdAt,
            matchedEngagement: otherEngagement,
          });
          continue;
        }
      }

      // ── Method 5: Embed match (same embedded URL) ──
      if (embedUrls.length > 0) {
        const otherEmbedUrls = other.embeds
          .filter((e) => e.kind === 'link' || e.kind === 'image')
          .map((e) => e.url);
        const commonEmbeds = embedUrls.filter((u) => otherEmbedUrls.includes(u));
        if (commonEmbeds.length > 0) {
          matches.push({
            source: { protocol: post.protocol, id: post.id },
            target: { protocol: other.protocol, id: other.id },
            method: 'embed-match',
            confidence: 0.85,
            linkedAt: now,
            verified: true,
            evidence: [`Shared embed: ${commonEmbeds[0]}`],
            matchedText: otherText,
            matchedAuthorId: other.author.id,
            matchedAuthorName: other.author.displayName,
            matchedCreatedAt: other.createdAt,
            matchedEngagement: otherEngagement,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Create a solo group (no cross-platform matches) for a single post.
   */
  private createSoloGroup(post: UnifiedPost): CrossPlatformPostGroup {
    return {
      groupId: `xgroup:solo:${post.protocol}:${post.id}`,
      posts: [
        {
          protocol: post.protocol,
          id: post.id,
          text: post.text,
          authorId: post.author.id,
          authorName: post.author.displayName,
          createdAt: post.createdAt,
          engagement: post.metrics.likes + post.metrics.reposts * 2 + post.metrics.replies * 3,
          isOriginal: true,
        },
      ],
      protocols: [post.protocol],
      links: [],
      canonicalPost: { protocol: post.protocol, id: post.id },
      groupScore: 0,
    };
  }

  /**
   * Deduplicate a set of posts, keeping only the canonical version.
   * Returns posts with cross-protocol metadata attached.
   */
  async deduplicateAcrossProtocols(posts: UnifiedPost[]): Promise<{
    posts: UnifiedPost[];
    dedupedCount: number;
    groups: CrossPlatformPostGroup[];
    links: CrossPlatformLink[];
  }> {
    const groups = await this.analyzePosts(posts);
    const allLinks: CrossPlatformLink[] = [];
    const keptPostIds = new Set<string>();

    for (const group of groups) {
      if (group.posts.length === 1) {
        // Solo post — keep it
        keptPostIds.add(`${group.posts[0]?.protocol}:${group.posts[0]?.id}`);
        continue;
      }

      // Multi-post group — keep canonical, add metadata to it
      allLinks.push(...group.links);

      if (group.canonicalPost) {
        const canonicalKey = `${group.canonicalPost.protocol}:${group.canonicalPost.id}`;
        keptPostIds.add(canonicalKey);

        // Attach "also posted on" metadata
        const otherProtocols = group.posts
          .filter((p) => `${p.protocol}:${p.id}` !== canonicalKey)
          .map((p) => p.protocol);
        const canonicalPost = posts.find(
          (p) => p.protocol === group.canonicalPost?.protocol && p.id === group.canonicalPost?.id,
        );
        if (canonicalPost) {
          (canonicalPost as unknown as Record<string, unknown>).crossPostedTo = otherProtocols;
          (canonicalPost as unknown as Record<string, unknown>).crossPlatformGroupId =
            group.groupId;
        }
      }
    }

    const dedupedPosts = posts.filter((p) => keptPostIds.has(`${p.protocol}:${p.id}`));

    return {
      posts: dedupedPosts,
      dedupedCount: posts.length - dedupedPosts.length,
      groups,
      links: allLinks,
    };
  }

  /**
   * Manually register a cross-platform link.
   */
  registerLink(link: CrossPlatformLink): void {
    const groupId = `xgroup:${link.source.protocol}:${link.source.id}`;
    let group = this.groups.get(groupId);

    if (!group) {
      group = {
        groupId,
        posts: [
          {
            protocol: link.source.protocol,
            id: link.source.id,
            text: '',
            authorId: '',
            authorName: '',
            createdAt: 0,
            engagement: 0,
            isOriginal: true,
          },
        ],
        protocols: [link.source.protocol],
        links: [],
        canonicalPost: { protocol: link.source.protocol, id: link.source.id },
        groupScore: 0,
      };
      this.groups.set(groupId, group);
    }

    group.links.push(link);
    if (!group.protocols.includes(link.target.protocol)) {
      group.protocols.push(link.target.protocol);
    }
    group.posts.push({
      protocol: link.target.protocol,
      id: link.target.id,
      text: '',
      authorId: '',
      authorName: '',
      createdAt: 0,
      engagement: 0,
      isOriginal: false,
    });
  }

  /**
   * Get a cross-platform post group by ID.
   */
  getGroup(groupId: string): CrossPlatformPostGroup | undefined {
    return this.groups.get(groupId);
  }

  /**
   * Clear all groups.
   */
  clear(): void {
    this.groups.clear();
  }
}

// ─── URL Extraction ───────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"]+/g;
  return (text.match(urlRegex) ?? []).map((u) => {
    try {
      const url = new URL(u);
      return url.origin + url.pathname.replace(/\/$/, '');
    } catch {
      return u.replace(/\/$/, '').split('?')[0] ?? u;
    }
  });
}
