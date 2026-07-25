/**
 * @degenfeed/api-worker — Unified Profile Badges
 *
 * Verification badges, attestations, and protocol verification levels.
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { aggregateProfile } from '../lib/profile-sync';

export async function handleProfileBadges(_request: Request, env: Env, wallet: string): Promise<Response> {
  if (!wallet || wallet.length < 10) return jsonResponse({ error: 'Invalid wallet address' }, 400);
  try {
    const profile = await aggregateProfile(wallet, env);
    let attestationCount = 0;
    try {
      const raw = await env.IDENTITIES?.get(`attest:wallet:${wallet.toLowerCase()}`);
      if (raw) { const ids: string[] = JSON.parse(raw); attestationCount = ids.length; }
    } catch { /* no attestations */ }
    return noCacheJsonResponse({
      data: {
        badges: profile.badges,
        verificationLevel: profile.verificationLevel,
        connectedProtocols: (Object.keys(profile.protocols) as Array<keyof typeof profile.protocols>).filter((p) => Object.keys(profile.protocols[p] as Record<string, unknown>).length > 0),
        attestationCount,
      },
    });
  } catch (err) { return jsonResponse({ error: `Failed to get badges: ${String(err)}` }, 500); }
}
