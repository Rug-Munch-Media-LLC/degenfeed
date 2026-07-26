/**
 * @degenfeed/api-worker — DAO Treasury Route Handlers (inline from dao.ts)
 *
 * Treasury handlers extracted from the original dao.ts monolithic file.
 * Shares types and helpers from dao-crud.ts.
 */

import { jsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';
import type {
