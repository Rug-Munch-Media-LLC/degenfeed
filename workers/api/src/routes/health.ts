import { DEFAULT_RELAYS, type Env, jsonResponse } from '../index';

export async function handleRelaysHealth(env: Env): Promise<Response> {
  const relayUrls = (env.RELAY_URLS ?? '').split(',').filter(Boolean);
  const urls = relayUrls.length > 0 ? relayUrls : DEFAULT_RELAYS;

  const results: Record<string, string> = {};
  for (const url of urls.slice(0, 5)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const ws = new WebSocket(url);
      await new Promise((resolve, reject) => {
        ws.onopen = () => {
          ws.close();
          resolve(true);
        };
        ws.onerror = () => reject(new Error('connect failed'));
        setTimeout(() => reject(new Error('timeout')), 3000);
      });
      clearTimeout(timeout);
      results[url] = 'ok';
    } catch {
      results[url] = 'error';
    }
  }

  return jsonResponse({
    relays: results,
    healthy: Object.values(results).filter((r) => r === 'ok').length,
  });
}
