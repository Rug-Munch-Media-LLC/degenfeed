/**
 * @degenfeed/api-worker — Ghost CMS Headless Routes
 *
 * Endpoints for the headless Ghost integration:
 *   GET    /api/ghost/posts           — List published articles
 *   GET    /api/ghost/posts/:slug     — Single article
 *   POST   /api/ghost/posts           — Create article (premium/admin)
 *   POST   /api/ghost/posts/:id/tip   — Tip the author
 *   POST   /api/ghost/posts/:id/cross-post — Cross-post to protocols
 *   POST   /api/ghost/newsletter/send — Send newsletter
 *   POST   /api/ghost/subscribe       — Subscribe to newsletter
 *   POST   /api/ghost/unsubscribe     — Unsubscribe from newsletter
 *   GET    /api/ghost/subscribers     — List subscribers (admin)
 */

import { GhostBridge, type Protocol } from '@degenfeed/ghost-bridge';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────

interface GhostEnv extends Env {
