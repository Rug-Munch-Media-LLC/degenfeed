/**
 * /api/matrix — Matrix Protocol Integration
 *
 * Bridge DegenFeed to Matrix rooms for federated messaging.
 *
 * Endpoints:
 *   POST   /api/matrix/connect     { homeserverUrl, accessToken, roomId }
 *   POST   /api/matrix/send        { roomId, content, msgType? }
 *   GET    /api/matrix/rooms       → list connected rooms
 *   DELETE /api/matrix/disconnect  { roomId? }
 *   POST   /api/matrix/bridge      { roomId, streamId }
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

function safeKey(s: string): string {
