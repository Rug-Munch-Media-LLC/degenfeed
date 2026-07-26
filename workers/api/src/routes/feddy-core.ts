/**
 * @degenfeed/api-worker — Feddy Communities: Core CRUD & Directory
 *
 * Community creation, directory browsing, trending, autocomplete,
 * similar communities, follower communities, discover, and name reservation.
 */

import { Hono } from 'hono';
import { rateLimit } from '../index';
import type { FeddyCategory, FeddyCommunity } from '../lib/feddy-store';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
