/**
 * @degenfeed/api-worker — Unified Profile Utils
 */

/**
 * Filter aggregated profile to only include requested fields.
 */
import type { AggregatedProfile } from '../../lib/profile-sync';

export function filterAggregatedProfile(
  profile: AggregatedProfile,
  fields: string[],
): Partial<AggregatedProfile> {
  const filtered: Partial<AggregatedProfile> = { wallet: profile.wallet };
  for (const field of fields) {
    if (field in profile) {
      (filtered as unknown as Record<string, unknown>)[field] = (
        profile as unknown as Record<string, unknown>
      )[field];
    }
  }
  return filtered;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}
