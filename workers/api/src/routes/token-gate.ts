/**
 * @degenfeed/api-worker — Enhanced Token Gate Verification API
 *
 * Endpoints:
 *   POST /api/token-gate/verify        — Verify user holds required token
 *   POST /api/token-gate/verify-multi   — Verify combined/tiered gate config
 *   POST /api/token-gate/gate-content   — Store gate config for content
 *   GET  /api/token-gate/gate/:id       — Get gate config for content
 *   GET  /api/token-gate/:postId        — Get token gate for a post (legacy)
 *
 * Gate types supported:
 *   - Single token/NFT gate
 *   - Combined gates (AND/OR logic)
 *   - Tiered gates (different access levels)
 *   - Time-based holding requirements
 */

import {
