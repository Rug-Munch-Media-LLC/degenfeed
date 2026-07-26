/**
 * @degenfeed/api-worker — Source Discovery API
 *
 * Endpoints:
 *   GET  /api/sources/discover?platform=reddit — Trigger discovery for a platform
 *   GET  /api/sources/pending                  — List pending discovered sources
 *   POST /api/sources/approve                  — Approve and activate a source
 *   POST /api/sources/reject                   — Reject a discovered source
 *
 * Sources are stored in CACHE KV with keys:
 *   discovered:sources:all        — All discovered sources (JSON array)
 *   discovered:sources:pending    — Pending review sources (JSON array)
 *   discovered:sources:rejected   — Rejected source IDs (JSON array)
 *   discovered:sources:run:{date} — Snapshot of a discovery run
 */

import {
