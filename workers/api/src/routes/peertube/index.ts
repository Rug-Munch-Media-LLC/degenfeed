/**
 * @degenfeed/api-worker — PeerTube barrel
 *
 * Creates the Hono router and registers all route groups.
 * Exports the router as default (consumed by register/live.ts).
 */

import { Hono } from 'hono';
import type { Env } from '../../types';
import { registerChannelRoutes, registerFederationRoutes } from './channels';
import { registerLiveRoutes } from './live';
import { registerVideoRoutes } from './videos';

const peertubeRouter = new Hono<{ Bindings: Env }>();

registerVideoRoutes(peertubeRouter);
registerLiveRoutes(peertubeRouter);
registerChannelRoutes(peertubeRouter);
registerFederationRoutes(peertubeRouter);

export default peertubeRouter;
