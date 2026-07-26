/**
 * @degenfeed/api-worker — Concierge Registration Service
 *
 * Shared business logic for the register-all system:
 *   - Pricing & charge calculations per plan
 *   - Recovery package generation
 *   - Store results in IDENTITIES KV
 *   - RSS feed URL generation
 *   - ENS placeholder (records intent)
 *
 * Plans:
 *   free      — GtS + ATProto + Nostr + RSS + Lemmy + PeerTube + Pixelfed (self-serve Farcaster/Lens via redirect)
 *   standard  — Farcaster ($5 gas) + Lens ($2 gas) + $3 service — user pays $10 total
 *   complete  — standard + custom Lens handle (up to 8 chars, $10 gas) + ENS ($10) — user pays $20 (bundle saves $7)
 *   premium   — everything covered by $10/mo subscription
 */

import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import { log } from '../logger';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

export type RegistrationPlan = {}
