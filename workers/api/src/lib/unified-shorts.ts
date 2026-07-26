/**
 * @degenfeed/api-worker — Unified Multi-Protocol Shorts Pipeline
 *
 * The holy grail of short video distribution. A creator posts once,
 * and their short appears on EVERY protocol simultaneously:
 *
 *   ActivityPub (Mastodon/GoToSocial/Loops/Pixelfed/PeerTube)
 *   AT Protocol (Bluesky/Flashes)
 *   Nostr
 *   Farcaster
 *   Lens
 *   Zora (as a video NFT — mint once, tradeable anywhere)
 *   PeerTube (federated video hosting)
 *   DegenFeed (our own swipe feed)
 *
 * Key design principle: fail-open. If any protocol is unreachable,
 * the others still succeed. Partial success is success.
 *
 * @see orchestratePublish in publish-orchestrator.ts for the text-publish engine
 * @see ZoraVideoIntegration in zora-video.ts for NFT minting
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../types';
import { orchestratePublish, type PublishReport } from './publish-orchestrator';
import { ZoraVideoIntegration } from './zora-video';

// ─── Types ────────────────────────────────────────────────────────────────

export type ShortProtocol =
  | 'activitypub'
  | 'atproto'
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'zora'
  | 'peertube'
  | 'degenfeed';

export type Chain = 'base' | 'ethereum' | 'optimism' | 'arbitrum' | 'solana';

export type ShortVideo = {}
