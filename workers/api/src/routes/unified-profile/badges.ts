/**
 * @degenfeed/api-worker — Unified Profile Badges
 *
 * Verification badges, attestations, and protocol verification levels.
 */

import { aggregateProfile } from '../../lib/profile-sync';
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import type { Env } from '../../types';

export interface AggregatedProfile {
  wallet?: string;
  badges: string[];
  verificationLevel: number;
  protocols: Record<string, unknown>;
}

export async function handleProfileBadges(
  _request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
  if (!wallet || wallet.length < 10) return jsonResponse({ error: 'Invalid wallet address' }, 400);
  try {
    const rawProfile = await aggregateProfile(wallet, env);
    const profile = rawProfile as unknown as AggregatedProfile;
    let attestationCount = 0;
    try {
      const raw = await env.IDENTITIES?.get(`attest:wallet:${wallet.toLowerCase()}`);
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        attestationCount = ids.length;
      }
    } catch {
      /* no attestations */
    }
    return noCacheJsonResponse({
      data: {
        badges: profile.badges ?? [],
        verificationLevel: profile.verificationLevel ?? 0,
        connectedProtocols: Object.keys(profile.protocols ?? {}).filter(
          (p) => Object.keys(profile.protocols[p] as Record<string, unknown>).length > 0,
        ),
        attestationCount,
      },
    });
  } catch (err) {
    return jsonResponse({ error: `Failed to get badges: ${String(err)}` }, 500);
  }
}
