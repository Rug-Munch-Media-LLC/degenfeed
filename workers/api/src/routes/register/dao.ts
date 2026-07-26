/**
 * @degenfeed/api-worker - Dao route registration
 *
 * Register Dao-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import { jsonResponse } from '../../response-helpers';
import type { Env } from '../../types';
import {
