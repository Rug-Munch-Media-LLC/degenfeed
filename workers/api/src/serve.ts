/**
 * @degenfeed/api-worker — Standalone Node.js server
 *
 * Switch to this entry point when migrating off Cloudflare Workers.
 * Usage:
 *   npm run dev:node     # development (tsx watch)
 *   npm run start:node   # production (node --import tsx)
 */

import { serve } from '@hono/node-server';
import { app } from './app';

const port = parseInt(process.env.PORT || '8787', 10);

console.log(`DegenFeed API running on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
