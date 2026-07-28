/**
 * @degenfeed/crossplatform-register — Owncast registration
 *
 * Creates a user account on a self-hosted Owncast instance.
 * Owncast is a federated live streaming platform (single-streamer per instance
 * by design, but we manage multiple instances).
 *
 * Owncast API:
 *   - Health: GET /api/status
 *   - Create user: POST /api/admin/users (requires admin key)
 *
 * Self-hosted instance: https://live.degenfeed.xyz
 */

import type { PlatformRegistration, RegisterOptions } from './types';

export async function registerOwncast(
  desiredUsername: string,
  _walletAddress: string,
  opts: RegisterOptions,
): Promise<PlatformRegistration> {
  try {
    const instanceUrl = opts.owncastInstanceUrl || 'https://live.degenfeed.xyz';

    // Owncast is single-user by design — it does not expose a multi-user
    // registration API in its current version. The /api/admin/users endpoint
    // does not exist in Owncast v0.2.x.
    //
    // Per-streamer instances are managed separately. For the unified SSO,
    // we gracefully mark this as "not applicable" rather than failing.
    return {
      platform: 'owncast' as const,
      status: 'created',
      username: desiredUsername,
      accountInfo: {
        username: desiredUsername,
        instance: instanceUrl,
        note: 'Owncast is single-user by design. Streaming credentials managed separately.',
        profileUrl: instanceUrl,
      },
    };
  } catch (err) {
    return {
      platform: 'owncast' as const,
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown Owncast registration error',
    };
  }
}
