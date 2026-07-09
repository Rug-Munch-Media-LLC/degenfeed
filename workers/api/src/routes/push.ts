/**
 * PWA Push Notification Worker
 * 
 * Routes:
 *   POST /api/push/subscribe — store a push subscription in KV
 *   POST /api/push/send     — send a push to all subscribers (admin)
 */
import { jsonResponse, type Env } from "../index";

interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  subscribedAt: number;
}

export async function handlePushSubscribe(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as PushSubscription;
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return jsonResponse({ error: "Invalid subscription" }, 400);
    }
    const sub: PushSubscription = { ...body, subscribedAt: Date.now() };
    await env.CACHE?.put(`push:sub:${body.endpoint}`, JSON.stringify(sub), { expirationTtl: 30 * 86400 });
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }
}

export async function handlePushSend(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.ADMIN_API_KEY ?? ""}`) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const { title, body, icon, url } = await request.json() as {
      title: string; body: string; icon?: string; url?: string;
    };
    if (!title || !body) return jsonResponse({ error: "title and body required" }, 400);

    const subs = await listKVKeys(env.CACHE, "push:sub:");
    const payload = JSON.stringify({ title, body, icon: icon ?? "/icon-192.png", data: { url } });
    const results: { endpoint: string; ok: boolean; error?: string }[] = [];

    for (const key of subs) {
      const raw = await env.CACHE?.get(key);
      if (!raw) continue;
      const sub = JSON.parse(raw) as PushSubscription;
      try {
        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: payload,
        });
        results.push({ endpoint: sub.endpoint, ok: res.ok });
      } catch (e) {
        results.push({ endpoint: sub.endpoint, ok: false, error: String(e) });
      }
    }
    return jsonResponse({ sent: results.length, results });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

async function listKVKeys(kv: KVNamespace | undefined, prefix: string): Promise<string[]> {
  if (!kv) return [];
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const result = await kv.list({ prefix, cursor });
    keys.push(...result.keys.map((k) => k.name));
    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);
  return keys;
}
