import type { Env } from '../index';

export async function handlePrices(request: Request, _env: Env): Promise<Response> {
  // Pass through to origin server - Cloudflare won't re-trigger this Worker
  const response = await fetch(request);
  return response;
}
