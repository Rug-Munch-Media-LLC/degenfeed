/**
 * Embed system — embeddable post cards for external sites.
 *
 * Like Twitter embeds, let external sites embed DegenFeed posts.
 *
 * GET /api/embed/:dfUri    — Returns HTML <blockquote> with JSON-LD data
 * GET /api/embed/:dfUri.js — Returns JavaScript that dynamically loads the embed
 *
 * The existing /api/embed/resolve handler for link-preview enrichment
 * is preserved as handleEmbedResolve.
 */

import { enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import {
