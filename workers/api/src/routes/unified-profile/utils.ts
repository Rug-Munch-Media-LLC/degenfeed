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
