/**
 * @degenfeed/api-worker — DAO Proposals (create, list, vote, queue, execute)
 */

import { jsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';
import {
