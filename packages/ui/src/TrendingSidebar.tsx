/**
 * @degenfeed/ui — TrendingSidebar
 *
 * A "What's Happening" sidebar showing trending topics, active communities,
 * popular videos, live spaces, Nostr trending, Farcaster trending, and top tippers.
 * Pure presentational — data is passed via props (container handles fetching).
 */

'use client';

// ─── Types ────────────────────────────────────────────────────────────────

export interface TrendingTopic {
  topic: string;
  count: number;
  score: number;
  change: number;
}

export interface ActiveCommunity {
  id: string;
  name: string;
  displayName?: string;
  icon?: string;
  memberCount: number;
  protocol: string;
}

export interface PopularVideo {
  id: string;
  title: string;
  platform: 'peertube' | 'youtube';
  url: string;
  thumbnailUrl?: string;
  authorName: string;
  viewCount: number;
}

export interface LiveSpace {
  id: string;
  title: string;
  hostName: string;
  hostAvatarUrl?: string;
  listenerCount: number;
  speakerCount: number;
}

export interface TrendingNostrNote {
  id: string;
  content: string;
  authorName: string;
  authorAvatar?: string;
  likes: number;
  replies: number;
}

export interface TrendingFarcasterCast {
  hash: string;
  text: string;
  authorName: string;
  authorAvatar?: string;
  likes: number;
  recasts: number;
}

export interface TopTipper {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  amountUsd: number;
  tipCount: number;
}

export interface TrendingSidebarData {
  topics: TrendingTopic[];
  communities: ActiveCommunity[];
  videos: PopularVideo[];
  spaces: LiveSpace[];
  nostr: TrendingNostrNote[];
  farcaster: TrendingFarcasterCast[];
  tippers: TopTipper[];
  fetchedAt: number;
}

export interface TrendingSidebarProps {
  /** Trending data from the API. If null/undefined, shows loading state. */
  data?: TrendingSidebarData | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function TrendArrow({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-degen-400">
        <span aria-hidden="true">↑</span>
        <span>{change}%</span>
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-400">
        <span aria-hidden="true">↓</span>
        <span>{Math.abs(change)}%</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--color-muted)]">
      <span aria-hidden="true">–</span>
      <span>0%</span>
    </span>
  );
}

// ─── Section Shell ────────────────────────────────────────────────────────

function SectionShell({
  title,
  seeMoreHref,
  children,
}: {
  title: string;
  seeMoreHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--color-fg)]">{title}</h2>
        <a
          href={seeMoreHref}
          className="text-[10px] font-medium text-degen-400 hover:text-degen-300 transition-colors"
        >
          See more →
        </a>
      </div>
      {children}
    </div>
  );
}

// ─── Section: Trending Topics ─────────────────────────────────────────────

function TrendingTopicsSection({ topics }: { topics: TrendingTopic[] }) {
  if (topics.length === 0) {
    return (
      <SectionShell title="🔥 Trending Topics" seeMoreHref="/trending">
        <p className="text-xs text-gray-500">Trending topics appear as you browse.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell title="🔥 Trending Topics" seeMoreHref="/trending">
      <div className="space-y-2">
        {topics.map((t) => (
          <a
            key={t.topic}
            href={`/feed?topic=${encodeURIComponent(t.topic.toLowerCase())}`}
            className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--color-fg)]">{t.topic}</span>
              <TrendArrow change={t.change} />
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-muted)]">
              {formatNumber(t.count)} posts
            </div>
          </a>
        ))}
      </div>
    </SectionShell>
  );
}

// ─── Section: Active Communities ──────────────────────────────────────────

function CommunitiesSection({ communities }: { communities: ActiveCommunity[] }) {
  return (
    <SectionShell title="🏛️ Active Communities" seeMoreHref="/c">
      {communities.length === 0 ? (
        <p className="text-xs text-gray-500">No communities yet.</p>
      ) : (
        <div className="space-y-2">
          {communities.map((c) => (
            <a
              key={c.id}
              href={`/c/${encodeURIComponent(c.name.toLowerCase().replace(/^r\//, ''))}`}
              className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-white/5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-degen-500/15 text-sm font-bold text-degen-400">
                {c.icon ?? (c.name[0] ?? '?').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[var(--color-fg)]">
                  {c.displayName ?? c.name}
                </div>
                <div className="text-[11px] text-[var(--color-muted)]">
                  {formatNumber(c.memberCount)} members · {c.protocol}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ─── Section: Popular Videos ──────────────────────────────────────────────

function VideosSection({ videos }: { videos: PopularVideo[] }) {
  return (
    <SectionShell title="🎬 Popular Videos" seeMoreHref="/videos">
      {videos.length === 0 ? (
        <p className="text-xs text-gray-500">No trending videos right now.</p>
      ) : (
        <div className="space-y-2">
          {videos.map((v) => (
            <a
              key={v.id}
              href={v.url}
              target="_blank" rel="noopener noreferrer"
              className="group flex gap-2.5 rounded-xl p-2 transition-colors hover:bg-white/5"
            >
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-black/40">
                {v.thumbnailUrl ? (
                  // biome-ignore lint/performance/noImgElement: shared UI pkg, not Next.js-specific
                  <img
                    src={v.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-500">
                    ▶
                  </div>
                )}
                <div className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 py-0.5 text-[9px] font-medium text-white">
                  {v.platform === 'peertube' ? 'PT' : 'YT'}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-xs font-medium text-[var(--color-fg)] group-hover:text-degen-400 transition-colors">
                  {v.title}
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">{v.authorName}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ─── Section: Live Spaces ─────────────────────────────────────────────────

function SpacesSection({ spaces }: { spaces: LiveSpace[] }) {
  return (
    <SectionShell title="🎙️ Live Spaces" seeMoreHref="/spaces">
      {spaces.length === 0 ? (
        <p className="text-xs text-gray-500">No live spaces right now.</p>
      ) : (
        <div className="space-y-2">
          {spaces.map((s) => (
            <a
              key={s.id}
              href="/spaces"
              className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-white/5"
            >
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-degen-500/20">
                <span className="absolute h-2 w-2 animate-pulse rounded-full bg-degen-400" />
                <span className="sr-only">Live</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[var(--color-fg)]">{s.title}</div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                  <span>{s.hostName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatNumber(s.listenerCount)} listening</span>
                  {s.speakerCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{s.speakerCount} speaking</span>
                    </>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ─── Section: Hot on Nostr ────────────────────────────────────────────────

function NostrSection({ notes }: { notes: TrendingNostrNote[] }) {
  return (
    <SectionShell title="⚡ Hot on Nostr" seeMoreHref="/trending?source=nostr">
      {notes.length === 0 ? (
        <p className="text-xs text-gray-500">No trending notes.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <a
              key={n.id}
              href={`/feed?protocols=nostr`}
              className="block rounded-xl p-2 transition-colors hover:bg-white/5"
            >
              <p className="line-clamp-2 text-xs text-[var(--color-fg)]">{n.content}</p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
                <span className="font-medium text-degen-400">{n.authorName}</span>
                <span aria-hidden="true">·</span>
                <span>♡ {formatNumber(n.likes)}</span>
                <span aria-hidden="true">·</span>
                <span>↩ {formatNumber(n.replies)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ─── Section: Trending on Farcaster ───────────────────────────────────────

function FarcasterSection({ casts }: { casts: TrendingFarcasterCast[] }) {
  return (
    <SectionShell title="🟣 Trending on Farcaster" seeMoreHref="/trending?source=farcaster">
      {casts.length === 0 ? (
        <p className="text-xs text-gray-500">No trending casts.</p>
      ) : (
        <div className="space-y-2">
          {casts.map((c) => (
            <a
              key={c.hash}
              href={`/feed?protocols=farcaster`}
              className="block rounded-xl p-2 transition-colors hover:bg-white/5"
            >
              <p className="line-clamp-2 text-xs text-[var(--color-fg)]">{c.text}</p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
                <span className="font-medium text-[#8a63d2]">{c.authorName}</span>
                <span aria-hidden="true">·</span>
                <span>♡ {formatNumber(c.likes)}</span>
                <span aria-hidden="true">·</span>
                <span>🔁 {formatNumber(c.recasts)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ─── Section: Top Tippers ─────────────────────────────────────────────────

function TippersSection({ tippers }: { tippers: TopTipper[] }) {
  if (tippers.length === 0) {
    return (
      <SectionShell title="🏆 Top Tippers" seeMoreHref="/leaderboard">
        <p className="text-xs text-gray-500">No tipper data yet.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell title="🏆 Top Tippers" seeMoreHref="/leaderboard">
      <div className="space-y-2">
        {tippers.map((t, i) => (
          <a
            key={t.id}
            href={`/profile/${encodeURIComponent(t.handle || t.id)}`}
            className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-white/5"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-degen-400">
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
            </span>
            {t.avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: shared UI pkg, not Next.js-specific
              <img
                src={t.avatarUrl}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-[10px] font-bold text-degen-400"
                aria-hidden="true"
              >
                {t.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-[var(--color-fg)]">{t.name}</div>
              <div className="text-[10px] text-[var(--color-muted)]">
                {formatNumber(t.tipCount)} tips
              </div>
            </div>
            <span className="text-xs font-semibold text-degen-400">
              ${formatNumber(t.amountUsd)}
            </span>
          </a>
        ))}
      </div>
    </SectionShell>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

/**
 * TrendingSidebar — pure presentational component.
 *
 * Renders all trending sections. The parent container is responsible for
 * fetching data from GET /api/trending/sidebar and passing it via `data`.
 *
 * Desktop-only in normal usage (feed page), but can be embedded anywhere.
 */
export function TrendingSidebar({ data }: TrendingSidebarProps) {
  const loading = !data;
  const topics = data?.topics ?? [];
  const communities = data?.communities ?? [];
  const videos = data?.videos ?? [];
  const spaces = data?.spaces ?? [];
  const nostr = data?.nostr ?? [];
  const farcaster = data?.farcaster ?? [];
  const tippers = data?.tippers ?? [];

  return (
    <div className="space-y-4">
      {/* What's Happening header */}
      <div className="rounded-2xl border border-white/10 bg-[var(--color-card)] p-4 backdrop-blur-xl">
        <h2 className="text-base font-bold text-[var(--color-fg)]">What&apos;s Happening</h2>
        {loading && <p className="mt-2 text-xs text-gray-500">Loading…</p>}
      </div>

      {/* Trending Topics */}
      <TrendingTopicsSection topics={topics} />

      {/* Active Communities */}
      <CommunitiesSection communities={communities} />

      {/* Popular Videos */}
      <VideosSection videos={videos} />

      {/* Live Spaces */}
      <SpacesSection spaces={spaces} />

      {/* Hot on Nostr */}
      <NostrSection notes={nostr} />

      {/* Trending on Farcaster */}
      <FarcasterSection casts={farcaster} />

      {/* Top Tippers */}
      <TippersSection tippers={tippers} />
    </div>
  );
}
