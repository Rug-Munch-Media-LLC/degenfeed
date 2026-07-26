/**
 * @degenfeed/api-worker — Bridgy Fed Bridge Service
 *
 * Manages Bridgy Fed connections between our self-hosted instances:
 *   - GoToSocial (ActivityPub) ↔ Bluesky/AT Protocol (PDS)
 *   - Discourse (ActivityPub) ↔ Mastodon ↔ Bluesky
 *   - Ghost (ActivityPub) ↔ Mastodon ↔ Bluesky
 *   - Mobilizon (ActivityPub) ↔ Smoke Signal (AT Protocol) ↔ Mastodon
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 * Every provider gets a health check.
 *
 * Bridgy Fed is the bridge service running at:
 *   https://bridgy.degenfeed.xyz (internal: http://127.0.0.1:8285)
 */
import type { Env } from '../types';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Internal Bridgy Fed URL */
const BRIDGY_FED_INTERNAL = 'http://127.0.0.1:8285';

/** External Bridgy Fed URL */
const BRIDGY_FED_EXTERNAL = 'https://bridgy.degenfeed.xyz';

/** KV key prefixes */
const KV_BRIDGY_CONFIG_PREFIX = 'bridgy:config:';
const KV_BRIDGY_USERS_PREFIX = 'bridgy:users:';
const KV_BRIDGY_CROSSPOST_PREFIX = 'bridgy:crosspost:';
const KV_BRIDGY_HEALTH_PREFIX = 'bridgy:health:cache';
const KV_BRIDGY_REGISTRATION_PREFIX = 'bridgy:registration:';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BridgyFedConfig = {};
