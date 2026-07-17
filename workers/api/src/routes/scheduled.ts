import { type Env, jsonResponse } from '../index';

export async function handleSchedulePost(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body: { text: string; targets: string[]; scheduledAt: string };
  try {
    body = (await request.json()) as { text: string; targets: string[]; scheduledAt: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const { text, targets, scheduledAt } = body;

  if (!text || !targets?.length || !scheduledAt) {
    return jsonResponse({ error: 'text, targets, and scheduledAt required' }, 400);
  }

  const id = crypto.randomUUID();
  const entry = {
    id,
    text,
    targets,
    scheduledAt,
    createdAt: new Date().toISOString(),
  };

  try {
    await env.CACHE?.put(`scheduled:${id}`, JSON.stringify(entry), {
      expirationTtl: 60 * 60 * 24 * 30, // 30 days
    });
    return jsonResponse({ ok: true, id });
  } catch {
    return jsonResponse({ error: 'Failed to persist scheduled post' }, 500);
  }
}
