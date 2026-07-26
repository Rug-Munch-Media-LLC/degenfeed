/**
 * @degenfeed/api-worker — PeerTube Videos
 *
 * Video upload, listing, detail, and rating.
 */

import type { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import type { Env } from '../../types';
import type { PaginatedResponse, PeerTubeVideo } from './types';
import { getPeerTubeClient, mapVideoForResponse, peertubeFetch } from './utils';

export function registerVideoRoutes(router: Hono<{ Bindings: Env }>): void {
