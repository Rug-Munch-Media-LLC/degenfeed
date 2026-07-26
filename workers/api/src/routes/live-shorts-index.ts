/**
 * @degenfeed/api-worker — Live Shorts barrel export
 *
 * Combines main router and meta router into a single Hono router.
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import liveShortsMeta from './live-shorts-meta';
import liveShortsRouter from './live-shorts-router';

const liveShorts = new Hono<{ Bindings: Env }>();
liveShorts.route('/', liveShortsRouter);
liveShorts.route('/', liveShortsMeta);

export default liveShorts;
