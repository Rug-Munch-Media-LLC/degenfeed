/**
 * @routes/shorts-sources — Shorts Source Management Routes
 *
 * Manage content sources for the shorts aggregation engine.
 *
 * GET    /api/shorts/sources              — List configured sources with health
 * POST   /api/shorts/sources              — Add a new source (RSS feed, channel, hashtag)
 * DELETE /api/shorts/sources/:id          — Remove a source
 * POST   /api/shorts/sources/:id/refresh  — Force refresh content from source
 * GET    /api/shorts/sources/suggestions  — Suggested sources to add
 */

import {
