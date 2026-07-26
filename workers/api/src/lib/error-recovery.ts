/**
 * @degenfeed/api-worker — Error Recovery System
 *
 * CLASSIFIES every error the platform can encounter and produces a
 * recovery strategy. Every route handler MUST go through `withRecovery()`
 * which chains error classification → recovery execution → fallback.
 *
 * Error Categories:
 *   - NETWORK    — DNS failures, timeouts, connection refused, 429/5xx
 *   - WALLET     — User rejected, insufficient funds, wrong network, disconnect
 *   - CONTRACT   — Revert, out of gas, nonce errors, not deployed
 *   - STREAM     — RTMP lost, encoder crash, bandwidth, PeerTube down
 *   - COIN       — Deploy failed, initial buy failed, vesting claim failed
 *
 * ARCHITECTURE:
 *   Classifier → Strategy Selector → Recovery Executor → Fallback Chain
 *
 * Every recovery strategy returns a RecoveryOutcome that the caller
 * can use to surface the right UX (toast, retry button, fallback data).
 */

import { logError } from '../error-logger';
import type { Env } from '../types';

// ─── Error Categories ──────────────────────────────────────────────────────

export type ErrorCategory = 'network' | 'wallet' | 'contract' | 'stream' | 'coin' | 'unknown';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

export type ClassifiedError = {};
