'use client';

/**
 * CoinLaunchStreamPage — Dedicated page for the creator coin launch stream experience.
 * Full-width stream player with bonding curve overlay, chat sidebar, and trade feed.
 */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { GoLiveModal } from '../../../../components/streams/GoLiveModal';
import { StreamCoinOverlay } from '../../../../components/streams/StreamCoinOverlay';
import { useStreamChat } from '../../../../components/streams/useStreamChat';
import { useBondingCurve } from '../../../../hooks/useBondingCurve';
import { usePeerTubeStream } from '../../../../hooks/usePeerTubeStream';
import { useActiveStream } from '../../../../hooks/useTokenStreams';

/* === Types ============================================ */

interface CoinMeta {
  address: string;
  symbol: string;
  name: string;
  description?: string;
  creator?: {
    name: string;
    avatar?: string;
  };
  image?: string;
}

/* === Helpers =========================================== */

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatStreamDuration(startedAt: number): string {
  const elapsed = Date.now() - startedAt;
  const s = Math.floor(elapsed / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/* === Skeleton ========================================= */

function LivePageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 animate-pulse">
      <div className="mb-4 skeleton h-4 w-48 rounded-lg" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <div className="skeleton aspect-video w-full rounded-xl" />
        </div>
        <div className="w-full lg:w-96 space-y-4">
          <div className="skeleton h-96 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/* === Stream Not Live ================================== */

function StreamNotLive({
  symbol,
  onGoLive,
}: {
  symbol: string;
  coinAddress?: string;
  onGoLive?: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 to-purple-500/20">
        <span className="text-4xl">📡</span>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">No Live Stream Yet</h1>
      <p className="mb-2 text-sm text-[var(--color-muted)]">
        The creator of <strong className="text-degen-400">${symbol.toUpperCase()}</strong>{' '}
        hasn&apos;t started a live stream yet.
      </p>
      <p className="mb-8 text-sm text-[var(--color-muted)]">
        When they go live, the stream will appear here with the bonding curve overlay, live chat,
        and real-time trade feed.
      </p>

      <div className="flex justify-center gap-3">
        <Link href={`/launch/${symbol}`} className="btn-secondary px-5 py-2.5 text-sm">
          ← Back to Coin
        </Link>
        {onGoLive && (
          <button
            type="button"
            onClick={onGoLive}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-degen-500 to-emerald-500 px-5 py-2.5 text-sm font-bold text-black shadow-lg shadow-degen-500/20 transition-all hover:from-degen-400 hover:to-emerald-400"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-black" />
            </span>
            Go Live Now
          </button>
        )}
      </div>

      {/* Preview of what's coming */}
      <div className="mx-auto mt-12 max-w-md">
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
            When streaming is live, you&apos;ll see:
          </h3>
          <ul className="space-y-2 text-left text-sm text-[var(--color-muted)]">
            <li className="flex items-center gap-2">
              <span className="text-degen-400">🎥</span>
              Full-width PeerTube stream player
            </li>
            <li className="flex items-center gap-2">
              <span className="text-degen-400">📊</span>
              Bonding curve progress overlay
            </li>
            <li className="flex items-center gap-2">
              <span className="text-degen-400">🪙</span>
              Buy button + live price ticker
            </li>
            <li className="flex items-center gap-2">
              <span className="text-degen-400">💬</span>
              Real-time chat &amp; trade feed
            </li>
            <li className="flex items-center gap-2">
              <span className="text-degen-400">👥</span>
              Live viewer count &amp; holder updates
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* === Main Page ======================================== */

export default function CoinLaunchStreamPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = typeof params.symbol === 'string' ? params.symbol : '';

  const [coinMeta, setCoinMeta] = useState<CoinMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [showGoLive, setShowGoLive] = useState(false);
  // Creator-only actions (Go Live / End stream) require a real auth check.
  // The former `setIsCreator(true)` unconditionally granted creator powers
  // to every visitor — fabricated authorization. Until session-based
  // creator verification is wired, no one is treated as the creator.
  const [isCreator] = useState(false);

  // Fetch coin metadata
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    const fetchMeta = async () => {
      setMetaLoading(true);
      try {
        const res = await fetch(`/api/creator/coin/${encodeURIComponent(symbol)}`);
        if (res.ok) {
          const data = (await res.json()) as CoinMeta;
          if (!cancelled) setCoinMeta(data);
        } else {
          // No fabricated fallback: the former code generated a random
          // 0x… contract address on API failure. Show an honest error.
          if (!cancelled) {
            setMetaError(`Coin metadata unavailable (HTTP ${res.status})`);
          }
        }
      } catch {
        if (!cancelled) setMetaError('Coin metadata unavailable — network error.');
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    };

    void fetchMeta();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const coinAddress = coinMeta?.address ?? '';
  const tokenSymbol = coinMeta?.symbol ?? symbol.toUpperCase();

  // Bonding curve data
  const { price, progress, recentTrades } = useBondingCurve(coinAddress);

  // Stream data
  const { stream, isLoading: streamLoading } = useActiveStream(coinAddress);
  const peertube = usePeerTubeStream(coinAddress, tokenSymbol);

  // Chat
  const chat = useStreamChat({ streamId: stream?.id ?? '', maxMessages: 100 });

  const isLive = stream?.isActive ?? peertube.isLive ?? false;
  const loading = metaLoading || streamLoading;

  const handleGoLive = useCallback(() => {
    setShowGoLive(true);
  }, []);

  if (loading && !coinMeta) return <LivePageSkeleton />;

  if (!coinMeta) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="mb-2 text-xl font-bold text-[var(--color-fg)]">
          {metaError ? 'Coin Data Unavailable' : 'Coin Not Found'}
        </h1>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          {metaError
            ? `${metaError}. The launch stream needs real coin metadata — no fallback data is shown.`
            : `Could not find coin with symbol “${symbol}”`}
        </p>
        <Link href="/launch" className="btn-primary">
          ← Browse Coins
        </Link>
      </div>
    );
  }

  // If stream is not live, show the placeholder
  if (!isLive) {
    return (
      <>
        <div className="mx-auto max-w-7xl px-4 py-6">
          <nav className="mb-4 flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <Link href="/launch" className="hover:text-degen-400 transition-colors">
              Creator Coins
            </Link>
            <span>/</span>
            <Link href={`/launch/${symbol}`} className="hover:text-degen-400 transition-colors">
              ${tokenSymbol}
            </Link>
            <span>/</span>
            <span className="font-medium text-[var(--color-fg)]">Live</span>
          </nav>
        </div>

        <StreamNotLive
          symbol={symbol}
          coinAddress={coinAddress}
          onGoLive={isCreator ? handleGoLive : undefined}
        />

        <GoLiveModal
          isOpen={showGoLive}
          onClose={() => setShowGoLive(false)}
          defaultCoinAddress={coinAddress}
          defaultCoinSymbol={tokenSymbol}
          defaultSurfaces={['coin-page', 'profile', 'visual-feed', 'discover']}
        />
      </>
    );
  }

  // Stream is LIVE — render full experience
  const playerUrl = peertube.stream?.embedUrl ?? stream?.streamUrl ?? '';

  return (
    <div className="mx-auto flex h-[calc(100dvh-var(--bottom-nav-height,0px))] flex-col">
      {/* == Top nav bar ================================== */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/launch/${symbol}`}
            className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-degen-400 transition-colors shrink-0"
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Coin
          </Link>

          <span className="text-[var(--color-border)] hidden sm:inline">|</span>

          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-xs font-bold text-degen-400">
              {tokenSymbol.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--color-fg)]">
                ${tokenSymbol} Launch Stream
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                <span className="font-semibold text-red-400">LIVE</span>
                {peertube.stream?.startedAt && (
                  <span>{formatStreamDuration(peertube.stream.startedAt)}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Viewer count */}
          <span className="flex items-center gap-1 rounded-lg bg-[var(--color-overlay)] px-2.5 py-1.5 text-[11px] tabular-nums text-[var(--color-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-degen-500" />
            {peertube.viewerCount || stream?.viewerCount || 0} watching
          </span>

          {/* Price badge */}
          {price !== null && (
            <span className="hidden sm:flex items-center gap-1 rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[11px] font-medium tabular-nums text-degen-400">
              Ξ{price.toFixed(6)}
            </span>
          )}

          {/* End stream (creator only) */}
          {isCreator && (
            <button
              type="button"
              onClick={async () => {
                try {
                  if (peertube.isLive) await peertube.endStream();
                } catch {
                  // ignore
                }
              }}
              className="rounded-lg bg-red-500/20 px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/30 transition-colors"
            >
              End
            </button>
          )}
        </div>
      </div>

      {/* == Main content: player + sidebar ============== */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Video player area */}
        <div className="relative flex-1 bg-black">
          {playerUrl ? (
            <div className="h-full w-full">
              <iframe
                src={playerUrl}
                className="h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title={`${tokenSymbol} Launch Stream`}
                sandbox="allow-scripts allow-same-origin allow-presentation"
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-degen-500/10 to-purple-500/10">
              <div className="text-center">
                <div className="mb-2 text-5xl">📹</div>
                <p className="text-sm font-medium text-[var(--color-fg)]">
                  {stream?.title ?? `${tokenSymbol} Launch Stream`}
                </p>
                <p className="text-xs text-[var(--color-muted)]">Stream is starting...</p>
                {peertube.stream?.playbackUrl && (
                  <a
                    href={peertube.stream.playbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block rounded-md bg-degen-500/20 px-3 py-1.5 text-xs font-medium text-degen-400 hover:bg-degen-500/30 transition-colors"
                  >
                    Open in PeerTube →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Coin overlay */}
          {coinAddress && (
            <StreamCoinOverlay
              coinAddress={coinAddress}
              streamId={stream?.id ?? ''}
              tokenSymbol={tokenSymbol}
              onBuy={() => router.push(`/launch/${symbol}`)}
            />
          )}
        </div>

        {/* Right sidebar: chat + trades */}
        <div className="flex w-full flex-col border-t border-[var(--color-border)] bg-[var(--color-card)] lg:w-80 lg:border-t-0 lg:border-l xl:w-96 shrink-0 overflow-hidden">
          {/* Chat */}
          <div className="flex flex-1 flex-col overflow-hidden border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Chat
              </span>
              <span className="text-[10px] text-[var(--color-muted)]">
                ({chat.messages.length})
              </span>
              {chat.isConnected && (
                <span className="ml-auto flex items-center gap-1 rounded bg-degen-500/10 px-1.5 py-0.5 text-[9px] text-degen-400">
                  <span className="h-1 w-1 rounded-full bg-degen-500" />
                  Live
                </span>
              )}
            </div>

            <div className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2">
              {chat.messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-xs text-[var(--color-muted)]">
                    No messages yet. Start the conversation!
                  </p>
                </div>
              ) : (
                chat.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--color-overlay)]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-degen-400">{msg.displayName}</span>
                      {msg.badge && (
                        <span className="rounded bg-degen-500/10 px-1 py-0 text-[8px] font-medium text-degen-400">
                          {msg.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-fg)]">{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Chat input */}
            <div className="border-t border-[var(--color-border)] p-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.target as HTMLFormElement).elements.namedItem(
                    'chat',
                  ) as HTMLInputElement;
                  if (input.value.trim()) {
                    chat.sendMessage(input.value.trim());
                    input.value = '';
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  name="chat"
                  placeholder="Type a message..."
                  maxLength={500}
                  className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none focus:border-degen-500/30"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-degen-500 px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-degen-400"
                >
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* Trade feed (compact) */}
          <div className="shrink-0 max-h-48 overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-degen-500" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Trades
              </span>
              <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
                ({recentTrades.length})
              </span>
              {progress !== null && (
                <span className="ml-auto text-[10px] tabular-nums text-degen-400">
                  {Math.round(progress)}%
                </span>
              )}
            </div>

            {recentTrades.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <p className="text-xs text-[var(--color-muted)]">No trades yet</p>
              </div>
            ) : (
              <div className="space-y-0.5 p-2">
                {recentTrades.slice(0, 15).map((trade, i) => (
                  <div
                    key={trade.id || `${trade.txHash}-${i}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--color-overlay)]"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold ${
                        trade.type === 'buy'
                          ? 'bg-degen-500/15 text-degen-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {trade.type === 'buy' ? '↑' : '↓'}
                    </span>
                    <span className="min-w-0 flex-1 font-mono text-[11px] tabular-nums text-[var(--color-fg)] truncate">
                      {shortenAddress(trade.wallet)}
                    </span>
                    <span
                      className={`shrink-0 text-[11px] font-medium tabular-nums ${
                        trade.type === 'buy' ? 'text-degen-400' : 'text-red-400'
                      }`}
                    >
                      {trade.usdValue >= 1000
                        ? `$${(trade.usdValue / 1000).toFixed(1)}K`
                        : `$${trade.usdValue.toFixed(2)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Go Live Modal */}
      <GoLiveModal
        isOpen={showGoLive}
        onClose={() => setShowGoLive(false)}
        defaultCoinAddress={coinAddress}
        defaultCoinSymbol={tokenSymbol}
        defaultSurfaces={['coin-page', 'profile', 'visual-feed', 'discover']}
      />
    </div>
  );
}
