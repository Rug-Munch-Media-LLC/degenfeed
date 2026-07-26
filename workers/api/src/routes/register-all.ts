/**
 * @degenfeed/api-worker — Concierge Registration Router
 *
 * A unified "sign up everywhere" API that creates accounts on ALL protocols
 * in one call. Handles pricing, payment, account creation, and recovery info.
 *
 * Routes:
 *   POST /api/register/all      — Full concierge registration bundle
 *   GET  /api/register/status   — Check what accounts are registered
 *   POST /api/register/farcaster — Register just Farcaster
 *   POST /api/register/lens      — Register just Lens
 *   GET  /api/register/export    — Export recovery package
 *   GET  /api/register/plans     — List available plans with pricing
 *
 * Plans:
 *   free      — GtS + ATProto PDS + Nostr + RSS + Lemmy + PeerTube + Pixelfed ($0)
 *   standard  — Everything + Farcaster + Lens ($8 one-time)
 *   complete  — Standard + custom Lens handle + ENS ($15 one-time)
 *   premium   — Everything covered by $10/mo subscription ($0 additional)
 */

import {
