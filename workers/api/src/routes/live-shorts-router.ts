/**
 * @degenfeed/api-worker — Live Shorts: Main Router
 *
 * CRUD and interaction routes for live short sessions.
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import { DEFAULT_PROTOCOLS } from './feed';
import {
