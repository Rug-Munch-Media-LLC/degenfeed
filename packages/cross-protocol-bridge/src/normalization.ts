/**
 * @degenfeed/cross-protocol-bridge — Content Normalization
 *
 * Normalizes content from ANY protocol into the standard NormalizedContent
 * format. Handles hashtag translation, @mention resolution, and rich media
 * preservation across all protocol boundaries.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { NormalizedContent, NormalizedMedia, NormalizedMention } from './types';

// ─── Hashtag translation maps ────────────────────────────────────────────

/**
 * Map of protocol-specific hashtags to DegenFeed canonical niches.
 * This allows #Bitcoin on Nostr to match #BTC on Farcaster.
 */
const HASHTAG_TRANSLATIONS: Record<string, string[]> = {
  bitcoin: ['btc', 'bitcoin', 'satoshi', 'halving', 'sats'],
  ethereum: ['eth', 'ethereum', 'vitalik', 'pectra'],
  solana: ['sol', 'solana', 'spl'],
  defi: ['defi', 'liquidity', 'yield', 'farm', 'lp', 'compound', 'aave', 'uniswap'],
  nft: ['nft', 'art', 'collectible', 'punk', 'bored'],
  ai: ['ai', 'artificial', 'intelligence', 'llm', 'agent', 'machinelearning'],
  memecoin: ['meme', 'pepe', 'dog', 'shib', 'bonk', 'wif', 'doge'],
  layer2: ['layer2', 'l2', 'arbitrum', 'optimism', 'base', 'polygon', 'zksync'],
  security: ['security', 'hack', 'exploit', 'audit', 'scam', 'bug'],
  farcaster: ['farcaster', 'fid', 'warpcast', 'fc'],
  nostr: ['nostr', 'relay', 'nip', 'zap'],
  tech: ['rust', 'typescript', 'python', 'code', 'dev', 'opensource', 'github'],
};

/** Reverse map: known hashtag → canonical niche */
const HASHTAG_TO_NICHE = new Map<string, string>();
for (const [niche, tags] of Object.entries(HASHTAG_TRANSLATIONS)) {
  for (const tag of tags) {
    HASHTAG_TO_NICHE.set(tag, niche);
  }
}

/**
 * Translate a hashtag from any protocol to its canonical form.
 * e.g. #BTC on Farcaster → #bitcoin in the normalized output
 */
export function translateHashtag(tag: string): string {
  const normalized = tag.toLowerCase().replace(/^#/, '');
  const canonical = HASHTAG_TO_NICHE.get(normalized);
  return canonical ?? normalized;
}

/**
 * Extract and normalize hashtags from text content.
 */
export function extractHashtags(text: string): string[] {
  const regex = /(?:^|\s|[,.;:!?])#([\w\u00C0-\u017F][\w\u00C0-\u017F-]*)/g;
  const hashtags = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const tag = match[1].toLowerCase();
    if (tag.length > 0 && tag.length <= 50) {
      hashtags.add(translateHashtag(tag));
    }
  }

  return Array.from(hashtags);
}

// ─── @mention extraction and resolution ──────────────────────────────────

/**
 * Extract @mentions from text and attempt to resolve protocol.
 * Supports:
 *   - @user@instance.com (ActivityPub)
 *   @user (generic, resolved by context)
 *   - @user.bsky.social (Bluesky handle)
 *   - @fid:123 (Farcaster)
 *   - npub1... (Nostr bech32)
 *   - did:plc:... / did:pkh:... (AT Protocol / blockchain)
 */
export function extractMentions(text: string, contextProtocol?: Protocol): NormalizedMention[] {
  const mentions: NormalizedMention[] = [];
  const seen = new Set<string>();

  // Match @user@domain (ActivityPub / Fediverse)
  const apRegex = /@([\w.-]+@[\w.-]+)/g;
  let match: RegExpExecArray | null;

  while ((match = apRegex.exec(text)) !== null) {
    const raw = `@${match[1]}`;
    if (seen.has(raw)) continue;
    seen.add(raw);
    const [user, domain] = match[1].split('@');
    mentions.push({
      raw,
      protocol: domain === 'bsky.social' || domain === 'threads.net'
        ? (domain === 'threads.net' ? 'threads' as Protocol : 'bluesky' as Protocol)
        : 'mastodon' as Protocol,
      id: `${user}@${domain}`,
      handle: match[1],
    });
  }

  // Match @username (simple, context-dependent)
  const simpleRegex = /(?:^|\s)@([\w][\w.-]{0,30})(?:\s|$|[.,!?])/g;
  while ((match = simpleRegex.exec(text)) !== null) {
    const raw = `@${match[1]}`;
    if (seen.has(raw)) continue;
    seen.add(raw);
    const protocol = contextProtocol ?? 'nostr';
    mentions.push({
      raw,
      protocol: protocol as Protocol,
      id: raw,
      handle: match[1],
    });
  }

  // Match Nostr npub
  const npubRegex = /npub1[\w&&[^0OIl]]{58,60}/g;
  while ((match = npubRegex.exec(text)) !== null) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    mentions.push({
      raw: match[0],
      protocol: 'nostr',
      id: match[0],
      handle: match[0].slice(0, 12),
    });
  }

  // Match DIDs
  const didRegex = /did:(plc|pkh|web|key|ens):[\w.-]+/g;
  while ((match = didRegex.exec(text)) !== null) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    const didType = match[1];
    mentions.push({
      raw: match[0],
      protocol: didType === 'plc' ? 'bluesky' : 'ethereum' as Protocol,
      id: match[0],
      handle: match[0].slice(0, 20),
    });
  }

  return mentions;
}

// ─── Media extraction ────────────────────────────────────────────────────

/**
 * Extract rich media from a UnifiedPost's embeds.
 */
export function extractMedia(post: UnifiedPost): NormalizedMedia[] {
  const media: NormalizedMedia[] = [];

  for (const embed of post.embeds ?? []) {
    switch (embed.kind) {
      case 'image':
        media.push({
          kind: 'image',
          url: embed.url,
          alt: (embed.meta?.alt as string) ?? '',
          width: embed.meta?.width as number | undefined,
          height: embed.meta?.height as number | undefined,
          mimeType: embed.meta?.mimeType as string | undefined,
          meta: embed.meta,
        });
        break;
      case 'video':
        media.push({
          kind: 'video',
          url: embed.url,
          alt: (embed.meta?.alt as string) ?? '',
          width: embed.meta?.width as number | undefined,
          height: embed.meta?.height as number | undefined,
          mimeType: embed.meta?.mimeType as string | undefined,
          meta: embed.meta,
        });
        break;
      case 'link':
        // Only treat as media if it has a preview image
        if (embed.meta?.image) {
          media.push({
            kind: 'image',
            url: embed.meta.image as string,
            alt: (embed.meta?.title as string) ?? '',
            meta: embed.meta,
          });
        }
        break;
    }
  }

  return media;
}

/**
 * Extract URL links from embeds.
 */
export function extractLinks(post: UnifiedPost): string[] {
  const links: string[] = [];
  for (const embed of post.embeds ?? []) {
    if (embed.kind === 'link' && !embed.meta?.image) {
      links.push(embed.url);
    }
  }
  return links;
}

// ─── Main Normalization ──────────────────────────────────────────────────

/**
 * Normalize a UnifiedPost from ANY protocol into the standard
 * NormalizedContent format. Handles:
 *   - Text stripping (HTML → plain text)
 *   - Hashtag extraction and translation
 *   - @mention extraction with protocol detection
 *   - Media extraction (images, video, audio, GIF)
 *   - Link extraction
 */
export function normalizePost(post: UnifiedPost): NormalizedContent {
  // Strip HTML if present
  const text = post.html
    ? post.html.replace(/<[^>]*>/g, '').trim()
    : post.text?.trim() ?? '';

  const hashtags = extractHashtags(text);
  const mentions = extractMentions(text, post.protocol as Protocol);
  const media = extractMedia(post);
  const links = extractLinks(post);

  return {
    text,
    html: post.html,
    hashtags,
    mentions,
    media,
    links,
    sourceProtocol: post.protocol as Protocol,
    originalPost: post,
  };
}

/**
 * Normalize just the text portion, extracting hashtags and mentions.
 * Useful for quick normalization without a full UnifiedPost.
 */
export function normalizeText(
  text: string,
  contextProtocol?: Protocol,
): { text: string; hashtags: string[]; mentions: NormalizedMention[] } {
  const hashtags = extractHashtags(text);
  const mentions = extractMentions(text, contextProtocol);
  return { text: text.trim(), hashtags, mentions };
}

/**
 * Translate hashtags between protocols.
 * Returns a set of canonical hashtags that represent the same concept.
 */
export function translateHashtagsForProtocol(
  hashtags: string[],
  _targetProtocol: Protocol,
): string[] {
  // Produce the canonical representation (lowercase, no #)
  return hashtags.map((t) => translateHashtag(t));
}
