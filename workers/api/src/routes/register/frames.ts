/**
 * @degenfeed/api-worker — Farcaster Frames v2 Route Registration
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import framesV2 from '../farcaster-frames-v2';

export function registerFramesRoutes(app: Hono<{ Bindings: Env }>): void {
  // Mount the Frames v2 sub-router under /api/frames
  app.route('/api/frames', framesV2);

  // Also serve the well-known manifest at the correct path
  app.get('/.well-known/farcaster.json', async (c) => {
    const manifestReq = new Request(
      `https://placeholder${'/api/frames/manifest'}`,
      { method: 'GET' },
    );
    const handler = framesV2.fetch?.(manifestReq, c.env, c.executionCtx);
    if (handler) {
      const response = await handler;
      return response;
    }
    // Fallback: direct import
    const { default: handlerModule } = await import('../../routes/farcaster-frames-v2');
    const internalReq = new Request('http://internal/api/frames/manifest');
    return (handlerModule as any).fetch?.(internalReq, c.env, c.executionCtx) ??
      new Response(JSON.stringify({ error: 'manifest unavailable' }), { status: 500 });
  });
}
