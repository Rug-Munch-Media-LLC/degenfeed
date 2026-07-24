'use client';

import { useEffect, useState } from 'react';
import { useIsMobile, useKeyboardHeight } from '../../hooks/useMobileResponsive';
import { usePeerTubeStream } from '../../hooks/usePeerTubeStream';
import { useActiveStream, useTokenStreams } from '../../hooks/useTokenStreams';
import LiveCommentFeed from './LiveCommentFeed';
import PeerTubeChatFeed from './PeerTubeChatFeed';

/* === Types ============================================ */

interface LiveStreamPlayerProps {
  tokenAddress: string;
  tokenSymbol?: string;
  isCreator?: boolean;
  className?: string;
}

/* === Main Component ================================== */

export default function LiveStreamPlayer({
  tokenAddress,
  tokenSymbol,
  isCreator = false,
  className = '',
}: LiveStreamPlayerProps) {
  const isMobileScreen = useIsMobile();
  const _keyboardHeight = useKeyboardHeight();

  // Legacy stream (non-PeerTube fallback)
  const legacy = useActiveStream(tokenAddress);
  const { startStream: legacyStart, endStream: legacyEnd } = useTokenStreams(tokenAddress);

  // PeerTube stream (primary)
  const peertube = usePeerTubeStream(tokenAddress, tokenSymbol);

  const [showStartModal, setShowStartModal] = useState(false);
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDescription, setStreamDescription] = useState('');
  const [streamType, setStreamType] = useState<'video' | 'audio' | 'spaces'>('video');
  const [streamPlatform, setStreamPlatform] = useState<'peertube' | 'legacy'>('peertube');
  const [minHold, setMinHold] = useState(0);
  const [tokenGated, setTokenGated] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [notifySubscribed, setNotifySubscribed] = useState(false);
  const [showSetup, setShowSetup] = useState<{
    rtmpUrl: string;
    streamKey: string;
    embedUrl: string;
  } | null>(null);
  const [chatMessages, setChatMessages] = useState<
    Array<{
      id: string;
      displayName: string;
      accountName: string;
      message: string;
      timestamp: number;
      isHolder?: boolean;
      isCreator?: boolean;
    }>
  >([]);

  // Poll chat messages when stream is live
  useEffect(() => {
    if (!peertube.isLive) {
      setChatMessages([]);
      return;
    }

    const poll = async () => {
      try {
        const result = await peertube.fetchChat();
        setChatMessages(result.messages);
      } catch (err) {
        console.error('[LiveStreamPlayer] Chat polling failed:', err);
        // Use cached messages
      }
    };

    // Initial fetch
    poll();

    // Poll every 5s
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [peertube.isLive, peertube.fetchChat]);

  // Determine which stream to display
  const stream = peertube.stream ?? legacy.stream;

  async function handleStartStream() {
    if (!streamTitle.trim()) return;
    setIsStarting(true);
    setStartError(null);

    try {
      if (streamPlatform === 'peertube') {
        const result = await peertube.startStream({
          title: streamTitle.trim(),
          description: streamDescription.trim(),
          tokenSymbol,
          minHoldRequirement: tokenGated ? minHold : 0,
          tokenGated,
          category: 13, // Tech
        });

        setShowSetup({
          rtmpUrl: result.setup.obs.server,
          streamKey: result.setup.obs.streamKey,
          embedUrl: result.stream.embedUrl,
        });
      } else {
        await legacyStart({
          title: streamTitle.trim(),
          streamType,
          minHold: tokenGated ? minHold : 0,
          tokenSymbol,
        });
      }

      setShowStartModal(false);
      setStreamTitle('');
      setStreamDescription('');
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start stream');
    } finally {
      setIsStarting(false);
    }
  }

  // Loading state
  if (peertube.isLoading && legacy.isLoading) {
    return <StreamSkeleton />;
  }

  // Stream is live — show PeerTube player
  if (stream) {
    return (
      <LiveStreamView
        stream={stream}
        tokenAddress={tokenAddress}
        tokenSymbol={tokenSymbol}
        isCreator={isCreator}
        isPeerTube={peertube.isLive}
        isMobileScreen={isMobileScreen}
        onEndStream={peertube.isLive ? peertube.endStream : legacyEnd}
        chatMessages={chatMessages}
        onSendChat={peertube.sendChat}
        viewerCount={peertube.viewerCount || legacy.stream?.viewerCount || 0}
        streamDuration={peertube.streamDuration}
      />
    );
  }

  // Stream is offline
  return (
    <>
      {/* Offline view */}
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <div className="text-4xl opacity-40">📡</div>
        <p className="text-sm text-[var(--color-muted)]">
          {tokenSymbol ?? tokenAddress.slice(0, 6)} is offline
        </p>
        {isCreator && (
          <button
            onClick={() => setShowStartModal(true)}
            className="rounded-lg bg-degen-500 px-4 py-2 text-sm font-medium text-white hover:bg-degen-600"
          >
            Go Live
          </button>
        )}
        {!isCreator && (
          <button
            onClick={() => setNotifySubscribed(true)}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-fg)]"
          >
            {notifySubscribed ? 'Notification Set' : 'Notify When Live'}
          </button>
        )}
      </div>

      {/* Start stream modal — full-screen on mobile */}
      {showStartModal && (
        <div
          className={`fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm ${
            isMobileScreen ? 'items-end' : 'items-center justify-center'
          }`}
        >
          <div
            className={`w-full max-w-md border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl overflow-y-auto ${
              isMobileScreen
                ? 'modal-mobile-content rounded-t-2xl rounded-b-none pb-safe max-h-[90dvh]'
                : 'rounded-xl p-6'
            }`}
          >
            {/* Swipe indicator (mobile) */}
            {isMobileScreen && (
              <div className="flex justify-center pt-2 pb-3">
                <div className="h-1 w-10 rounded-full bg-[var(--color-border)]" />
              </div>
            )}

            <div className={isMobileScreen ? 'px-5 pb-5' : ''}>
              <h3 className="text-lg font-bold text-[var(--color-fg)]">Go Live</h3>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Start streaming to your token community
              </p>

              <div className="mt-4 space-y-4">
                {/* Stream title */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">
                    Stream Title
                  </label>
                  <input
                    type="text"
                    value={streamTitle}
                    onChange={(e) => setStreamTitle(e.target.value)}
                    placeholder="e.g. AMA with the team! 🎙️"
                    maxLength={200}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none focus:border-degen-500/30"
                  />
                </div>

                {/* Stream description */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">
                    Description
                  </label>
                  <textarea
                    value={streamDescription}
                    onChange={(e) => setStreamDescription(e.target.value)}
                    placeholder="What's this stream about?"
                    maxLength={1000}
                    rows={3}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none focus:border-degen-500/30 resize-none"
                  />
                </div>

                {/* Stream platform */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">
                    Platform
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStreamPlatform('peertube')}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        streamPlatform === 'peertube'
                          ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                          : 'border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                      }`}
                    >
                      📹 PeerTube (Recommended)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStreamPlatform('legacy')}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        streamPlatform === 'legacy'
                          ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                          : 'border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                      }`}
                    >
                      🔗 External URL
                    </button>
                  </div>
                  {streamPlatform === 'peertube' && (
                    <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                      🌐 Federated via PeerTube — reaches ActivityPub, Nostr, Farcaster, Bluesky
                    </p>
                  )}
                </div>

                {/* Stream type (legacy only) */}
                {streamPlatform === 'legacy' && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">
                      Stream Type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['video', 'audio', 'spaces'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setStreamType(type)}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                            streamType === type
                              ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                              : 'border-[var(--color-border)] bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                          }`}
                        >
                          {type === 'video'
                            ? '📹 Video'
                            : type === 'audio'
                              ? '🎧 Audio'
                              : '💬 Spaces'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Token gating */}
                <div>
                  <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">
                    Access Requirements
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="tokenGated"
                        checked={tokenGated}
                        onChange={(e) => setTokenGated(e.target.checked)}
                        className="rounded border-[var(--color-border)] bg-[var(--color-overlay)] text-degen-500 focus:ring-degen-500/30"
                      />
                      <label htmlFor="tokenGated" className="text-xs text-[var(--color-fg)]">
                        Require minimum token hold to watch
                      </label>
                    </div>
                    {tokenGated && (
                      <input
                        type="number"
                        value={minHold}
                        onChange={(e) => setMinHold(Math.max(0, Number(e.target.value)))}
                        min={0}
                        placeholder="Minimum token amount"
                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30"
                      />
                    )}
                  </div>
                </div>
              </div>

              {startError && <p className="mt-2 text-xs text-red-400">{startError}</p>}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  className="btn-secondary flex-1 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartStream}
                  disabled={!streamTitle.trim() || isStarting}
                  className="btn-primary flex-1 text-sm disabled:opacity-50"
                >
                  {isStarting
                    ? 'Starting...'
                    : `Go Live ${streamPlatform === 'peertube' ? '🌐' : '🚀'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OBS Setup Card */}
      {showSetup && (
        <div className="mt-4 overflow-hidden rounded-xl border border-degen-500/30 bg-degen-500/5">
          <div className="flex items-center justify-between border-b border-degen-500/20 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-degen-400">
              📡 Stream Setup — OBS Instructions
            </span>
            <button
              type="button"
              onClick={() => setShowSetup(null)}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              Dismiss
            </button>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2 rounded-lg bg-black/20 p-3">
              <span className="text-xs font-medium text-[var(--color-muted)] w-20">RTMP URL:</span>
              <code className="flex-1 truncate rounded bg-black/30 px-2 py-1 text-xs font-mono text-degen-300">
                {showSetup.rtmpUrl}
              </code>
              <CopyButton text={showSetup.rtmpUrl} />
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-black/20 p-3">
              <span className="text-xs font-medium text-[var(--color-muted)] w-20">
                Stream Key:
              </span>
              <code className="flex-1 truncate rounded bg-black/30 px-2 py-1 text-xs font-mono text-degen-300">
                {showSetup.streamKey}
              </code>
              <CopyButton text={showSetup.streamKey} />
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-black/20 p-3">
              <span className="text-xs font-medium text-[var(--color-muted)] w-20">Preview:</span>
              <a
                href={showSetup.embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-degen-400 hover:underline truncate"
              >
                {showSetup.embedUrl}
              </a>
            </div>
            <ol className="list-inside list-decimal space-y-1 text-xs text-[var(--color-muted)]">
              <li>Open OBS Studio</li>
              <li>Go to Settings → Stream</li>
              <li>Service: Custom...</li>
              <li>Server: paste the RTMP URL above</li>
              <li>Stream Key: paste the Stream Key above</li>
              <li>Click OK, then Start Streaming</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}

/* === Copy Button ==================================== */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex-shrink-0 rounded bg-black/30 px-2 py-1 text-[10px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/* === Live Stream View ================================ */

function LiveStreamView({
  stream,
  tokenAddress,
  tokenSymbol,
  isCreator,
  isPeerTube,
  isMobileScreen,
  onEndStream,
  chatMessages,
  onSendChat,
  viewerCount,
  streamDuration,
}: {
  stream: {
    id: string;
    title: string;
    streamUrl?: string;
    embedUrl?: string;
    playbackUrl?: string;
    viewerCount: number;
    streamType?: string;
    tokenGated?: boolean;
    state?: string;
  };
  tokenAddress: string;
  tokenSymbol?: string;
  isCreator: boolean;
  isPeerTube: boolean;
  isMobileScreen: boolean;
  onEndStream: () => Promise<void>;
  chatMessages: Array<{
    id: string;
    displayName: string;
    accountName: string;
    message: string;
    timestamp: number;
    isHolder?: boolean;
    isCreator?: boolean;
  }>;
  onSendChat: (msg: string) => Promise<void>;
  viewerCount: number;
  streamDuration: number;
}) {
  const [isEnding, setIsEnding] = useState(false);
  const [showRecordingBanner, setShowRecordingBanner] = useState(false);

  // Format stream duration
  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m ${s % 60}s`;
  };

  // Determine the embed URL to use
  const playerUrl = stream.embedUrl ?? stream.streamUrl ?? '';
  const hasPlayer = !!playerUrl;

  // Show recording banner after stream ends
  useEffect(() => {
    if (stream.state === 'ended') {
      const timer = setTimeout(() => setShowRecordingBanner(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [stream.state]);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Stream header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex-shrink-0">
            LIVE
          </span>
          <span className="text-xs text-[var(--color-muted)] truncate">{stream.title}</span>
          {streamDuration > 0 && (
            <span className="text-[10px] text-[var(--color-muted)] flex-shrink-0 hidden sm:inline">
              {formatDuration(streamDuration)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-muted)]" />
            {viewerCount} watching
          </span>
          {isPeerTube && (
            <span className="hidden sm:flex items-center gap-1 rounded-md bg-degen-500/10 px-2 py-0.5 text-[10px] text-degen-400">
              🌐 PeerTube
            </span>
          )}
          {isCreator && (
            <button
              type="button"
              onClick={async () => {
                setIsEnding(true);
                try {
                  await onEndStream();
                } finally {
                  setIsEnding(false);
                }
              }}
              disabled={isEnding}
              className="rounded-md bg-red-500/20 px-2 py-1 text-[10px] font-medium text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {isEnding ? 'Ending...' : 'End'}
            </button>
          )}
        </div>
      </div>

      {/* Main content: player + chat */}
      <div className="flex flex-col lg:flex-row">
        {/* Video player */}
        <div className="relative flex-1 bg-black">
          {hasPlayer ? (
            <>
              <div className="aspect-video w-full">
                <iframe
                  src={playerUrl}
                  className="h-full w-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={stream.title}
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                />
              </div>
              {/* Stream overlay badges */}
              <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
                {stream.tokenGated && (
                  <span className="rounded-md bg-purple-500/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                    🛡 Token-Gated
                  </span>
                )}
                {isPeerTube && (
                  <span className="rounded-md bg-degen-500/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                    🌐 Federated
                  </span>
                )}
              </div>

              {/* Recording available banner */}
              {showRecordingBanner && (
                <div className="absolute bottom-3 left-3 right-3 pointer-events-auto">
                  <div className="rounded-lg bg-green-500/20 px-3 py-2 text-xs text-green-400 backdrop-blur-sm">
                    ✅ Stream has ended — the recording will be available shortly
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-degen-500/10 to-purple-500/10">
              <div className="text-center">
                <div className="text-5xl">📹</div>
                <p className="mt-2 text-sm font-medium text-[var(--color-fg)]">PeerTube Stream</p>
                <p className="text-xs text-[var(--color-muted)]">{stream.title}</p>
                {stream.playbackUrl && (
                  <a
                    href={stream.playbackUrl}
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
        </div>

        {/* Chat sidebar (PeerTube only) */}
        {isPeerTube && (
          <div
            className="w-full lg:w-80 lg:max-h-[calc(100vw*0.5625)] xl:w-96 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--color-border)]"
            style={isMobileScreen ? { maxHeight: '50vh' } : undefined}
          >
            <PeerTubeChatFeed
              messages={chatMessages}
              onSend={onSendChat}
              tokenAddress={tokenAddress}
              tokenSymbol={tokenSymbol}
              compact
              maxHeight="100%"
            />
          </div>
        )}
      </div>

      {/* Stream actions bar */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] px-4 py-2">
        <button type="button" className="btn-primary flex items-center gap-1 px-3 py-1.5 text-xs">
          🎁 Tip Creator
        </button>
        <button type="button" className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-xs">
          🪙 Buy Token
        </button>
        <button type="button" className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-xs">
          🔗 Share
        </button>

        <span className="ml-auto flex items-center gap-2 text-xs text-[var(--color-muted)]">
          {isPeerTube ? (
            <>
              <span className="flex items-center gap-1">
                🌐{' '}
                <a
                  href="https://video.degenfeed.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-degen-400 transition-colors"
                >
                  PeerTube
                </a>
              </span>
              <span className="text-[var(--color-border)]">|</span>
              <span className="flex items-center gap-1">💬 XMPP Chat</span>
            </>
          ) : (
            <span>📹 {stream.streamType ?? 'video'}</span>
          )}
        </span>
      </div>

      {/* Non-PeerTube: fallback comment feed */}
      {!isPeerTube && (
        <div className="border-t border-[var(--color-border)]">
          <LiveCommentFeed tokenAddress={tokenAddress} compact />
        </div>
      )}
    </div>
  );
}

/* === Stream Offline State ============================ */

function _StreamOffline({
  tokenAddress,
  tokenSymbol,
  isCreator,
  notifySubscribed,
  onNotifySubscribe,
  onStartStream,
  hasRecording,
  onViewRecording,
}: {
  tokenAddress: string;
  tokenSymbol?: string;
  isCreator: boolean;
  notifySubscribed: boolean;
  onNotifySubscribe: () => void;
  onStartStream: () => void;
  hasRecording: boolean;
  onViewRecording: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Offline display */}
      <div className="flex flex-col items-center justify-center px-4 py-10">
        <div className="mb-3 text-4xl opacity-50">🎙️</div>
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">
          Creator hasn&apos;t gone live yet
        </h3>
        <p className="mt-1 text-xs text-[var(--color-muted)] text-center max-w-xs">
          {isCreator
            ? 'Start a PeerTube stream to engage with your token community!'
            : `Get notified when ${tokenSymbol || 'this creator'} goes live`}
        </p>

        <div className="mt-4 flex gap-2">
          {isCreator ? (
            <button
              type="button"
              onClick={onStartStream}
              className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-degen-500" />
              </span>
              Go Live
            </button>
          ) : (
            <button
              type="button"
              onClick={onNotifySubscribe}
              disabled={notifySubscribed}
              className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {notifySubscribed ? '✅ Notifications On' : '🔔 Notify me when live'}
            </button>
          )}
        </div>

        {/* PeerTube branding */}
        {isCreator && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-2">
            <span className="text-lg">🌐</span>
            <div className="text-left">
              <p className="text-xs font-medium text-[var(--color-fg)]">PeerTube Livestreaming</p>
              <p className="text-[10px] text-[var(--color-muted)]">
                Federated to ActivityPub, Nostr, Farcaster, Bluesky, Telegram
              </p>
            </div>
          </div>
        )}

        {hasRecording && (
          <button
            type="button"
            onClick={onViewRecording}
            className="mt-3 text-xs text-degen-400 hover:underline"
          >
            📼 Watch previous recording
          </button>
        )}
      </div>

      {/* Chat still available offline */}
      <div className="border-t border-[var(--color-border)]">
        <LiveCommentFeed tokenAddress={tokenAddress} compact />
      </div>
    </div>
  );
}

/* === Skeleton Loading ================================ */

function StreamSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="skeleton h-10 w-full" />
      <div className="skeleton aspect-video w-full" />
      <div className="skeleton h-40 w-full" />
    </div>
  );
}
