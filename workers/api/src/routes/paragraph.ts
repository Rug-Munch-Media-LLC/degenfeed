/**
 * @degenfeed/api-worker — Paragraph.xyz Bridge Routes
 *
 * Endpoints for the Paragraph bridge integration:
 *   POST  /api/paragraph/publish           — Cross-post to Paragraph
 *   GET   /api/paragraph/articles/:fid     — Get author's Paragraph articles
 *   GET   /api/paragraph/articles          — Get Paragraph articles
 *   GET   /api/paragraph/trending          — Trending on Paragraph
 *   POST  /api/paragraph/import            — Import Paragraph article to DegenFeed
 *   POST  /api/paragraph/subscribe         — Subscribe to newsletter
 *   GET   /api/paragraph/newsletter/stats  — Newsletter analytics
 *   GET   /api/paragraph/search            — Search Paragraph articles
 */

import { ParagraphBridge } from '@degenfeed/paragraph-bridge';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────

interface ParagraphEnv extends Env {
