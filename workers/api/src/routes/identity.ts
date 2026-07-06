import { resolveHandle } from '@degenfeed/identity';
import { type Env, jsonResponse } from '../index';

export async function handleResolveIdentity(request: Request, _env: Env): Promise<Response> {
  const handle = new URL(request.url).searchParams.get('handle');
  if (!handle) {
    return jsonResponse({ error: 'Missing handle parameter' }, 400);
  }

  // Dynamic import to avoid worker size issues
  const result = await resolveHandle(handle);
  if (!result) {
    return jsonResponse({ error: 'Handle not found', handle }, 404);
  }

  return jsonResponse({ data: result });
}
