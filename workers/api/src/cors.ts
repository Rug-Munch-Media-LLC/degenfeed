export const ALLOWED_ORIGINS = new Set([
  'https://degenfeed.xyz',
  'https://app.degenfeed.xyz',
  'https://social.degenfeed.xyz',
  'http://localhost:3000',
]);

export function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.has(origin);
}

export function parseOriginHeader(header: string | null): string | null {
  if (!header) return null;
  try {
    return new URL(header).origin;
  } catch {
    return null;
  }
}

export function getAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  return isAllowedOrigin(origin) ? origin : null;
}

export function corsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'content-type, authorization');
  return headers;
}

export function applyCors(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of corsHeaders(origin)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
