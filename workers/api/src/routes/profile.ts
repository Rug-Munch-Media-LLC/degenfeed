/**
 * Cross-platform identity profile — resolve a handle across all protocols.
 *
 * GET /api/identity/profile?handle=vitalik.eth
 * GET /api/identity/profile?handle=npub1...
 *
 * Returns merged identity with all linked accounts + recent posts from each.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

type LinkedAccount = {};
