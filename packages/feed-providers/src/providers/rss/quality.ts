import type { UnifiedPost } from '@degenfeed/types';
import type { QualityScore, RssFeedConfig, RssProviderOptions } from './types';

export type { RssProviderOptions };

function computeFreshnessScore(createdAt: number): number {
  const ageMs = Date.now() - createdAt;
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours < 1) return 3;
  if (ageHours < 6) return 2;
  if (ageHours < 24) return 1;
  return 0;
}

function computeLengthScore(text: string): number {
  const len = text.length;
  if (len > 500) return 2;
  if (len > 200) return 1;
  return 0;
}

export function computeQualityScore(post: UnifiedPost, config: RssFeedConfig): QualityScore {
  // Newsletter-specific: paid tier bonus
  const newsletterPaid = config.isPaid ? 2 : 0;

  // Newsletter-specific: longer content = deeper analysis
  let newsletterDepth = 0;
  if (config.category === 'newsletter' && post.text.length > 2000) {
    newsletterDepth = 2;
  } else if (config.category === 'newsletter' && post.text.length > 1000) {
    newsletterDepth = 1;
  }

  // Newsletter-specific: schedule consistency
  const newsletterConsistency = config.schedule === 'daily' || config.schedule === 'weekly' ? 1 : 0;

  const signals = {
    weight: config.weight,
    freshness: computeFreshnessScore(post.createdAt),
    length: computeLengthScore(post.text),
    hasMedia: post.embeds.length > 0 ? 1 : 0,
    authority: config.authority,
    newsletterPaid,
    newsletterDepth,
    newsletterConsistency,
  };
  const total =
    signals.weight +
    signals.freshness +
    signals.length +
    signals.hasMedia +
    signals.authority +
    signals.newsletterPaid +
    signals.newsletterDepth +
    signals.newsletterConsistency;
  return { total, signals };
}
