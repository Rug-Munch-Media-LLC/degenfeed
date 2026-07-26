/**
 * @degenfeed/api-worker — Feddy Communities: Community Details & Settings
 *
 * Community detail view, settings update, and community deletion.
 */

import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
