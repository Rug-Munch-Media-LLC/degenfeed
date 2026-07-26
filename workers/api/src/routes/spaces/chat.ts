/**
 * @degenfeed/api-worker — Spaces Chat & Reactions
 *
 * Rich chat features: send/receive messages, pinned messages, reply threading,
 * message reactions, tipping in chat, media sharing, chat moderation.
 * Also handles emoji reactions, recording metadata, and AI transcript/summary.
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../../response-helpers';
import type { Env } from '../../types';
import { broadcastToAll, broadcastToUser } from '../../ws-broadcast';
import type { SpaceChatMessage } from './types';
import {
