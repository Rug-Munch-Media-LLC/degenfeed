/**
 * @degenfeed/api-worker — Digest Delivery
 *
 * Email subscription management and digest delivery.
 */

import type { Protocol } from '@degenfeed/types';
import { jsonResponse, methodNotAllowed } from '../../response-helpers';
import type { Env } from '../../types';
import { DEFAULT_PROTOCOLS } from '../feed';
import { isValidEmail, safeKey } from './types';

export async function handleDigestSubscribeEmail(request: Request, env: Env): Promise<Response> {
