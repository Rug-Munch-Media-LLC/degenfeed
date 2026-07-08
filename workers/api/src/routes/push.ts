/**
 * PWA Push Notification Worker
 *
 * Routes:
 *   POST /api/push/subscribe — store a push subscription in KV
 *   POST /api/push/send     — send a push to all subscribers (admin)
 *
 * VAPID keys (generate once):
 *   npx web-push generate-vapid-notes
 * Store in env: VAPID_SUBJECT (mailto:), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
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

async function buildVapidHeaders(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string,
): Promise<Record<string, string>> {
  const keyData = JSON.parse(publicKey) as { kty: string; crv: string; x: string; y: string };
  const privData = JSON.parse(privateKey) as { kty: string; crv: string; d: string; x: string; y: string };

  const pubKeyBytes = urlSafeBase64ToBytes(keyData.x + keyData.y);
  const privKeyBytes = urlSafeBase64ToBytes(privData.d);

  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC', crv: 'P-256',
      x: keyData.x, y: keyData.y,
      d: privData.d,
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 86400,
    sub: subject,
  };

  const encoder = new TextEncoder();
  const tokenParts = [
    urlSafeBase64(encoder.encode(JSON.stringify(header))),
    urlSafeBase64(encoder.encode(JSON.stringify(payload))),
  ].join('.');
  const sigBytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    encoder.encode(tokenParts),
  );
  const sig = urlSafeBase64(new Uint8Array(sigBytes));
  const jwt = `${tokenParts}.${sig}`;

  const vapidKey = urlSafeBase64(pubKeyBytes);

  return {
    'authorization': `vapid t=${jwt}, k=${vapidKey}`,
    'content-encoding': 'aes128gcm',
  };
}

function urlSafeBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function urlSafeBase64ToBytes(base64: string): Uint8Array {
  const str = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
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

    // Build VAPID headers if keys are configured
    let vapidHeaders: Record<string, string> | null = null;
    if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT) {
      try {
        const audience = new URL(subs[0]?.startsWith('{') ? '' : subs[0] || 'https://fcm.googleapis.com').origin;
        vapidHeaders = await buildVapidHeaders(
          audience,
          env.VAPID_SUBJECT,
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY,
        );
      } catch { /* vapid unavailable */ }
    }

    for (const key of subs) {
      const raw = await env.CACHE?.get(key);
      if (!raw) continue;
      const sub = JSON.parse(raw) as PushSubscription;
      try {
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (vapidHeaders) {
          // Derive audience per-endpoint for multi-browser support
          try {
            const endpointOrigin = new URL(sub.endpoint).origin;
            const endpointHeaders = await buildVapidHeaders(
              endpointOrigin,
              env.VAPID_SUBJECT || 'mailto:admin@degenfeed.xyz',
              env.VAPID_PUBLIC_KEY!,
              env.VAPID_PRIVATE_KEY!,
            );
            Object.assign(headers, endpointHeaders);
          } catch {
            Object.assign(headers, vapidHeaders);
          }
        }
        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers,
          body: payload,
        });
        results.push({ endpoint: sub.endpoint, ok: res.ok });
        // Clean up expired subscriptions (410 Gone)
        if (res.status === 410) {
          await env.CACHE?.delete(key).catch(() => {});
        }
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
