/**
 * @degenfeed/api-worker — Farcaster Frames v2 Route Registration
 */

import type { Hono } from 'hono';
import type { Env } from '../../types';
import framesV2 from '../farcaster-frames-v2';

export function registerFramesRoutes(app: Hono<{ Bindings: Env }>): void {
