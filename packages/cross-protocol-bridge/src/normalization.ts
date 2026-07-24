import type { Protocol, UnifiedPost } from '@degenfeed/types';
import type { NormalizedContent, NormalizedMedia, NormalizedMention } from './types';

const H: Record<string, string[]> = {
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

const NICHE_MAP = new Map<string, string>();
for (const [niche, tags] of Object.entries(H)) {
  for (const tag of tags) NICHE_MAP.set(tag, niche);
}

export function translateHashtag(tag: string): string {
  return NICHE_MAP.get(tag.toLowerCase().replace(/^#/, '')) ?? tag.toLowerCase().replace(/^#/, '');
}

function matchAll(re: RegExp, text: string): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    results.push(m);
  }
  return results;
}

export function extractHashtags(text: string): string[] {
  const s = new Set<string>();
  for (const m of matchAll(/(?:^|\s|[,.;:!?])#([\w\u00C0-\u017F][\w\u00C0-\u017F-]*)/g, text)) {
    const tag = (m[1] ?? '').toLowerCase();
    if (tag.length > 0 && tag.length <= 50) s.add(translateHashtag(tag));
  }
  return [...s];
}

export function extractMentions(text: string, contextProtocol?: Protocol): NormalizedMention[] {
  const mentions: NormalizedMention[] = [];
  const seen = new Set<string>();

  for (const m of matchAll(/@([\w.-]+@[\w.-]+)/g, text)) {
    const raw = `@${m[1] ?? ''}`;
    if (seen.has(raw)) continue;
    seen.add(raw);
    const user = m[1] ?? '';
    const atIdx = user.indexOf('@');
    const domain = atIdx >= 0 ? user.slice(atIdx + 1) : '';
    const protocol: Protocol =
      domain === 'bsky.social' || domain === 'threads.net'
        ? domain === 'threads.net'
          ? 'threads'
          : 'bluesky'
        : 'mastodon';
    mentions.push({ raw, protocol, id: user, handle: m[1] ?? '' });
  }

  for (const m of matchAll(/(?:^|\s)@([\w][\w.-]{0,30})(?:\s|$|[.,!?])/g, text)) {
    const raw = `@${m[1] ?? ''}`;
    if (seen.has(raw)) continue;
    seen.add(raw);
    mentions.push({ raw, protocol: contextProtocol ?? 'nostr', id: raw, handle: m[1] ?? '' });
  }

  for (const m of matchAll(/did:(plc|pkh|web|key|ens):([\w.-]+)/g, text)) {
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    const didType = m[0].startsWith('did:plc') ? 'bluesky' : 'ethereum';
    mentions.push({
      raw: m[0],
      protocol: didType as Protocol,
      id: m[0],
      handle: (m[2] ?? m[0]).slice(0, 20),
    });
  }

  return mentions;
}

export function extractMedia(post: UnifiedPost): NormalizedMedia[] {
  const media: NormalizedMedia[] = [];
  for (const embed of post.embeds ?? []) {
    if (embed.kind === 'image') {
      media.push({
        kind: 'image',
        url: embed.url,
        alt: embed.meta?.alt ? String(embed.meta.alt) : '',
        width: typeof embed.meta?.width === 'number' ? embed.meta.width : undefined,
        height: typeof embed.meta?.height === 'number' ? embed.meta.height : undefined,
        mimeType: typeof embed.meta?.mimeType === 'string' ? embed.meta.mimeType : undefined,
        meta: embed.meta,
      });
    } else if (embed.kind === 'video') {
      media.push({
        kind: 'video',
        url: embed.url,
        alt: embed.meta?.alt ? String(embed.meta.alt) : '',
        width: typeof embed.meta?.width === 'number' ? embed.meta.width : undefined,
        height: typeof embed.meta?.height === 'number' ? embed.meta.height : undefined,
        mimeType: typeof embed.meta?.mimeType === 'string' ? embed.meta.mimeType : undefined,
        meta: embed.meta,
      });
    } else if (embed.kind === 'link' && embed.meta?.image) {
      media.push({
        kind: 'image',
        url: String(embed.meta.image),
        alt: embed.meta?.title ? String(embed.meta.title) : '',
        meta: embed.meta,
      });
    }
  }
  return media;
}

export function extractLinks(post: UnifiedPost): string[] {
  return (post.embeds ?? []).filter((e) => e.kind === 'link' && !e.meta?.image).map((e) => e.url);
}

export function normalizePost(post: UnifiedPost): NormalizedContent {
  const text = post.html ? post.html.replace(/<[^>]*>/g, '').trim() : (post.text ?? '').trim();
  return {
    text,
    html: post.html,
    hashtags: extractHashtags(text),
    mentions: extractMentions(text, post.protocol as Protocol),
    media: extractMedia(post),
    links: extractLinks(post),
    sourceProtocol: post.protocol as Protocol,
    originalPost: post,
  };
}

export function normalizeText(text: string, contextProtocol?: Protocol) {
  return {
    text: text.trim(),
    hashtags: extractHashtags(text),
    mentions: extractMentions(text, contextProtocol),
  };
}

export function translateHashtagsForProtocol(
  hashtags: string[],
  _targetProtocol: Protocol,
): string[] {
  return hashtags.map((t) => translateHashtag(t));
}
