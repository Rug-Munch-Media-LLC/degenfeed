/**
 * @degenfeed/api-worker — Spaces Participants
 *
 * Join/leave, speaker management (add/remove), hand raises, invites, muting.
 */

import { jsonResponse, methodNotAllowed } from '../../response-helpers';
import type { Env } from '../../types';
import { broadcastToAll } from '../../ws-broadcast';
import { getSpace, isHostOrCoHost, requireSessionAddr, saveSpace } from './utils';

export async function handleSpaceJoin(
  request: Request,
  env: Env,
  spaceId: string,
): Promise<Response> {
