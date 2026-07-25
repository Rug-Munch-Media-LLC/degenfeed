/**
 * Podcast API — base route (/api/podcast)
 * Proxies to bridge server.
 */

import { proxyGet, proxyPost } from '../_proxy';

export async function GET(request: Request): Promise<Response> {
  return proxyGet('/api/podcast', request);
}

export async function POST(request: Request): Promise<Response> {
  return proxyPost('/api/podcast', request);
}
