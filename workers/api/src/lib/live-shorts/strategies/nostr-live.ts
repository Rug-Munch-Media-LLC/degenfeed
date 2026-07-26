/**
 * @degenfeed/api-worker — Nostr Live Short Strategy
 *
 * Nostr has NATIVE live streaming support via Kind 30311 (parameterized
 * replaceable events per NIP-93). Many Nostr clients (Damus, Primal, Amethyst)
 * already render Kind 30311 events with inline video players. This is the
 * best possible live experience on Nostr.
 *
 * Strategy: Use Nostr's native Kind 30311 live event format with short-form
 * extensions:
 *   - `t: short` tag for client filtering
 *   - `duration: 60` tag for short-form awareness
 *   - `streaming` tag points to HLS URL
 *   - `status: live` → `status: ended` transition
 *   - `current_participants` for live viewer counts
 *
 * Native live support: FULL — Kind 30311 is the nostr native live event.
 */

import type { NostrEvent } from '@degenfeed/nostr-sdk';
import type { Env } from '../../../types';
import type { LiveSessionInfo, ProtocolStrategy, ViewerCountResult } from '../live-strategy';
import { LIVE_SHORT_STRATEGIES } from '../protocol-strategies';

const STRATEGY = LIVE_SHORT_STRATEGIES.nostr;

const DEFAULT_RELAYS =
  'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://relay.degenfeed.xyz';

/**
 * Nostr live short strategy using Kind 30311.
 */
export const nostrLiveStrategy: ProtocolStrategy = {

