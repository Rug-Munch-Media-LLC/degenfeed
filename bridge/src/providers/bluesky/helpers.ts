import type { UnifiedPost } from '../../server';
import type { BskyFacet, BskyPostView } from './types';

export function guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|doge|shib)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit)\b/.test(lower)) niches.push('security');
  if (/\b(web3|blockchain|wallet|did)\b/.test(lower)) niches.push('web3');
  if (/\b(rust|typescript|python|programming|code|dev)\b/.test(lower)) niches.push('tech');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

export function detectContentType(post: BskyPostView): UnifiedPost['contentType'] {
  if (post.embed?.images && post.embed.images.length > 0) return 'image';
  if (post.record.embed?.images && post.record.embed.images.length > 0) return 'image';
  if (post.embed?.video || post.embed?.playlist || post.embed?.thumbnail) return 'video';
  if (post.embed?.record?.uri) return 'thread';
  if (post.embed?.external?.uri) {
    const url = post.embed.external.uri;
    if (/\.(mp4|webm|mov|avi)$/i.test(url) || /youtube|youtu\.be|vimeo|twitch/i.test(url))
      return 'video';
    return 'link';
  }
  if (post.record.reply?.parent.uri) return 'thread';
  return 'text';
}

export function extractMediaFromPost(post: BskyPostView): Array<{
  url: string;
  thumb?: string;
  alt: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}> {
  const media: Array<{
    url: string;
    thumb?: string;
    alt: string;
    width?: number;
    height?: number;
    aspectRatio?: number;
  }> = [];
  const embedView = post.embed;
  if (embedView?.images && embedView.images.length > 0) {
    for (const img of embedView.images) {
      media.push({
        url: img.fullsize || img.thumb,
        thumb: img.thumb,
        alt: img.alt || '',
        width: img.aspectRatio?.width,
        height: img.aspectRatio?.height,
        aspectRatio: img.aspectRatio ? img.aspectRatio.width / img.aspectRatio.height : undefined,
      });
    }
    return media;
  }
  if (post.record.embed?.images && post.record.embed.images.length > 0) {
    for (const img of post.record.embed.images) {
      const cid = img.image?.ref?.link;
      if (!cid) continue;
      media.push({
        url: `https://cdn.bsky.app/img/feed_fullsize/plain/${post.author.did}/${cid}@jpeg`,
        thumb: `https://cdn.bsky.app/img/feed_thumbnail/plain/${post.author.did}/${cid}@jpeg`,
        alt: img.alt || '',
        width: img.aspectRatio?.width,
        height: img.aspectRatio?.height,
        aspectRatio: img.aspectRatio ? img.aspectRatio.width / img.aspectRatio.height : undefined,
      });
    }
  }
  if (embedView?.thumbnail)
    media.push({ url: embedView.thumbnail, alt: 'Video thumbnail', aspectRatio: 16 / 9 });
  if (embedView?.video?.thumbnail && media.length === 0)
    media.push({
      url: embedView.video.thumbnail,
      alt: 'Video thumbnail',
      width: embedView.video.aspectRatio?.width,
      height: embedView.video.aspectRatio?.height,
      aspectRatio: embedView.video.aspectRatio
        ? embedView.video.aspectRatio.width / embedView.video.aspectRatio.height
        : 16 / 9,
    });
  if (embedView?.external?.thumb && media.length === 0)
    media.push({
      url: embedView.external.thumb,
      thumb: embedView.external.thumb,
      alt: embedView.external.title || 'Link preview',
      aspectRatio: 1.91,
    });
  return media;
}

/** Extract quote post embed info (app.bsky.embed.record#view). */
export function extractQuoteFromPost(post: BskyPostView): {
  uri: string;
  author: string;
  text: string;
  displayName?: string;
} | null {
  const rec = post.embed?.record;
  if (!rec?.uri) return null;
  const quotedAuthor = rec.author?.handle || rec.author?.did?.slice(0, 12) || 'unknown';
  const valueText = rec.value?.text;
  const recordText = (rec.record as { text?: string } | undefined)?.text;
  return {
    uri: rec.uri,
    author: quotedAuthor,
    text: valueText || recordText || '',
    displayName: rec.author?.displayName,
  };
}

/**
 * Build rich-text HTML from a post's text + facets (mentions/links/hashtags).
 * Facet indices are UTF-8 byte offsets, so we walk them in byte space and
 * splice in anchor tags. Output is safe HTML (hrefs validated http(s)).
 */
export function buildRichTextHtml(text: string, facets?: BskyFacet[]): string {
  if (!text) return '';
  if (!facets || facets.length === 0) return escapeHtml(text);

  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const byteLen = bytes.length;

  // Sort facets by byteStart; clip to valid bounds; drop overlaps.
  const sorted = facets
    .filter((f) => Number.isInteger(f.index?.byteStart) && Number.isInteger(f.index?.byteEnd))
    .sort((a, b) => a.index.byteStart - b.index.byteStart)
    .filter((f) => f.index.byteStart >= 0 && f.index.byteEnd <= byteLen && f.index.byteEnd > f.index.byteStart);

  const chunks: string[] = [];
  let cursor = 0;

  for (const facet of sorted) {
    if (facet.index.byteStart < cursor) continue; // skip overlapping
    const seg = bytes.slice(cursor, facet.index.byteStart);
    chunks.push(escapeHtml(decoder.decode(seg)));
    const target = decoder.decode(bytes.slice(facet.index.byteStart, facet.index.byteEnd));

    const feature = facet.features?.[0];
    const type = feature?.$type || '';
    let rendered: string;
    if (type === 'app.bsky.richtext.facet#link' && feature.uri) {
      const href = /^https?:\/\//i.test(feature.uri) ? feature.uri : `https://${feature.uri}`;
      rendered = `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(target)}</a>`;
    } else if (type === 'app.bsky.richtext.facet#mention' && feature.did) {
      rendered = `<a href="https://bsky.app/profile/${encodeURIComponent(feature.did)}" target="_blank" rel="noopener noreferrer" class="mention">${escapeHtml(target)}</a>`;
    } else if (type === 'app.bsky.richtext.facet#tag' && feature.tag) {
      rendered = `<a href="https://bsky.app/hashtag/${encodeURIComponent(feature.tag)}" target="_blank" rel="noopener noreferrer" class="hashtag">${escapeHtml(target)}</a>`;
    } else {
      rendered = escapeHtml(target);
    }
    chunks.push(rendered);
    cursor = facet.index.byteEnd;
  }

  if (cursor < byteLen) {
    chunks.push(escapeHtml(decoder.decode(bytes.slice(cursor))));
  }

  return chunks.join('');
}

const decoder = new TextDecoder();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return s.replace(/["']/g, '');
}
