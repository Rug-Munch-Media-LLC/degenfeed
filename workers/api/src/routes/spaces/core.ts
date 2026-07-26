/**
 * @degenfeed/api-worker — Spaces Core (CRUD + listing + cross-protocol + scheduling)
 */

import { spaceKey } from '../../kv-helpers';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../../response-helpers';
import type { Env } from '../../types';
import { broadcastToAll } from '../../ws-broadcast';
import type { SpaceCategory, SpaceRecord, SpaceVisibility } from './types';
import {
