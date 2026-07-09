import { type Env, jsonResponse } from '../index';

export async function handleDiscover(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const instance = url.searchParams.get('instance') || 'https://bitcoinhackers.org';
  const limit = 20;

  try {
    // Fetch the public directory/trending accounts from the instance
    const res = await fetch(`${instance}/api/v1/directory?limit=${limit}&order=active&local=true`, {
      headers: { 'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)' },
    });
    if (!res.ok) return jsonResponse({ error: 'Instance unavailable' }, 502);
    const data = (await res.json()) as Array<{
      id: string;
      username: string;
      acct: string;
      display_name: string;
      avatar: string;
      note: string;
      followers_count: number;
    }>;
    const result = data.map((a) => ({
      ...a,
      instance: new URL(instance).hostname,
    }));
    return jsonResponse(result);
  } catch {
    return jsonResponse({ error: 'Discovery failed' }, 500);
  }
}
