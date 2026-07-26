/**
 * @degenfeed/api-worker — Simulcast Analytics
 *
 * Tracks per-platform viewer counts, engagement, revenue, and computes
 * cross-platform analytics for simulcast streams.
 *
 * Data flows:
 *   Viewer count: Platform API → KV cache → Analytics aggregator
 *   Revenue: Tip events from all platforms → KV → Aggregator
 *   Chat engagement: Cross-platform chat bridge → KV
 *
 * @see ./simulcast-engine.ts
 */

import type { Env } from '../types';
import type { SimulcastStream } from './simulcast-engine';

// ─── KV Key Helpers ──────────────────────────────────────────────────────────

function analyticsKey(simulcastId: string): string {
