// ── God code split: moved to server/ directory ──────────────────────────
// types.ts   — UnifiedIdentity, UnifiedPost, SchemaGuard
// feeds.ts   — PROVIDERS, buildFeed, DEFAULT_PREFERENCES
// index.ts   — HTTP server, route handlers, jsonOk

// Import server index to start the HTTP listener
import './server/index';

export { buildFeed, DEFAULT_PREFERENCES, PROVIDERS } from './server/feeds';
export type { SchemaGuard, UnifiedIdentity, UnifiedPost } from './server/types';
