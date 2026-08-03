'use client';

/**
 * Creator Coin Community Hub
 *
 * A community page for each creator coin showing:
 *   - Telegram: Join button, member count, recent messages preview
 *   - Discord: Join button, member count, channel list
 *   - DegenFeed: On-platform posts tagged with coin, holder leaderboard
 *   - Cross-platform activity: Recent posts about this coin across all protocols
 *   - Events: Scheduled AMAs, community calls, voting
 */

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../../components/AuthProvider';
import { TelegramGroupEmbed } from '../../../../components/creator-coin/TelegramGroupEmbed';
import { useToast } from '../../../../components/Toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CoinCommunityData {
  symbol: string;
  name: string;
  price?: string;
  marketCap?: string;
  holders?: number;
  creator?: string;
  description?: string;

  telegram?: {
    exists: boolean;
    groupId?: string;
    title?: string;
    inviteLink?: string;
    memberCount?: number;
    recentMessages?: Array<{
      text: string;
      fromUser: string;
      timestamp: number;
    }>;
    feedEnabled?: boolean;
    tokenGated?: boolean;
    minHoldRequirement?: string;
  };

  discord?: {
    exists: boolean;
    guildName?: string;
    inviteUrl?: string;
    channels?: Array<{
      id: string;
      name: string;
    }>;
  };

  leaderboard?: Array<{
    wallet: string;
    amount: string;
    rank: number;
  }>;

  events?: Array<{
    id: string;
    title: string;
    type: 'ama' | 'call' | 'vote' | 'stream';
    date: string;
    description?: string;
    url?: string;
  }>;

  recentActivity?: Array<{
    id: string;
    protocol: string;
    text: string;
    author: string;
    timestamp: number;
  }>;
}

type Tab = 'overview' | 'telegram' | 'discord' | 'activity' | 'events' | 'holders';

// ─── Protocol emoji map ─────────────────────────────────────────────────────

const PROTOCOL_EMOJI: Record<string, string> = {
  telegram: '💬',
  discord: '🎮',
  farcaster: '🟣',
  lens: '🌿',
  nostr: '⚡',
  bluesky: '🦋',
  mastodon: '🐘',
  degenfeed: '🔗',
};

// ─── Community Overview Tab ─────────────────────────────────────────────────

function OverviewTab({ data, symbol }: { data: CoinCommunityData; symbol: string }) {
  const { showToast } = useToast();

  const handleTelegramJoin = useCallback(() => {
    if (data.telegram?.inviteLink) {
      window.open(data.telegram.inviteLink, '_blank');
    } else {
      showToast(
        'info',
        `Join the ${symbol} community on Telegram via /community ${symbol} in our bot`,
      );
    }
  }, [data.telegram, symbol, showToast]);

  const handleDiscordJoin = useCallback(() => {
    if (data.discord?.inviteUrl) {
      window.open(data.discord.inviteUrl, '_blank');
    } else {
      showToast('info', 'Discord server not yet set up');
    }
  }, [data.discord, showToast]);

  return (
    <div className="space-y-4">
      {/* Coin stats card */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500 to-purple-600 text-xl font-bold text-white">
            {symbol.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[var(--color-fg)]">{data.name || symbol}</h2>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              {data.price && (
                <span>
                  💵 Price: <strong className="text-degen-400">${data.price}</strong>
                </span>
              )}
              {data.marketCap && (
                <span>
                  📊 MCap: <strong className="text-[var(--color-fg)]">${data.marketCap}</strong>
                </span>
              )}
              {data.holders !== undefined && (
                <span>
                  👥 Holders:{' '}
                  <strong className="text-[var(--color-fg)]">
                    {data.holders.toLocaleString()}
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>
        {data.description && (
          <p className="mt-4 text-sm text-[var(--color-muted)] leading-relaxed">
            {data.description}
          </p>
        )}
        <div className="mt-4 flex items-center gap-2">
          <LinkButton href={`/coins/${symbol.toLowerCase()}`} variant="primary">
            View Coin Page
          </LinkButton>
          <LinkButton href={`/coins/${symbol.toLowerCase()}?buy=1`} variant="secondary">
            Buy {symbol}
          </LinkButton>
        </div>
      </div>

      {/* Quick connect card */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-2xl">💬</span>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">Telegram</h3>
              <p className="text-xs text-[var(--color-muted)]">
                {data.telegram?.exists
                  ? `${data.telegram.title || 'Community Group'}`
                  : 'No group yet'}
              </p>
            </div>
          </div>
          {data.telegram?.memberCount !== undefined && (
            <p className="mb-3 text-xs text-[var(--color-muted)]">
              👥 {data.telegram.memberCount} members
            </p>
          )}
          <button
            type="button"
            onClick={handleTelegramJoin}
            className="w-full rounded-lg bg-blue-500/20 px-4 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/30 transition-colors"
          >
            {data.telegram?.exists ? 'Join Telegram Group' : 'Create Telegram Group'}
          </button>
        </div>

        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-2xl">🎮</span>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">Discord</h3>
              <p className="text-xs text-[var(--color-muted)]">
                {data.discord?.exists ? data.discord.guildName || 'Server' : 'No server yet'}
              </p>
            </div>
          </div>
          {data.discord?.channels && (
            <p className="mb-3 text-xs text-[var(--color-muted)]">
              # {data.discord.channels.length} channels
            </p>
          )}
          <button
            type="button"
            onClick={handleDiscordJoin}
            className="w-full rounded-lg bg-indigo-500/20 px-4 py-2 text-xs font-medium text-indigo-400 hover:bg-indigo-500/30 transition-colors"
          >
            {data.discord?.exists ? 'Join Discord Server' : 'Create Discord Server'}
          </button>
        </div>
      </div>

      {/* Recent activity preview */}
      {data.recentActivity && data.recentActivity.length > 0 && (
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">Recent Activity</h3>
          <div className="space-y-2">
            {data.recentActivity.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-2"
              >
                <span className="text-sm">{PROTOCOL_EMOJI[item.protocol] || '🔗'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--color-fg)] line-clamp-1">{item.text}</p>
                  <p className="text-[10px] text-[var(--color-muted)]">
                    {item.author} · {formatTimeAgo(item.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming events preview */}
      {data.events && data.events.length > 0 && (
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">Upcoming Events</h3>
          <div className="space-y-2">
            {data.events.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-glass-border)] px-3 py-2"
              >
                <span className="text-lg">
                  {event.type === 'ama'
                    ? '🎤'
                    : event.type === 'call'
                      ? '📞'
                      : event.type === 'vote'
                        ? '🗳️'
                        : '📺'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--color-fg)]">{event.title}</p>
                  <p className="text-[10px] text-[var(--color-muted)]">
                    {new Date(event.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Telegram Tab ───────────────────────────────────────────────────────────

function TelegramTab({ data, symbol }: { data: CoinCommunityData; symbol: string }) {
  const telegramGroupData = data.telegram?.exists
    ? {
        groupId: data.telegram.groupId ?? '',
        title: data.telegram.title ?? `${symbol} Community`,
        inviteLink: data.telegram.inviteLink,
        memberCount: data.telegram.memberCount,
        feedEnabled: data.telegram.feedEnabled ?? true,
        tokenGated: data.telegram.tokenGated ?? false,
        minHoldRequirement: data.telegram.minHoldRequirement,
        recentMessages: data.telegram.recentMessages,
      }
    : null;

  return (
    <div className="space-y-4">
      <TelegramGroupEmbed
        symbol={symbol}
        coinName={data.name || symbol}
        groupData={telegramGroupData}
      />
      <div className="text-center text-[10px] text-[var(--color-muted)]">
        <p>
          💡 Use <code className="text-degen-400">/price</code>,{' '}
          <code className="text-degen-400">/buy</code>, or{' '}
          <code className="text-degen-400">/tip @user</code> in the chat above
        </p>
        <p className="mt-1">
          Or open directly in{' '}
          <a
            href={
              data.telegram?.inviteLink ?? `https://t.me/DegenFeedBot?start=community_${symbol}`
            }
            target="_blank"
            rel="noopener"
            className="text-blue-400 hover:underline"
          >
            Telegram ↗
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Discord Tab ────────────────────────────────────────────────────────────

function DiscordTab({ data, symbol: _symbol }: { data: CoinCommunityData; symbol?: string }) {
  const { showToast } = useToast();

  const handleInvite = useCallback(() => {
    if (data.discord?.inviteUrl) {
      window.open(data.discord.inviteUrl, '_blank');
    } else {
      showToast('info', 'Discord server not available');
    }
  }, [data.discord, showToast]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">
              {data.discord?.guildName || 'Discord Server'}
            </h3>
            <p className="text-xs text-[var(--color-muted)]">
              {data.discord?.exists ? 'Server active' : 'Not yet created'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleInvite}
            className="rounded-lg bg-indigo-500/20 px-4 py-2 text-xs font-medium text-indigo-400 hover:bg-indigo-500/30 transition-colors"
          >
            {data.discord?.exists ? 'Join' : 'Create'}
          </button>
        </div>

        {data.discord?.channels && data.discord.channels.length > 0 && (
          <div>
            <span className="text-xs font-medium text-[var(--color-muted)]">Channels</span>
            <div className="mt-2 space-y-1">
              {data.discord.channels.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5"
                >
                  <span className="text-xs text-[var(--color-muted)]">#</span>
                  <span className="text-xs text-[var(--color-fg)]">{ch.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!data.discord?.exists && (
          <div className="rounded-lg border border-dashed border-[var(--color-glass-border)] p-4 text-center">
            <p className="text-xs text-[var(--color-muted)]">
              No Discord server set up for this coin yet.
            </p>
            <p className="mt-1 text-[10px] text-[var(--color-muted)]">
              Creators can set up a Discord community via the Connected Accounts settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Activity Tab ───────────────────────────────────────────────────────────

function ActivityTab({ data }: { data: CoinCommunityData }) {
  if (!data.recentActivity || data.recentActivity.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] p-8 text-center">
        <p className="text-sm text-[var(--color-muted)]">No cross-platform activity yet.</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Posts mentioning {data.symbol} across all protocols will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.recentActivity.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <span>{PROTOCOL_EMOJI[item.protocol] || '🔗'}</span>
            <span className="text-xs font-medium text-[var(--color-fg)]">{item.author}</span>
            <span className="text-[10px] text-[var(--color-muted)]">via {item.protocol}</span>
            <span className="ml-auto text-[10px] text-[var(--color-muted)]">
              {formatTimeAgo(item.timestamp)}
            </span>
          </div>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed">{item.text}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Events Tab ─────────────────────────────────────────────────────────────

function EventsTab({ data }: { data: CoinCommunityData }) {
  const {} = useToast();
  if (!data.events || data.events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] p-8 text-center">
        <p className="text-sm text-[var(--color-muted)]">No upcoming events.</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Schedule AMAs, community calls, and governance votes here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.events.map((event) => (
        <div
          key={event.id}
          className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">
              {event.type === 'ama'
                ? '🎤'
                : event.type === 'call'
                  ? '📞'
                  : event.type === 'vote'
                    ? '🗳️'
                    : '📺'}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-[var(--color-fg)]">{event.title}</h4>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {new Date(event.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {event.description && (
                <p className="mt-2 text-xs text-[var(--color-muted)] leading-relaxed">
                  {event.description}
                </p>
              )}
              {event.url && (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener"
                  className="mt-2 inline-block rounded-lg bg-degen-500/15 px-3 py-1.5 text-xs font-medium text-degen-400 hover:bg-degen-500/25 transition-colors"
                >
                  Join Event ↗
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Holders / Leaderboard Tab ──────────────────────────────────────────────

function HoldersTab({ data }: { data: CoinCommunityData }) {
  if (!data.leaderboard || data.leaderboard.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] p-8 text-center">
        <p className="text-sm text-[var(--color-muted])">No holder data available.</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Holder leaderboard will appear once the coin has holders.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]">
      <div className="border-b border-[var(--color-glass-border)] px-5 py-3">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">Top {data.symbol} Holders</h3>
      </div>
      <div className="divide-y divide-[var(--color-glass-border)]">
        {data.leaderboard.map((holder) => (
          <div key={holder.wallet} className="flex items-center gap-3 px-5 py-3">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                holder.rank === 1
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : holder.rank === 2
                    ? 'bg-gray-400/20 text-gray-400'
                    : holder.rank === 3
                      ? 'bg-amber-600/20 text-amber-600'
                      : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
              }`}
            >
              {holder.rank}
            </span>
            <span className="flex-1 font-mono text-xs text-[var(--color-fg)]">
              {holder.wallet.slice(0, 6)}...{holder.wallet.slice(-4)}
            </span>
            <span className="text-xs font-medium text-degen-400">
              {Number(holder.amount).toLocaleString()} {data.symbol}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Link Button Component ──────────────────────────────────────────────────

function LinkButton({
  href,
  variant = 'primary',
  children,
}: {
  href: string;
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}) {
  const baseClass =
    variant === 'primary'
      ? 'rounded-lg bg-degen-500/20 px-4 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/30'
      : 'rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)]';

  return (
    <a href={href} className={`inline-block transition-colors ${baseClass}`}>
      {children}
    </a>
  );
}

// ─── Time formatter ─────────────────────────────────────────────────────────

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function CoinCommunityPage() {
  const params = useParams();
  const symbol = typeof params.symbol === 'string' ? params.symbol.toUpperCase() : '';
  const {} = useAuth();  const {} = useToast();
  const [data, setData] = useState<CoinCommunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Fetch community data
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        // Fetch coin + telegram + discord community data
        const [coinRes, tgCommunityRes, dcCommunityRes, activityRes] = await Promise.all([
          fetch(`/api/coins/${symbol}`, { cache: 'no-store' }).catch(() => null),
          fetch(`/api/telegram/link`, { cache: 'no-store' }).catch(() => null),
          fetch(`/api/discord/community/${symbol}`, { cache: 'no-store' }).catch(() => null),
          fetch(`/api/activity/coin/${symbol}`, { cache: 'no-store' }).catch(() => null),
        ]);

        if (cancelled) return;

        const coinData = coinRes?.ok ? ((await coinRes.json()) as Record<string, unknown>) : {};
        const tgData = tgCommunityRes?.ok
          ? ((await tgCommunityRes.json()) as Record<string, unknown>)
          : {};
        const dcData = dcCommunityRes?.ok
          ? ((await dcCommunityRes.json()) as Record<string, unknown>)
          : {};
        const activityData = activityRes?.ok
          ? ((await activityRes.json()) as Record<string, unknown>)
          : {};

        const communityData: CoinCommunityData = {
          symbol,
          name: (coinData.name as string) || symbol,
          price: coinData.price as string,
          marketCap: coinData.marketCap as string,
          holders: coinData.holders as number,
          creator: coinData.creator as string,
          description: coinData.description as string,

          telegram: {
            exists: !!(tgData as Record<string, unknown>).deepLink,
            memberCount: undefined,
            recentMessages: [],
          },

          discord: {
            exists: (dcData as Record<string, unknown>).exists === true,
            guildName: (dcData as Record<string, unknown>).guildName as string,
            inviteUrl: (dcData as Record<string, unknown>).inviteUrl as string,
            channels: [],
          },

          leaderboard:
            (coinData.leaderboard as Array<{
              wallet: string;
              amount: string;
              rank: number;
            }>) || [],

          events:
            (coinData.events as Array<{
              id: string;
              title: string;
              type: 'ama' | 'call' | 'vote' | 'stream';
              date: string;
              description?: string;
              url?: string;
            }>) || [],

          recentActivity:
            (activityData.data as Array<{
              id: string;
              protocol: string;
              text: string;
              author: string;
              timestamp: number;
            }>) || [],
        };

        if (!cancelled) setData(communityData);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!symbol) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[var(--color-fg)]">No coin specified</h1>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--color-overlay)] mb-6" />
        <div className="h-48 animate-pulse rounded-xl bg-[var(--color-overlay)] mb-4" />
        <div className="h-32 animate-pulse rounded-xl bg-[var(--color-overlay)]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="mb-4 text-4xl">🔍</div>
        <h1 className="text-xl font-bold text-[var(--color-fg)]">Community Not Found</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{error}</p>
      </div>
    );
  }

  // Use data even if partial (error but data is set)
  const displayData =
    data ||
    ({
      symbol,
      name: symbol,
      telegram: { exists: false },
      discord: { exists: false },
    } as CoinCommunityData);

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: '🏠' },
    { id: 'telegram', label: 'Telegram', icon: '💬' },
    { id: 'discord', label: 'Discord', icon: '🎮' },
    { id: 'activity', label: 'Activity', icon: '📡' },
    { id: 'events', label: 'Events', icon: '📅' },
    { id: 'holders', label: 'Holders', icon: '👑' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-page-enter">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <a
            href={`/coins/${symbol.toLowerCase()}`}
            className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            ← {symbol}
          </a>
          <span className="text-[var(--color-muted)]">/</span>
          <h1 className="text-lg font-bold text-[var(--color-fg)]">Community</h1>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 border-b border-[var(--color-glass-border)] min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-[var(--color-fg)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-degen-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab data={displayData} symbol={symbol} />}
      {activeTab === 'telegram' && <TelegramTab data={displayData} symbol={symbol} />}
      {activeTab === 'discord' && <DiscordTab data={displayData} symbol={symbol} />}
      {activeTab === 'activity' && <ActivityTab data={displayData} />}
      {activeTab === 'events' && <EventsTab data={displayData} />}
      {activeTab === 'holders' && <HoldersTab data={displayData} />}
    </div>
  );
}
