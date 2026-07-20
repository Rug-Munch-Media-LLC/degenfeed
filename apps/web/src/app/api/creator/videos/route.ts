import { proxyGet } from '../../_proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/creator/videos
 *
 * Fetch all videos for the authenticated creator.
 * Supports filter: ?type=video|short and ?limit=N
 * Proxies to worker backend (KV-backed metadata store).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const typeParam = url.searchParams.get('type');
  if (typeParam === 'video' || typeParam === 'short') {
    params.set('type', typeParam);
  }
  const limitParam = url.searchParams.get('limit');
  if (limitParam) {
    params.set('limit', String(Math.min(Math.max(Number(limitParam) || 50, 1), 200)));
  }
  const qs = params.toString();
  return proxyGet(`/api/creator/videos${qs ? `?${qs}` : ''}`, request);
}
