/**
 * /api/presets — Protocol quality preset storage (KV-backed)
 *
 * Stores per-protocol preset selections in KV at
 * `user:preset:{wallet}:{protocol}` so they persist across sessions.
 *
 * Auth: requires a valid session cookie (`__Host-dfid`).
 *
 * GET  /api/presets              → all presets for this user
 * GET  /api/presets?protocol=X   → preset for one protocol
 * POST /api/presets              → save preset for a protocol
 */

import { PRESET_NAMES, type PresetName, presetKvKey } from '@degenfeed/feed-core';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

export type StoredPresetEntry = {};
