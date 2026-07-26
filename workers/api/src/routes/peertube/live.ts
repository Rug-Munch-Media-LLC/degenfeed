/**
 * @degenfeed/api-worker — PeerTube Live
 *
 * Live stream creation, listing, viewer counts, chat.
 */

import type { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import type { Env } from '../../types';
import type { PaginatedResponse, PeerTubeVideo } from './types';
import { getPeerTubeClient, mapVideoForResponse, peertubeFetch } from './utils';

export function registerLiveRoutes(router: Hono<{ Bindings: Env }>): void {
