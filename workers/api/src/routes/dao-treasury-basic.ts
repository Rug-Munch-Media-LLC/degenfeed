/**
 * @degenfeed/api-worker — Basic DAO Treasury operations (KV-based)
 *
 * These are distinct from the Service-based handlers in dao-treasury.ts.
 * Both are used by app.ts route registrations.
 */

import { jsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';
import {
