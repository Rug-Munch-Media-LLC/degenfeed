/**
 * @degenfeed/api-worker — Protocol Status Dashboard
 *
 * Routes:
 *   GET /api/protocols/status       — Health status of ALL protocols
 *   GET /api/protocols/status/:name — Single protocol health
 *
 * Returns real-time health data including latency, uptime, and status.
 * Cached in KV for 30 seconds to reduce backend load.
 *
 * Response:
 * {
