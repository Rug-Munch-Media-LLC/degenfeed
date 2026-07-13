/**
 * Farcaster Frame resolver — fetches frame HTML and parses fc:frame meta tags.
 *
 * GET /api/frame/resolve?url=https://...
 * POST /api/frame/action — submits frame button action (POST to frame's postUrl)
 */

import { type Env, jsonResponse } from '../index';
import { isValidFetchUrl, safeFetch } from '../sanitize';

interface FrameData {
  url: string;
  image: string;
  title?: string;
  buttons: Array<{ index: number; label: string; action?: string; target?: string }>;
  postUrl?: string;
  input?: { text?: string };
  state?: string;
  version: string;
  fetchedAt: number;
}

export async function handleFrameResolve(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) return jsonResponse({ error: 'url required' }, 400);
  if (!isValidFetchUrl(url)) return jsonResponse({ error: 'Invalid URL' }, 400);

  const cacheKey = `frame:${encodeURIComponent(url)}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* ignore */
  }

  try {
    const frame = await fetchAndParseFrame(url);
    if (!frame) return jsonResponse({ error: 'No frame found at URL' }, 404);

    try {
      await env.CACHE?.put(cacheKey, JSON.stringify(frame), { expirationTtl: 300 });
    } catch {
      /* ignore */
    }

    return jsonResponse(frame);
  } catch {
    return jsonResponse({ error: 'Failed to fetch frame' }, 502);
  }
}

export async function handleFrameAction(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      postUrl?: string;
      buttonIndex?: number;
      inputText?: string;
      state?: string;
    };
    if (!body.postUrl) return jsonResponse({ error: 'postUrl required' }, 400);
    if (!isValidFetchUrl(body.postUrl)) return jsonResponse({ error: 'Invalid postUrl' }, 400);

    const formData = new URLSearchParams();
    if (body.buttonIndex !== undefined) formData.set('buttonIndex', String(body.buttonIndex));
    if (body.inputText) formData.set('inputText', body.inputText);
    if (body.state) formData.set('state', body.state);

    const res = await safeFetch(body.postUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'DegenFeed/0.1 (Frame; +https://degenfeed.xyz)',
      },
      body: formData.toString(),
    });
    if (!res.ok) return jsonResponse({ error: `Frame action failed: ${res.status}` }, 502);

    const html = await res.text();
    const frame = parseFrameMeta(html, body.postUrl);
    if (!frame) return jsonResponse({ error: 'Invalid frame response' }, 502);

    return jsonResponse(frame);
  } catch {
    return jsonResponse({ error: 'Frame action failed' }, 502);
  }
}

async function fetchAndParseFrame(url: string): Promise<FrameData | null> {
  const res = await safeFetch(url, {
    headers: { 'user-agent': 'DegenFeed/0.1 (Frame; +https://degenfeed.xyz)' },
  });
  if (!res.ok) return null;
  const html = await res.text();
  return parseFrameMeta(html, url);
}

function parseFrameMeta(html: string, url: string): FrameData | null {
  const getMeta = (name: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      'i',
    );
    return html.match(re)?.[1];
  };

  const version = getMeta('fc:frame') || getMeta('of:version');
  const image = getMeta('fc:frame:image') || getMeta('of:image');
  if (!version || !image) return null;

  const frame: FrameData = {
    url,
    image,
    version,
    buttons: [],
    fetchedAt: Date.now(),
  };

  const title = getMeta('fc:frame:title') || getMeta('of:title');
  if (title) frame.title = title;

  const postUrl = getMeta('fc:frame:post_url') || getMeta('of:post_url');
  if (postUrl) frame.postUrl = postUrl;

  const inputText = getMeta('fc:frame:input:text') || getMeta('of:input:text');
  if (inputText) frame.input = { text: inputText };

  const state = getMeta('fc:frame:state') || getMeta('of:state');
  if (state) frame.state = state;

  for (let i = 1; i <= 4; i++) {
    const label = getMeta(`fc:frame:button:${i}`) || getMeta(`of:button:${i}`);
    if (!label) continue;
    const action =
      getMeta(`fc:frame:button:${i}:action`) || getMeta(`of:button:${i}:action`) || 'post';
    const target = getMeta(`fc:frame:button:${i}:target`);
    frame.buttons.push({ index: i, label, action, target });
  }

  return frame;
}
