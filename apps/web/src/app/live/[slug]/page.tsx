'use client';

/**
 * @degenfeed/web — Unified Live Stream / Creator Page
 *
 * Merged from the prior [creator] and [streamId] routes which created
 * an ambiguous route conflict in Next.js 16.
 *
 * This single [slug] route handles both:
 *   1. Stream-by-ID — fetches real stream data from the API
 *   2. Creator handle — renders a mock creator stream page as fallback
 */

import { ErrorBoundary } from '@degenfeed/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { StreamChat } from '../../../components/stream/StreamChat';
import { StreamClips } from '../../../components/stream/StreamClips';
import { StreamInfo } from '../../../components/stream/StreamInfo';
import { StreamMiniPlayer } from '../../../components/stream/StreamMiniPlayer';
import { StreamPlayer } from '../../../components/stream/StreamPlayer';
import { StreamSchedule } from '../../../components/stream/StreamSchedule';
import { StreamVODs } from '../../../components/stream/StreamVODs';
import type { StreamExtended } from '../../../components/stream/types';
import {
  generateMockClips,
  generateMockSchedule,
  generateMockStream,
  generateMockVODs,
} from '../../../components/stream/types';

// ─── Types ─────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  streamId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  message: string;
  timestamp: number;
  source: string;
  isCreator?: boolean;
  isHighlighted?: boolean;
  badges?: string[];
}

interface StreamDetails {
  stream: {
    id: string;
    source: string;
    title: string;
    streamer: {
      id: string;
      handle: string;
      displayName: string;
      avatarUrl?: string;
      walletAddress?: string;
      followers?: number;
    };
    thumbnailUrl: string;
    viewerCount: number;
    startedAt: number;
    category: string;
    tags: string[];
    isLive: boolean;
    embedUrl?: string;
    chatEnabled: boolean;
    platformMeta?: Record<string, unknown>;
  };
  chat: ChatMessage[];
}

interface StreamInfoResponse {
  streams: StreamDetails['stream'][];
  total: number;
  sources: Array<{ source: string; count: number; label: string }>;
}

// ─── Fetcher ───────────────────────────────────────────────────────────

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.json();
};

// ─── Detecting slug type ──────────────────────────────────────────────

function isStreamId(slug: string): boolean {
  // Stream IDs typically contain hyphens, are UUID-like, or are hex strings
  return slug.includes('-') || slug.length > 24 || /^[a-f0-9]{8,}$/i.test(slug);
}

// ─── Mock Creator Data ────────────────────────────────────────────────

function useStreamData(id: string): StreamExtended {
  const [stream] = useMemo(() => generateMockStream(1), []);
  const base = stream!;
  return {
    ...base,
    id,
    title: id.includes('stream') ? base.title : `${id}'s Stream`,
    creatorHandle: id,
    creatorDisplayName: id
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    creatorId: base.creatorId ?? id,
  };
}

// ─── Stream Video Player ──────────────────────────────────────────────

function StreamVideoPlayer({
  embedUrl,
  source,
  title,
}: {
  embedUrl?: string;
  source: string;
  title: string;
}) {
  const [theaterMode, setTheaterMode] = useState(false);

  if (!embedUrl) {
    return (
      <div className="aspect-video flex items-center justify-center rounded-2xl bg-black">
        <div className="text-center text-[var(--color-muted)]">
          <div className="text-4xl mb-2">📡</div>
          <div className="text-sm">Stream player unavailable</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${theaterMode ? 'fixed inset-0 z-40 bg-black' : ''}`}>
      <div className={`relative ${theaterMode ? 'h-screen' : 'aspect-video'} w-full`}>
        <iframe
          src={embedUrl}
          className="h-full w-full rounded-2xl"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={title}
        />

        {/* Theater mode toggle */}
        <button
          type="button"
          onClick={() => setTheaterMode(!theaterMode)}
          className={`absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white/70 transition-colors hover:bg-black/80 hover:text-white ${
            theaterMode ? 'hidden' : ''
          }`}
          title={theaterMode ? 'Exit theater mode' : 'Theater mode'}
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
            {theaterMode ? (
              <>
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            ) : (
              <>
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Close theater mode overlay button */}
      {theaterMode && (
        <button
          type="button"
          onClick={() => setTheaterMode(false)}
          className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          title="Exit theater mode"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Source Badge ──────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const badges: Record<string, { label: string; color: string; bg: string }> = {
    owncast: { label: 'Owncast', color: '#00ff41', bg: 'bg-green-500/15' },
    peertube: { label: 'PeerTube', color: '#F1684B', bg: 'bg-orange-500/15' },
    youtube: { label: 'YouTube', color: '#FF0000', bg: 'bg-red-500/15' },
    twitch: { label: 'Twitch', color: '#9146FF', bg: 'bg-purple-500/15' },
    spaces: { label: 'Spaces', color: '#00BCD4', bg: 'bg-cyan-500/15' },
    degenfeed: { label: 'DegenFeed', color: '#00ff41', bg: 'bg-degen-500/15' },
  };

  const info = badges[source] || { label: source, color: '#888', bg: 'bg-white/5' };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${info.bg}`}
      style={{ color: info.color }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: info.color }}
      />
      {info.label}
    </span>
  );
}

// ─── Stream Info Header (Live Data) ────────────────────────────────────

function StreamInfoHeader({ stream }: { stream: StreamDetails['stream'] }) {
  const uptime = useMemo(() => {
    const seconds = Math.floor((Date.now() - stream.startedAt) / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, [stream.startedAt]);

  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, []);

  return (
    <div className="space-y-3">
      {/* Title Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-[var(--color-fg)] truncate">{stream.title}</h1>
          <div className="mt-1 flex items-center gap-2">
            <SourceBadge source={stream.source} />
            <span className="text-[10px] text-[var(--color-muted)]">{stream.category}</span>
            {stream.tags?.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[9px] text-[var(--color-muted)]">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Tip Button */}
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-2 text-xs font-bold text-white transition-all hover:from-purple-500 hover:to-pink-500"
          >
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23 12l-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.81.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68L23 12z" />
            </svg>
            Tip
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            {copied ? (
              'Copied!'
            ) : (
              <>
                <svg
                  aria-hidden="true"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </>
            )}
          </button>
        </div>
      </div>

      {/* Streamer Info + Stats */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Streamer */}
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-xs font-bold text-degen-400">
            {stream.streamer.avatarUrl ? (
              <img
                src={stream.streamer.avatarUrl}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              stream.streamer.displayName[0]?.toUpperCase() || '?'
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--color-fg)]">
              {stream.streamer.displayName}
            </div>
            <div className="text-[10px] text-[var(--color-muted)]">@{stream.streamer.handle}</div>
          </div>
        </div>

        {/* Viewer count */}
        <div className="flex items-center gap-1.5 rounded-lg bg-degen-500/10 px-2.5 py-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-degen-500" />
          </span>
          <span className="text-xs font-semibold text-degen-400 tabular-nums">
            {stream.viewerCount.toLocaleString()}
          </span>
          <span className="text-[9px] text-degen-400/60">watching</span>
        </div>

        {/* Uptime */}
        <div className="text-[11px] text-[var(--color-muted)]">Live for {uptime}</div>

        {/* Followers if available */}
        {stream.streamer.followers !== undefined && (
          <div className="text-[11px] text-[var(--color-muted)]">
            {stream.streamer.followers.toLocaleString()} followers
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Sidebar ──────────────────────────────────────────────────────

function ChatSidebar({
  stream,
  initialChat,
}: {
  stream: StreamDetails['stream'];
  initialChat: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialChat);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!stream.chatEnabled) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/live/chat/${stream.id}/messages?limit=50`);
        if (res.ok) {
          const data = (await res.json()) as { messages: ChatMessage[] };
          setMessages(data.messages);
        }
      } catch {
        // Silent
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [stream.id, stream.chatEnabled]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/live/chat/${stream.id}/message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: input.trim() }),
      });
      if (res.ok) {
        const data = (await res.json()) as { message: ChatMessage };
        setMessages((prev) => [...prev, data.message]);
        setInput('');
      }
    } catch {
      // Silent
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [input, isSending, stream.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-3 py-2.5">
        <span className="text-xs font-semibold text-[var(--color-fg)]">Stream Chat</span>
        <span className="text-[9px] text-[var(--color-muted)]">{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-lg mb-1">💬</div>
              <div className="text-[10px] text-[var(--color-muted)]">
                {stream.chatEnabled ? 'No messages yet. Be the first!' : 'Chat is disabled'}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`group flex gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-white/5 ${
                msg.isHighlighted ? 'bg-yellow-500/10 ring-1 ring-yellow-500/20' : ''
              }`}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[6px] font-bold text-degen-400">
                {msg.avatarUrl ? (
                  <img
                    src={msg.avatarUrl}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  msg.displayName[0]?.toUpperCase() || '?'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-[var(--color-fg)]">
                    {msg.displayName}
                  </span>
                  {msg.isCreator && (
                    <span className="rounded bg-degen-500/20 px-1 py-0.5 text-[7px] font-bold text-degen-400">
                      STREAMER
                    </span>
                  )}
                  {msg.badges?.map((badge) => (
                    <span
                      key={badge}
                      className="rounded bg-blue-500/20 px-1 py-0.5 text-[7px] text-blue-400"
                    >
                      {badge.toUpperCase()}
                    </span>
                  ))}
                  {msg.isHighlighted && (
                    <span className="text-[9px]" title="Highlighted message">
                      ⭐
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[var(--color-muted)] break-words">
                  {msg.message}
                </div>
              </div>
              <div className="shrink-0 text-[8px] text-[var(--color-muted)] opacity-0 group-hover:opacity-100">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      {stream.chatEnabled && (
        <div className="border-t border-[var(--color-glass-border)] p-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              maxLength={500}
              className="input flex-1 text-xs"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-degen-500 text-black transition-colors hover:bg-degen-400 disabled:opacity-40"
            >
              {isSending ? (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black border-t-transparent" />
              ) : (
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Related Streams Sidebar ──────────────────────────────────────────

function RelatedStreams({ currentStreamId }: { currentStreamId: string }) {
  const { data, error } = useSWR<StreamInfoResponse>('/api/live/now?limit=10', fetcher, {
    refreshInterval: 15000,
  });

  if (error || !data?.streams) return null;

  const related = data.streams.filter((s) => s.id !== currentStreamId).slice(0, 5);

  if (related.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Related Live Streams</h3>
      <div className="space-y-2">
        {related.map((s) => (
          <a
            key={s.id}
            href={`/live/${s.id}`}
            className="group flex gap-3 rounded-xl border border-[var(--color-glass-border)] p-2.5 transition-all hover:border-degen-500/20"
          >
            <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-degen-800/30 to-purple-800/30">
              <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span className="text-[8px] font-bold text-white tabular-nums">
                  {s.viewerCount.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-[var(--color-fg)] line-clamp-1 group-hover:text-degen-400">
                {s.title}
              </div>
              <div className="mt-0.5 text-[9px] text-[var(--color-muted)]">
                @{s.streamer.handle}
              </div>
              <div className="mt-0.5">
                <SourceBadge source={s.source} />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Creator Page View (mock data) ─────────────────────────────────────

function CreatorPageView({ slug }: { slug: string }) {
  const stream = useStreamData(slug);
  const [isTheater, setIsTheater] = useState(false);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [activeSection, setActiveSection] = useState<'about' | 'schedule' | 'vods' | 'clips'>(
    'about',
  );
  const [showSidebar, setShowSidebar] = useState(true);

  const vods = useMemo(() => generateMockVODs(6), []);
  const clips = useMemo(() => generateMockClips(8), []);
  const schedule = useMemo(() => generateMockSchedule(), []);

  const handleTheaterToggle = useCallback(() => {
    setIsTheater((v) => !v);
    setShowMiniPlayer(false);
  }, []);

  const handleClosePlayer = useCallback(() => {
    setShowMiniPlayer(true);
  }, []);

  const handleExpandMiniPlayer = useCallback(() => {
    setShowMiniPlayer(false);
  }, []);

  return (
    <ErrorBoundary>
      {/* == Back navigation == */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto max-w-[1800px] px-4 py-2">
          <div className="flex items-center gap-2 text-xs">
            <Link href="/live" className="text-white/40 hover:text-white/70 transition-colors">
              Live
            </Link>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="text-white/20"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="text-white/70 truncate">{stream.creatorDisplayName}</span>
          </div>
        </div>
      </div>

      {/* == Main content area == */}
      <div className="mx-auto max-w-[1800px]">
        <div className={`flex ${showSidebar ? 'flex-col lg:flex-row' : 'flex-col'}`}>
          {/* == Left: Player + Below content == */}
          <div className={`flex-1 min-w-0 ${showSidebar ? 'lg:mr-0' : ''}`}>
            {/* Player */}
            <StreamPlayer
              stream={stream}
              onClose={handleClosePlayer}
              onTheaterToggle={handleTheaterToggle}
              isTheater={isTheater}
            />

            {/* Below player content */}
            <div className="px-4 py-4 space-y-6">
              {/* Stream Info (title, creator, follow/subscribe, description) */}
              <StreamInfo stream={stream} />

              {/* Section tabs */}
              <div className="flex gap-1 border-b border-white/10" role="tablist">
                {[
                  { id: 'about' as const, label: 'About', icon: 'ℹ️' },
                  { id: 'schedule' as const, label: 'Schedule', icon: '📅' },
                  { id: 'vods' as const, label: 'VODs', icon: '📼' },
                  { id: 'clips' as const, label: 'Clips', icon: '✂️' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeSection === tab.id}
                    onClick={() => setActiveSection(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium capitalize transition-all border-b-2 ${
                      activeSection === tab.id
                        ? 'border-degen-500 text-degen-400'
                        : 'border-transparent text-white/40 hover:text-white/70'
                    }`}
                  >
                    <span aria-hidden="true" className="text-sm">
                      {tab.icon}
                    </span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="animate-fade-in">
                {activeSection === 'about' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <h3 className="text-sm font-semibold text-white/80">
                        About {stream.creatorDisplayName}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-white/50">
                        Welcome to the stream! We talk about crypto, DeFi, web3, and everything in
                        between. Make sure to follow and subscribe so you never miss a stream!
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/10 pt-3">
                        <div className="text-center">
                          <p className="text-xs font-bold text-white">
                            {stream.stats.totalViews.toLocaleString()}
                          </p>
                          <p className="text-[9px] text-white/40">Channel Views</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-white">
                            {stream.stats.followers.toLocaleString()}
                          </p>
                          <p className="text-[9px] text-white/40">Followers</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-white">
                            {stream.stats.subscribers.toLocaleString()}
                          </p>
                          <p className="text-[9px] text-white/40">Subscribers</p>
                        </div>
                      </div>
                    </div>

                    {/* Related channels placeholder */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <h3 className="text-sm font-semibold text-white/70">Related Channels</h3>
                      <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                        {['defi_degen', 'sol_whale', 'nft_collector', 'meme_lord'].map((handle) => (
                          <Link
                            key={handle}
                            href={`/live/${handle}`}
                            className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 transition-all hover:border-degen-500/20"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[8px] font-bold text-degen-400">
                              {(handle[0] ?? '?').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-white/70">
                                @{handle}
                              </p>
                              <p className="text-[9px] text-white/30">Live</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'schedule' && <StreamSchedule streams={schedule} />}
                {activeSection === 'vods' && <StreamVODs vods={vods} />}
                {activeSection === 'clips' && <StreamClips clips={clips} />}
              </div>
            </div>
          </div>

          {/* == Right: Chat sidebar == */}
          {showSidebar && (
            <div className="w-full lg:w-[380px] lg:min-w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10">
              <div className="h-full flex flex-col" style={{ maxHeight: 'calc(100vh - 48px)' }}>
                {/* Chat header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
                  <span className="text-xs font-semibold text-white/70">Stream Chat</span>
                  <button
                    type="button"
                    onClick={() => setShowSidebar(false)}
                    className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/60"
                    aria-label="Close chat"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                </div>
                {/* Chat messages */}
                <div className="flex-1 overflow-hidden">
                  <StreamChat streamId={stream.id} maxHeight="100%" />
                </div>
              </div>
            </div>
          )}

          {/* Sidebar toggle (when hidden) */}
          {!showSidebar && (
            <button
              type="button"
              onClick={() => setShowSidebar(true)}
              className="fixed right-4 top-20 z-40 flex items-center gap-1.5 rounded-lg bg-degen-500/20 border border-degen-500/30 px-3 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/30 transition-all"
              aria-label="Show chat"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Show Chat
            </button>
          )}
        </div>
      </div>

      {/* == Mini Player (PiP-style) == */}
      {showMiniPlayer && (
        <StreamMiniPlayer
          title={stream.title}
          onClose={() => setShowMiniPlayer(false)}
          onExpand={handleExpandMiniPlayer}
        />
      )}
    </ErrorBoundary>
  );
}

// ─── Stream Page View (live data via API) ──────────────────────────────

function StreamPageView({ slug }: { slug: string }) {
  const { data, error, isLoading } = useSWR<StreamDetails>(`/api/live/${slug}`, fetcher, {
    refreshInterval: 30000,
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey) {
        // Let the user navigate back normally
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="aspect-video w-full rounded-2xl skeleton" />
        <div className="mt-4 space-y-3">
          <div className="h-6 w-2/3 rounded skeleton" />
          <div className="h-4 w-1/3 rounded skeleton" />
        </div>
      </div>
    );
  }

  if (error || !data?.stream) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="text-4xl mb-4">📡</div>
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Stream Not Found</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            This stream doesn&apos;t exist or has ended.
          </p>
          <a
            href="/live"
            className="mt-4 rounded-lg bg-degen-500/15 px-4 py-2 text-xs font-semibold text-degen-400 transition-colors hover:bg-degen-500/25"
          >
            Browse Live Streams
          </a>
        </div>
      </div>
    );
  }

  const { stream, chat } = data;

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-6 animate-page-enter">
        {/* Main content area: player + sidebar */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: Player + Info */}
          <div className="flex-1 min-w-0">
            {/* Video Player */}
            <StreamVideoPlayer
              embedUrl={stream.embedUrl}
              source={stream.source}
              title={stream.title}
            />

            {/* Stream Info */}
            <div className="mt-4">
              <StreamInfoHeader stream={stream} />
            </div>

            {/* Additional Content Row */}
            <div className="mt-6 grid grid-cols-1 lg:hidden">
              {/* Chat for mobile (below player) */}
              {stream.chatEnabled && (
                <div className="h-96">
                  <ChatSidebar stream={stream} initialChat={chat} />
                </div>
              )}
            </div>
          </div>

          {/* Right: Chat sidebar (desktop) */}
          <div className="hidden lg:block w-96 shrink-0">
            <div className="h-[calc(100vh-8rem)]">
              <ChatSidebar stream={stream} initialChat={chat} />
            </div>
          </div>
        </div>

        {/* Related Streams */}
        <RelatedStreams currentStreamId={slug} />
      </div>
    </ErrorBoundary>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────

interface PageProps {
  params: { slug: string };
}

export default function LiveSlugPage({ params }: PageProps) {
  const { slug } = params;

  // If the slug looks like a stream ID, try the API-backed view.
  // Otherwise, show the creator profile (mock) view.
  if (isStreamId(slug)) {
    return <StreamPageView slug={slug} />;
  }

  return <CreatorPageView slug={slug} />;
}
