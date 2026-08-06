'use client';

/**
 * @degenfeed/web — ProtocolHealthBanner
 *
 * Per-protocol health banner shown at the top of each /feed/[protocol] page.
 * Uses REAL bridge health data:
 *   - Green: source live, provider healthy → "Nostr relay connected — N notes indexed"
 *   - Yellow: degraded (fallback / cache / sync) → "Farcaster using Nostr fallback while Hubble syncs"
 *   - Red: provider down → "Reddit data unavailable — Redlib instance down"
 *
 * The banner derives status from two live sources:
 *   1. The feed response meta (source: live|fallback|cached, errors, notices)
 *   2. The bridge health probe (GET /api/feed/health → sources.<protocol>.healthy)
 * It polls health every 60s so statuses stay current without a page reload.
 *
 * Demo/seed content is banned platform-wide, so there is no demo state to
 * display — the feed is either live, degraded, or empty.
 */

import { useCallback, useEffect, useState } from 'react';
import { getProtocolInfo } from './protocolMeta';

export interface HealthBannerMeta {
  total?: number;
  source?: string;
  errors?: string[];
  notices?: string[];
  perProtocol?: Record<string, number>;
  providerSources?: Record<string, string>;
}

type BannerLevel = 'green' | 'yellow' | 'red';

interface ProtocolHealthBannerProps {
  protocol: string;
  meta?: HealthBannerMeta;
}

interface HealthProbe {
  healthy?: boolean;
  status?: string;
}

/** Per-protocol copy templates for each health level. */
const LEVEL_COPY: Record<string, Partial<Record<BannerLevel, (n: number) => string>>> = {
  nostr: {
    green: (n) => `Nostr relay connected — ${n.toLocaleString()} notes indexed`,
    yellow: () => 'Nostr relay slow — using cached notes while reconnecting',
    red: () => 'Nostr relay unreachable — no notes available',
  },
  farcaster: {
    green: (n) => `Farcaster Hubble connected — ${n.toLocaleString()} casts indexed`,
    yellow: () => 'Farcaster using Nostr fallback while Hubble syncs',
    red: () => 'Farcaster unavailable — no casts from Hubble or Neynar',
  },
  bluesky: {
    green: (n) => `Bluesky PDS connected — ${n.toLocaleString()} posts indexed`,
    yellow: () => 'Bluesky degraded — using cached posts while PDS reconnects',
    red: () => 'Bluesky PDS unreachable — no posts available',
  },
  lens: {
    green: (n) => `Lens API connected — ${n.toLocaleString()} publications indexed`,
    yellow: () => 'Lens degraded — using cached publications while API recovers',
    red: () => 'Lens API unavailable — no publications available',
  },
  mastodon: {
    green: (n) => `Mastodon instance connected — ${n.toLocaleString()} toots indexed`,
    yellow: () => 'Mastodon degraded — using cached toots while instance reconnects',
    red: () => 'Mastodon instance unreachable — no toots available',
  },
  lemmy: {
    green: (n) => `Lemmy instance connected — ${n.toLocaleString()} posts indexed`,
    yellow: () => 'Lemmy degraded — using cached posts while instance reconnects',
    red: () => 'Lemmy instance unreachable — no posts available',
  },
  reddit: {
    green: (n) => `Reddit connected — ${n.toLocaleString()} posts indexed`,
    yellow: () => 'Reddit degraded — using cached posts while Redlib recovers',
    red: () => 'Reddit data unavailable — Redlib instance down',
  },
  rss: {
    green: (n) => `RSS aggregator connected — ${n.toLocaleString()} articles indexed`,
    yellow: () => 'RSS degraded — some sources unreachable',
    red: () => 'RSS sources unavailable — no articles available',
  },
};

function fallbackLevelCopy(
  _protocol: string,
  level: BannerLevel,
  info: { label: string; postNoun: string },
): string {
  if (level === 'green') return `${info.label} connected — live feed`;
  if (level === 'yellow') return `${info.label} degraded — using cached ${info.postNoun}s`;
  return `${info.label} unavailable — no ${info.postNoun}s available`;
}

const LEVEL_STYLE: Record<
  BannerLevel,
  { border: string; bg: string; text: string; dot: string; label: string; icon: string }
> = {
  green: {
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
    text: 'text-green-400',
    dot: 'bg-green-400',
    label: 'Healthy',
    icon: '●',
  },
  yellow: {
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/5',
    text: 'text-yellow-400',
    dot: 'bg-yellow-400',
    label: 'Degraded',
    icon: '⚠',
  },
  red: {
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    text: 'text-red-400',
    dot: 'bg-red-400',
    label: 'Offline',
    icon: '✕',
  },
};

export function ProtocolHealthBanner({ protocol, meta }: ProtocolHealthBannerProps) {
  const info = getProtocolInfo(protocol);
  const [probe, setProbe] = useState<HealthProbe | null>(null);
  const [probeState, setProbeState] = useState<'idle' | 'loading' | 'done'>('idle');

  const checkHealth = useCallback(async () => {
    try {
      setProbeState('loading');
      const res = await fetch('/api/feed/health', {
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });
      if (!res.ok) {
        setProbe(null);
        setProbeState('done');
        return;
      }
      const data = (await res.json()) as { sources?: Record<string, { healthy?: boolean }> };
      setProbe(data.sources?.[protocol] ?? null);
    } catch {
      setProbe(null);
    } finally {
      setProbeState('done');
    }
  }, [protocol]);

  useEffect(() => {
    void checkHealth();
    const id = setInterval(checkHealth, 60_000);
    return () => clearInterval(id);
  }, [checkHealth]);

  // ── Derive banner level from feed meta + live probe ─────────────
  const source = meta?.source ?? 'live';
  const hasErrors = (meta?.errors?.length ?? 0) > 0;
  const hasDegradedNotice =
    (meta?.notices ?? []).some((n) => /fallback|degraded|cached|sync/i.test(n)) ||
    source === 'cached' ||
    source === 'fallback';

  let level: BannerLevel = 'green';
  if (hasErrors) {
    level = 'red';
  } else if (probeState === 'done' && probe && probe.healthy === false) {
    level = 'red';
  } else if (hasDegradedNotice) {
    level = 'yellow';
  } else if (probeState === 'done' && probe && probe.healthy === true) {
    level = 'green';
  }

  const count = meta?.total ?? 0;
  const copyTemplates = LEVEL_COPY[protocol] ?? {};
  const template = copyTemplates[level];
  const message = template ? template(count) : fallbackLevelCopy(protocol, level, info);
  const style = LEVEL_STYLE[level];

  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${style.border} ${style.bg}`}
      role="status"
      aria-label={`${info.label} feed health: ${style.label}`}
    >
      <span className={`mt-0.5 shrink-0 text-sm ${style.text}`} aria-hidden="true">
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${style.dot}`}
            style={{ boxShadow: level === 'green' ? '0 0 6px rgba(34,197,94,0.7)' : undefined }}
            aria-hidden="true"
          />
          <p className={`text-xs font-medium ${style.text}`}>{message}</p>
        </div>
        <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
          {info.label} · {style.label}
          {probeState === 'loading' ? ' · probing…' : ''}
          {probeState === 'done' && !probe ? ' · no bridge probe' : ''}
        </p>
      </div>
      {hasDegradedNotice && level !== 'red' && (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide"
          style={{ backgroundColor: `${info.color}18`, color: info.color }}
        >
          fallback
        </span>
      )}
    </div>
  );
}
