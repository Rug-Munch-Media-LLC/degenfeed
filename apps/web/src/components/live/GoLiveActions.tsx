'use client';

import type { StreamConfig, StreamConnection } from './GoLiveFlow';
import type { LivePlatform } from './PlatformSelection';

function ShareButton({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-[10px] font-medium text-[var(--color-muted)] transition-all hover:text-white hover:border-white/20"
      style={{ borderColor: `${color}30`, '--tw-ring-color': color } as React.CSSProperties}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </a>
  );
}

export function GoLiveActions({
  connection,
  config,
  onGoLive,
}: {
  connection: StreamConnection;
  config: StreamConfig;
  platform: LivePlatform;
  onGoLive: () => void;
}) {
  const shareText = `🔴 I'm live now! Watch "${config.title}" on DegenFeed ${connection.playbackUrl} #DegenFeed #Live`;
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-lg font-bold text-[var(--color-fg)]">Ready to Go Live!</h3>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Your stream is configured. Share with the world.
        </p>
      </div>
      <button
        type="button"
        onClick={onGoLive}
        className="w-full rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-6 py-4 text-lg font-bold text-white shadow-lg transition-all hover:from-red-500 hover:to-red-400 hover:shadow-red-500/25 active:scale-[0.98]"
      >
        <span className="flex items-center justify-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
          </span>
          I&apos;m Live!
        </span>
      </button>
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden">
        <div className="aspect-video bg-black flex items-center justify-center">
          {connection.embedUrl ? (
            <iframe
              src={connection.embedUrl}
              className="h-full w-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              title="Stream preview"
            />
          ) : (
            <div className="text-center text-[var(--color-muted)]">
              <div className="text-3xl mb-2">📡</div>
              <div className="text-xs">Stream preview will appear here</div>
              <div className="text-[10px] mt-1">Start your RTMP stream in OBS</div>
            </div>
          )}
        </div>
      </div>
      <div>
        <span className="mb-2 block text-xs font-semibold text-[var(--color-muted)]">
          Share Your Stream
        </span>
        <div className="flex flex-wrap gap-2">
          <ShareButton
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
            label="Twitter / X"
            color="#1DA1F2"
          />
          <ShareButton
            href={`https://nostr.com/intent?text=${encodeURIComponent(shareText)}`}
            label="Nostr"
            color="#8B5CF6"
          />
          <ShareButton
            href={`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}`}
            label="Farcaster"
            color="#7C65C1"
          />
          <ShareButton
            href={`https://bsky.app/intent/compose?text=${encodeURIComponent(shareText)}`}
            label="Bluesky"
            color="#0085FF"
          />
        </div>
      </div>
    </div>
  );
}
