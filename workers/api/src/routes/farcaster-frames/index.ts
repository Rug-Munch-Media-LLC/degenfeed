/**
 * @degenfeed/api-worker — Farcaster Frame Routes Barrel
 */
import { Hono } from 'hono';
import type { Env } from '../types';
import { registerCoinFrameRoutes } from './coins';
import { registerPostFrameRoutes } from './posts';
import { registerSpaceFrameRoutes } from './spaces';
import { registerStreamFrameRoutes } from './streams';

export const frames = new Hono<{ Bindings: Env }>();
registerStreamFrameRoutes(frames);
registerSpaceFrameRoutes(frames);
registerCoinFrameRoutes(frames);
registerPostFrameRoutes(frames);

export default frames;
