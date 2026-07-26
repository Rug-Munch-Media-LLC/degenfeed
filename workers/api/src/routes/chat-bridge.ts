/**
 * /api/chat/bridge — Protocol Bridge Management
 *
 * Routes:
 *   POST /api/chat/bridge/:protocol/enable   — Enable a protocol bridge
 *   POST /api/chat/bridge/:protocol/disable  — Disable a protocol bridge
 *   GET  /api/chat/bridge/status             — Bridge health per protocol
 *   GET  /api/chat/bridge/:protocol/health   — Health check for specific protocol
 *
 * Matrix is the universal hub. All protocols bridge THROUGH Matrix.
 * One Matrix room = one DegenFeed chat conversation.
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// Lazy-load the chat super-app
const _matrixHub: typeof import('@degenfeed/chat-super-app').MatrixHub | null = null;
async function getHub() {
