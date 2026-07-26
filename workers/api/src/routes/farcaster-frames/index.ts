/**
 * @degenfeed/api-worker — Farcaster Frame Routes
 *
 * Barrel for the Farcaster Frames system.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { registerStreamFrameRoutes } from './streams';
import { registerSpaceFrameRoutes } from './spaces';
import { registerCoinFrameRoutes } from './coins';
import { registerPostFrameRoutes } from './posts';

export const frames = new Hono<{ Bindings: Env }>();

registerStreamFrameRoutes(frames);
registerSpaceFrameRoutes(frames);
registerCoinFrameRoutes(frames);
registerPostFrameRoutes(frames);

export default frames;
