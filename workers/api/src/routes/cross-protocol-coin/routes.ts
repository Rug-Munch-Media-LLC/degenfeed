/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin Route Handlers
 *
 * Route handlers for the crossProtocolCoin Hono router.
 */

import { createCrossChainRegistry } from '@degenfeed/zora-sdk';
import { requirePremiumTier } from '../../premium';
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../../sanitize';
import { requireSession } from '../../session';
import type { Env } from '../../types';
import { deployBaseCoin, deploySolanaToken } from './deploy';
import {
