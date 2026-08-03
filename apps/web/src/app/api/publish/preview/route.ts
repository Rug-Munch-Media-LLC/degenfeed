import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../_auth';
export const dynamic = 'force-dynamic';

/**
 * GET /api/publish/preview?text=...&protocols=nostr,mastodon&title=...&hashtags=...
 *
 * Returns per-protocol preview text so the composer can show "how it looks on
 * each network" without hitting the network. Content is adapted per protocol:
 * character truncation, hashtag placement, CW prefix, etc.
 *
 * Response: { previews: { nostr: string, mastodon: string, ... } }
 */

const PROTOCOL_LIMITS: Record<string, number> = {
  nostr: 50000,
  farcaster: 320,
  bluesky: 300,
  mastodon: 500,
  lens: 5000,
  threads: 500,
  reddit: 40000,
  telegram: 4096,
  discord: 2000,
  lemmy: 50000,
};

function truncate(text: string, limit: number): string {
  if (limit <= 0 || text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function adaptForProtocol(
  content: string,
  _title: string,
  hashtags: string[],
  protocol: string,
  options?: Record<string, unknown>,
): string {
  const limit = PROTOCOL_LIMITS[protocol] ?? 5000;
  const hashtagBlock = hashtags.length > 0 ? `\n\n${hashtags.map((h) => `#${h}`).join(' ')}` : '';

  switch (protocol) {
    case 'mastodon': {
      const cw =
        options?.mastodon && typeof options.mastodon === 'object'
          ? String((options.mastodon as Record<string, unknown>).cw ?? '')
          : '';
      const visibility =
        options?.mastodon && typeof options.mastodon === 'object'
          ? String((options.mastodon as Record<string, unknown>).visibility ?? 'public')
          : 'public';
      const body = cw ? `[CW: ${cw}]\n\n${content}` : content;
      return `${truncate(`${body}${hashtagBlock}`, limit)}\n\n(visibility: ${visibility})`;
    }
    case 'bluesky': {
      const labels =
        options?.bluesky && typeof options.bluesky === 'object'
          ? (options.bluesky as Record<string, unknown>).labels
          : undefined;
      const labelBlock =
        Array.isArray(labels) && labels.length > 0 ? `\n\n[labels: ${labels.join(', ')}]` : '';
      return truncate(`${content}${hashtagBlock}${labelBlock}`, limit);
    }
    case 'nostr':
      // Nostr has no practical limit; show as-is with NIP-05 note if set
      return content + hashtagBlock;
    case 'farcaster': {
      const channel =
        options?.farcaster && typeof options.farcaster === 'object'
          ? String((options.farcaster as Record<string, unknown>).channel ?? '')
          : '';
      const channelBlock = channel ? `\n\n(/${channel})` : '';
      return truncate(`${content}${hashtagBlock}${channelBlock}`, limit);
    }
    default:
      return truncate(`${content}${hashtagBlock}`, limit);
  }
}

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const text = (url.searchParams.get('text') || '').trim();
  const title = url.searchParams.get('title') || '';
  const hashtags = (url.searchParams.get('hashtags') || '')
    .split(',')
    .map((h) => h.trim().replace(/^#/, ''))
    .filter(Boolean);
  const protocolsRaw = url.searchParams.get('protocols') || 'nostr,mastodon,bluesky';
  const protocols = protocolsRaw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => PROTOCOL_LIMITS[p] !== undefined);

  if (!text) {
    return NextResponse.json({ previews: {} });
  }

  let options: Record<string, unknown> | undefined;
  const optionsRaw = url.searchParams.get('options');
  if (optionsRaw) {
    try {
      options = JSON.parse(optionsRaw) as Record<string, unknown>;
    } catch {
      options = undefined;
    }
  }

  const previews: Record<string, string> = {};
  for (const protocol of protocols) {
    previews[protocol] = adaptForProtocol(text, title, hashtags, protocol, options);
  }

  return NextResponse.json({ previews });
}
