import type { UnifiedPost } from '../../server';
import type { BskyPostView } from './types';

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
  if (post.embed?.playlist || post.embed?.thumbnail) return 'video';
  if (post.embed?.external?.uri) {
    const url = post.embed.external.uri;
    if (/\.(mp4|webm|mov|avi)$/i.test(url) || /youtube|youtu\.be|vimeo|twitch/i.test(url))
      return 'video';
    return 'link';
  }
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
  if (embedView?.external?.thumb && media.length === 0)
    media.push({
      url: embedView.external.thumb,
      thumb: embedView.external.thumb,
      alt: embedView.external.title || 'Link preview',
      aspectRatio: 1.91,
    });
  return media;
}
