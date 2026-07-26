/**
 * @degenfeed/api-worker — Shorts Aggregator Conversion Utilities
 *
 * Helper functions for converting between short-form video formats
 * and performing common data transformations.
 */

import type { ShortVideoItem } from '@degenfeed/shorts-provider';
import type { AggregatedShort, ExtendedSource } from './types';
import { SOURCE_META } from './types';

/**
 * Convert a legacy ShortVideoItem to the new AggregatedShort format.
 */
export function toAggregated(v: ShortVideoItem, source: ExtendedSource): AggregatedShort {
  const sourceMeta = SOURCE_META[source] ?? { label: source, color: '#666', icon: source };
  return {
    id: v.id,
    source,
    sourceLabel: v.sourceLabel || sourceMeta.label,
    sourceColor: v.sourceColor || sourceMeta.color,
    sourceUrl: v.sourceUrl,
    title: v.title,
    description: v.description,
    thumbnailUrl: v.thumbnailUrl,
    videoUrl: v.videoUrl,
    duration: v.duration,
    creatorName: v.authorName,
    creatorAvatar: v.authorAvatar,
    creatorHandle: v.authorName,
    views: v.views,
    likes: v.likes,
    tags: v.topics,
    categories: v.topics,
    publishedAt: v.publishedAt,
    qualityScore: v.qualityScore,
    engagementRate: v.views > 0 ? v.likes / Math.max(v.views, 1) : 0,
    canTip: v.canTip ?? false,
    contentHash: `${source}:${v.id}`,
    vertical: v.vertical ?? v.duration < 60,
  };
}

/**
 * Convert a wei string (bigint) to ETH string.
 */
export function weiToEth(wei: string): string {
  try {
    const weiBig = BigInt(wei);
    const eth = Number(weiBig) / 1e18;
    return eth < 0.001 ? '< 0.001' : eth.toFixed(4);
  } catch {
    return '0';
  }
}
