/**
 * @degenfeed/api-worker — Streaming Router Route Handlers
 *
 * HTTP request handlers for stream routing endpoints.
 */

import type { Env } from '../types';
import { BandwidthTracker } from './streaming-router-bandwidth';
import { StreamingRouter } from './streaming-router-core';

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'content-type': 'application/json',
  };
}

export async function handleStreamRouteStatus(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const streamId = url.searchParams.get('streamId');
    if (!streamId) {
      return new Response(JSON.stringify({ error: 'Missing streamId' }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const router = new StreamingRouter(env);
    const stream = await router.getStreamStatus(streamId);

    if (!stream) {
      return new Response(JSON.stringify({ error: 'Stream not found' }), {
        status: 404,
        headers: corsHeaders(),
      });
    }

    return new Response(JSON.stringify(stream), { headers: corsHeaders() });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

export async function handleRouteEstimate(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      currentViewers: number;
      creatorId?: string;
      streamId?: string;
    };
    const router = new StreamingRouter(env);
    const decision = router.evaluateRouting(body.currentViewers);

    return new Response(JSON.stringify(decision), { headers: corsHeaders() });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

export async function handleRouteSwitch(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      streamId: string;
      targetMode: string;
      reason?: string;
    };
    const router = new StreamingRouter(env);
    const stream = await router.getStreamStatus(body.streamId);
    if (!stream) {
      return new Response(JSON.stringify({ error: 'Stream not found' }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const updated = await router.switchMode(stream, body.targetMode as any);
    return new Response(JSON.stringify(updated), { headers: corsHeaders() });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

export async function handleBandwidthReport(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const streamId = url.searchParams.get('streamId');
    const tracker = new BandwidthTracker(env);

    if (streamId) {
      const usage = await tracker.getUsage(streamId);
      return new Response(JSON.stringify(usage ?? { error: 'No data' }), {
        headers: corsHeaders(),
      });
    }

    const total = await tracker.getTotalUsage();
    return new Response(JSON.stringify(total), { headers: corsHeaders() });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

export async function handleBandwidthSummary(_request: Request, env: Env): Promise<Response> {
  try {
    const tracker = new BandwidthTracker(env);
    const total = await tracker.getTotalUsage();
    return new Response(JSON.stringify(total), { headers: corsHeaders() });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
}
