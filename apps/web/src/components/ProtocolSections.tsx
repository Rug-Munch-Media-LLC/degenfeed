'use client';

import { useEffect, useState } from 'react';

// ─── Types (mirror worker protocol-sections route) ─────────────────────────

interface SectionItem {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  unit: string;
  url?: string;
  imageUrl?: string;
}

interface ProtocolSection {
  id: string;
  title: string;
  icon: string;
  items: SectionItem[];
}

interface ProtocolSectionsResponse {
  protocol: string;
  sections: ProtocolSection[];
  fetchedAt: number;
}

interface Props {
  protocol: string;
  color: string;
}

function formatValue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Protocol-specific curated sections shown above the feed:
 * Farcaster → Trending Channels / Popular Frames,
 * Lens → Top Collectors / Hot Mirrors,
 * Bluesky → Popular Custom Feeds / Trending Labels,
 * Nostr → Active Relays / Most Zapped,
 * Mastodon → Trending Hashtags / Popular Instances.
 */
export function ProtocolSections({ protocol, color }: Props) {
  const [sections, setSections] = useState<ProtocolSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const url = new URL('/api/feed/protocol-sections', window.location.origin);
        url.searchParams.set('protocol', protocol);
        const res = await fetch(url.toString(), { credentials: 'include' });
        if (!res.ok) throw new Error(`sections ${res.status}`);
        const data = (await res.json()) as ProtocolSectionsResponse;
        if (!cancelled) setSections(data.sections ?? []);
      } catch {
        if (!cancelled) setSections([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [protocol]);

  if (loading) {
    return (
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-muted)]/30"
          />
        ))}
      </div>
    );
  }

  const nonEmpty = sections.filter((s) => s.items.length > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {nonEmpty.map((section) => {
        const isChannelSection = section.id === 'channels' || section.id === 'trending-channels';
        const isRelaySection = section.id === 'relays' || section.id === 'active-relays';
        const isFrameSection = section.id === 'frames' || section.id === 'popular-frames';
        const isInstanceSection = section.id === 'instances' || section.id === 'popular-instances';
        const isHashtagSection = section.id === 'hashtags' || section.id === 'trending-hashtags';
        const isProfileSection =
          section.id === 'profiles' ||
          section.id === 'hot-profiles' ||
          section.id === 'top-collectors';
        const isFeedSection = section.id === 'feeds' || section.id === 'custom-feeds';

        return (
          <div
            key={section.id}
            className="rounded-xl border p-3"
            style={{ borderColor: `${color}22`, backgroundColor: `${color}06` }}
          >
            <h3
              className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
              style={{ color }}
            >
              <span aria-hidden="true">{section.icon}</span>
              {section.title}
              {isChannelSection && (
                <span className="ml-1 rounded bg-[var(--color-card)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--color-muted)]">
                  /channel
                </span>
              )}
              {isRelaySection && (
                <span className="ml-1 rounded bg-[var(--color-card)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--color-muted)]">
                  relay
                </span>
              )}
              {isFrameSection && (
                <span className="ml-1 rounded bg-[var(--color-card)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--color-muted)]">
                  frame
                </span>
              )}
            </h3>
            <ul className="space-y-1.5">
              {section.items.slice(0, 5).map((item, idx) => {
                const inner = (
                  <>
                    <span className="w-4 shrink-0 text-right text-[10px] tabular-nums text-[var(--color-muted)]">
                      {idx + 1}
                    </span>
                    {item.imageUrl && (
                      // biome-ignore lint/performance/noImgElement: external avatar URLs are dynamic
                      <img
                        src={item.imageUrl}
                        alt={`${item.label || 'Protocol'} icon`}
                        className="h-5 w-5 shrink-0 rounded-full object-cover"
                        loading="lazy"
                      />
                    )}
                    {/* Protocol-specific visual badges */}
                    {isChannelSection && !item.imageUrl && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold"
                        style={{ backgroundColor: `${color}22`, color }}
                      >
                        #
                      </span>
                    )}
                    {isRelaySection && !item.imageUrl && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px]"
                        style={{ backgroundColor: `${color}22`, color }}
                        title="Relay"
                      >
                        ⟳
                      </span>
                    )}
                    {isInstanceSection && !item.imageUrl && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold"
                        style={{ backgroundColor: `${color}22`, color }}
                      >
                        🏛
                      </span>
                    )}
                    {isFrameSection && !item.imageUrl && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px]"
                        style={{ backgroundColor: `${color}18` }}
                      >
                        🖼
                      </span>
                    )}
                    {isFeedSection && !item.imageUrl && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px]"
                        style={{ backgroundColor: `${color}22` }}
                      >
                        ☁
                      </span>
                    )}
                    {isHashtagSection && !item.imageUrl && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold"
                        style={{ color }}
                      >
                        #
                      </span>
                    )}
                    {isProfileSection && !item.imageUrl && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]"
                        style={{ backgroundColor: `${color}22`, color }}
                      >
                        {item.label.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-[var(--color-fg)]">
                        {/* Channel name styling */}
                        {isChannelSection && (
                          <span className="font-mono text-[10px] opacity-60" style={{ color }}>
                            /
                          </span>
                        )}
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span className="block truncate text-[10px] text-[var(--color-muted)]">
                          {/* Protocol-specific sublabel decorations */}
                          {isRelaySection && '🔄 '}
                          {isHashtagSection && '💬 '}
                          {item.sublabel}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs font-bold tabular-nums" style={{ color }}>
                        {formatValue(item.value)}
                      </span>
                      <span className="block text-[9px] text-[var(--color-muted)]">
                        {isChannelSection ? 'casts' : isRelaySection ? 'notes' : item.unit}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={item.id}>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-[var(--color-muted)]/50"
                      >
                        {inner}
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg px-1.5 py-1">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
