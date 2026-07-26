/**
 * @degenfeed/api-worker — PeerTube Channels & Federation
 *
 * Channel management, federation health, categories.
 */

import type { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import type { Env } from '../../types';
import type { PaginatedResponse, PeerTubeChannel, PeerTubeVideo } from './types';
import { PEERTUBE_CATEGORIES } from './types';
import { getPeerTubeClient, mapChannelForResponse, peertubeFetch } from './utils';

export function registerChannelRoutes(router: Hono<{ Bindings: Env }>): void {
