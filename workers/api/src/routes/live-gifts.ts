/**
 * @degenfeed/api-worker — Live Gifts Barrel (barrel)
 *
 * Re-exports gift system types, constants, and handlers.
 * Consumers import from './routes/live-gifts' for everything.
 *
 * API endpoints registered in app.ts:
 *   POST /api/live/gifts/send
 *   GET  /api/live/gifts/leaderboard
 *   GET  /api/live/gifts/types
 *   GET  /api/live/gifts/packages
 *   GET  /api/live/gifts/history
 *   GET  /api/live/gifts/earnings
 *   POST /api/live/gifts/process-payout
 */

export type {
