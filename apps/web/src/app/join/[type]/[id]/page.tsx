import type { Metadata } from 'next';

// ─── Types ──────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ ref?: string }>;
}

interface StreamData {
  id: string;
  title: string;
  type: string;
  creator: string;
  creatorHandle?: string;
  description?: string;
  thumbnail?: string;
  streamUrl?: string;
  isLive: boolean;
  viewerCount: number;
  speakerCount?: number;
  listenerCount?: number;
  startedAt?: number;
}

// ─── Protocol display info ────────────────────────────────────────────

const PROTOCOL_INFO: Record<string, { name: string; icon: string; color: string }> = {
  farcaster: { name: 'Farcaster', icon: 'FC', color: '#8a63d2' },
  bluesky: { name: 'Bluesky', icon: '☁️', color: '#1185fe' },
  mastodon: { name: 'Mastodon', icon: '🐘', color: '#6364ff' },
  nostr: { name: 'Nostr', icon: '⚡', color: '#e8792b' },
  lens: { name: 'Lens', icon: '🌿', color: '#00501e' },
  threads: { name: 'Threads', icon: '🧵', color: '#101010' },
  telegram: { name: 'Telegram', icon: '✈️', color: '#0088cc' },
};

// ─── Metadata ─────────────────────────────────────────────────────────

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { type, id } = await params;
  const { ref } = await searchParams;

  const baseTitle = type === 'space' ? 'Audio Space' : 'Live Stream';
  const protocol = ref ? PROTOCOL_INFO[ref] : null;
  const titleSuffix = protocol ? ` via ${protocol.name}` : '';

  return {
    title: `${baseTitle}${titleSuffix} — DegenFeed`,
    description: `Join this ${type} on DegenFeed${titleSuffix}. Watch live or listen in.`,
    openGraph: {
      title: `${baseTitle} on DegenFeed${titleSuffix}`,
      description: `Join this ${type} on DegenFeed.`,
      type: type === 'space' ? 'music' : 'video.other',
      siteName: 'DegenFeed',
    },
    twitter: {
      card: 'summary_large_image',
    },
  };
}

// ─── Server Component ─────────────────────────────────────────────────

export default async function JoinPage({ params, searchParams }: Props) {
  const { type, id } = await params;
  const { ref } = await searchParams;

  if (!['stream', 'space', 'coin-launch'].includes(type)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Invalid content type</h1>
          <p className="mt-2 text-gray-400">
            &quot;{type}&quot; is not valid. Use stream, space, or coin-launch.
          </p>
          <a href="https://app.degenfeed.xyz" className="mt-4 inline-block text-[#ff0040] hover:underline">
            Go to DegenFeed
          </a>
        </div>
      </div>
    );
  }

  // Try to fetch stream data server-side
  const streamData = await fetchStreamData(type, id);

  const protocol = ref ? PROTOCOL_INFO[ref] : null;

  return (
    <JoinPageContent
      type={type}
      id={id}
      streamData={streamData}
      protocol={protocol}
    />
  );
}

// ─── Data fetching ────────────────────────────────────────────────────

async function fetchStreamData(type: string, id: string): Promise<StreamData | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.degenfeed.xyz';

  try {
    const res = await fetch(`${apiBase}/api/streams/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(5_000),
      headers: { accept: 'application/json' },
    });

    if (res.ok) {
      const body = (await res.json()) as { stream?: StreamData };
      if (body.stream) return body.stream;
    }

    // Fallback to stream KV lookup
    const fallbackRes = await fetch(`${apiBase}/api/farcaster/frames/${type}/${id}`, {
      signal: AbortSignal.timeout(3_000),
    });

    if (fallbackRes.ok) {
      // We got a frame — stream exists but we don't have full data
      return {
        id,
        title: type === 'space' ? 'Audio Space' : 'Live Stream',
        type,
        creator: '',
        isLive: true,
        viewerCount: 0,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Client Component (interactive) ───────────────────────────────────

function JoinPageContent({
  type,
  id,
  streamData,
  protocol,
}: {
  type: string;
  id: string;
  streamData: StreamData | null;
  protocol: { name: string; icon: string; color: string } | null;
}) {
  const isLive = streamData?.isLive ?? true;
  const title = streamData?.title || (type === 'space' ? 'Audio Space' : 'Live Stream');
  const description = streamData?.description || '';
  const creatorHandle = streamData?.creatorHandle || streamData?.creator?.slice(0, 10) || 'DegenFeed Creator';
  const thumbnail = streamData?.thumbnail || null;
  const streamUrl = streamData?.streamUrl || `https://app.degenfeed.xyz/live/${id}`;
  const viewerCount = streamData?.viewerCount ?? 0;
  const speakers = streamData?.speakerCount ?? 0;
  const listeners = streamData?.listenerCount ?? 0;

  return (
    <div className="relative min-h-screen bg-black text-white">
      {/* Background gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#ff0040]/10 via-black to-black"
        aria-hidden="true"
      />

      {/* Protocol banner */}
      {protocol && (
        <div
          className="relative z-10 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium"
          style={{ backgroundColor: protocol.color + '20', borderBottom: `1px solid ${protocol.color}40` }}
        >
          <span>{protocol.icon}</span>
          <span>
            You&apos;re joining from <strong>{protocol.name}</strong>
          </span>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] max-w-4xl flex-col items-center justify-center px-4 py-12">
        {/* Live badge */}
        <div className="mb-4 flex items-center gap-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff0040] px-3 py-1 text-xs font-bold uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-700 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gray-300">
              Offline
            </span>
          )}
          <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-medium text-gray-400">
            {type === 'space' ? 'Audio Space' : type === 'coin-launch' ? 'Coin Launch' : 'Live Stream'}
          </span>
        </div>

        {/* Thumbnail */}
        <div className="relative mb-6 w-full max-w-2xl overflow-hidden rounded-2xl bg-gray-900">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={title}
              className="h-full w-full object-cover"
              style={{ maxHeight: '360px' }}
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
              <div className="text-center">
                <div className="mb-2 text-5xl">
                  {type === 'space' ? '🎙️' : type === 'coin-launch' ? '🚀' : '📺'}
                </div>
                <p className="text-sm text-gray-500">No preview available</p>
              </div>
            </div>
          )}
        </div>

        {/* Title and creator */}
        <h1 className="mb-2 text-center text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && (
          <p className="mb-4 max-w-lg text-center text-gray-400">{description}</p>
        )}
        <p className="mb-6 text-sm text-gray-500">
          by <span className="font-medium text-gray-300">{creatorHandle}</span>
        </p>

        {/* Stats */}
        <div className="mb-8 flex gap-6 text-center">
          <div>
            <div className="text-lg font-bold">{formatNumber(viewerCount)}</div>
            <div className="text-xs text-gray-500">Viewers</div>
          </div>
          {type === 'space' && (
            <>
              <div>
                <div className="text-lg font-bold">{speakers}</div>
                <div className="text-xs text-gray-500">Speakers</div>
              </div>
              <div>
                <div className="text-lg font-bold">{listeners}</div>
                <div className="text-xs text-gray-500">Listeners</div>
              </div>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href={streamUrl}
            className="inline-flex items-center gap-2 rounded-full bg-[#ff0040] px-8 py-3 font-bold text-white transition-all hover:bg-[#e00038] hover:scale-105"
          >
            {type === 'space' ? (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                Join Space
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Watch Stream
              </>
            )}
          </a>

          {type === 'space' && (
            <button className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900 px-6 py-3 text-sm font-medium text-gray-300 transition-all hover:border-gray-600 hover:text-white">
              Request to Speak
            </button>
          )}

          {protocol && (
            <a
              href={streamUrl}
              className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900 px-6 py-3 text-sm font-medium text-gray-300 transition-all hover:border-gray-600 hover:text-white"
            >
              Open on DegenFeed
            </a>
          )}
        </div>

        {/* Protocol-share links */}
        {protocol && (
          <div className="mt-12 text-center">
            <p className="mb-3 text-xs text-gray-600">Share this {type}</p>
            <div className="flex justify-center gap-3">
              {Object.entries(PROTOCOL_INFO).map(([key, p]) => (
                <a
                  key={key}
                  href={`https://app.degenfeed.xyz/join/${type}/${id}?ref=${key}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 text-sm transition-all hover:bg-gray-700"
                  title={`Open on ${p.name}`}
                >
                  {p.icon}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Powered by */}
        <div className="mt-12 text-xs text-gray-600">
          Powered by{' '}
          <a href="https://app.degenfeed.xyz" className="text-[#ff0040] hover:underline">
            DegenFeed
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
