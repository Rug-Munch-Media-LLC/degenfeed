/**
 * Feed routes — thin orchestrator over the feed pipeline layers.
 *
 * Pipeline: fetch (providers + circuit breakers) → dedup (cross-protocol)
 * → enrich (spam, mutes, language) → score (ranking v2 + velocity +
 * engagement prediction) → cache (KV, SWR, per-user).
 * Layer implementations live in src/feed/; auxiliary routes (reddit,
 * single provider, health) live in ./feed-misc.
 */

import { PRESET_NAMES, type PresetName, resolvePreset } from '@degenfeed/feed-core';
import { parseProtocols } from '@degenfeed/utils';
import {
