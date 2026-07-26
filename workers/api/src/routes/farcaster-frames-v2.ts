/**
 * @degenfeed/api-worker — Farcaster Frames v2 / Mini Apps Routes
 *
 * Complete Frames v2 implementation:
 *   - Frame Embed generation (single fc:frame JSON meta tag)
 *   - Frame manifest (.well-known/farcaster.json)
 *   - Transaction frames (action: 'tx' with eth_sendTransaction / eth_signTypedData_v4)
 *   - Multi-step frames with state management
 *   - Frame builder (no-code frame creation from templates)
 *   - Frame analytics (views, clicks, conversions)
 *   - Frame cross-posting (Farcaster, Nostr, Bluesky, Mastodon)
 *   - Frame discovery (trending, search, directory)
 *   - Frame notifications (interaction webhooks)
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 * Every provider gets a health check.
 *
 * Routes:
 *   POST /api/frames/create            — Create a frame from template
 *   GET  /api/frames/:id               — Get frame details
 *   GET  /api/frames/v2/:id            — Serve Frames v2 HTML page
 *   POST /api/frames/v2/:id            — Handle frame action
 *   GET  /api/frames/v2/:id/image      — Frame OG image
 *   DELETE /api/frames/:id              — Delete a frame
 *   GET  /api/frames/user              — List user's frames
 *   GET  /api/frames/discover          — Discover trending frames
 *   GET  /api/frames/analytics/:id     — Frame analytics
 *   GET  /api/frames/analytics         — All frames analytics
 *   POST /api/frames/crosspost         — Cross-post frame to protocols
 *   GET  /api/frames/templates         — List available templates
 *   POST /api/frames/notify            — Frame notification webhook receiver
 *   GET  /api/frames/manifest          — Frame manifest (.well-known/farcaster.json)
 */

import type { FrameResponseButton, FrameState } from '@degenfeed/farcaster-sdk';
import {
