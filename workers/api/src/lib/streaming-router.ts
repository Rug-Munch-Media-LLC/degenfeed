/**
 * @degenfeed/api-worker — Enhanced Adaptive Streaming Router
 *
 * Intelligent routing engine that selects the optimal streaming backend
 * based on real-time viewer count thresholds:
 *
 *   <10 viewers   → WebRTC P2P (FREE — browser-to-browser, zero bandwidth)
 *   10-50 viewers  → Owncast (self-hosted, fixed server cost)
 *   50-500 viewers → PeerTube Live (our instance, federated distribution, free)
 *   500+ viewers   → Livepeer (external, $0.003/viewer-hr)
 *   5000+ viewers  → Cloudflare Stream (enterprise CDN)
 *
 * Features:
 *   - Auto-switch based on real-time viewer count
 *   - Transparent to streamer — they just "go live"
 *   - Bandwidth monitoring & cost tracking
 *   - IPFS VOD archiving after stream ends
 *   - PeerTube federation for free distribution
 *   - Cost optimization (auto-downgrade when viewers drop)
 */

import { log } from '../logger';
import type { Env } from '../types';
import { uploadToIPFS } from './ipfs-storage';
import { LivepeerService } from './livepeer-service';
import { WebRTCSessionManager } from './webrtc-streaming';

// ─── Types ──────────────────────────────────────────────────────────────

export type StreamingMode = 'p2p' | 'owncast' | 'peertube' | 'livepeer' | 'cloudflare';

export type SimulcastTarget = {};
