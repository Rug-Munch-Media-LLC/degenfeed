/**
 * @degenfeed/api-worker — Livepeer Video Transcoding & Streaming Service
 *
 * Integrates with Livepeer Studio for:
 *   - Video transcoding (offload CPU-intensive ffmpeg)
 *   - Stream creation & management
 *   - Real-time viewer metrics
 *   - Webhook handling for stream lifecycle events
 *
 * API: https://livepeer.studio/api/
 * Docs: https://docs.livepeer.org/reference/
 */

import type { Env } from '../types';
import { recordBridgeOperation, withReliability } from './bridge-reliability';

// ─── Types ──────────────────────────────────────────────────────────────

export type LivepeerStreamOptions = {};
