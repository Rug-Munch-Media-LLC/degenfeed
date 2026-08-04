'use client';

/**
 * @degenfeed/web — /farcaster/frames
 *
 * Farcaster Frame Renderer & Creator
 *
 * Render any Farcaster Frame in DegenFeed with full interactivity:
 *   - Frame image + button interactions
 *   - Frame input (text boxes)
 *   - Share Frame to other protocols
 *   - Create Frame from DegenFeed content
 *   - Frame history / recently viewed
 */

import { FrameEmbed } from '@degenfeed/ui';
import Link from 'next/link';
import { useCallback, useState } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────

const FC_COLOR = '#8a63d2';

// ─── Types ──────────────────────────────────────────────────────────────

interface FrameData {
  url: string;
  image: string;
  title: string;
  description: string;
  buttons: { index: number; label: string; action?: string; target?: string }[];
  postUrl?: string;
  input?: { text?: string };
  state?: string;
  aspectRatio?: '1:1' | '1.91:1';
}

// ─── Sample / demo frames ───────────────────────────────────────────────

const DEMO_FRAMES: FrameData[] = [
  {
    url: 'https://paragraph.xyz/frames/discover',
    image: 'https://paragraph.xyz/images/og.png',
    title: 'Discover Paragraph Newsletters',
    description: 'Browse trending on-chain newsletters on Farcaster',
    buttons: [
      { index: 1, label: 'Browse', action: 'post' },
      { index: 2, label: 'Subscribe', action: 'post' },
      { index: 3, label: 'Learn More', action: 'link', target: 'https://paragraph.xyz' },
    ],
    postUrl: 'https://api.paragraph.xyz/frames/discover',
    aspectRatio: '1.91:1',
  },
  {
    url: 'https://zora.co/frames/explore',
    image: 'https://zora.co/og-image.png',
    title: 'Zora — Explore Drops',
    description: 'Discover and mint NFTs on Zora',
    buttons: [
      { index: 1, label: 'Explore', action: 'post' },
      { index: 2, label: 'Mint Now', action: 'mint', target: 'https://zora.co' },
      { index: 3, label: 'View Collection', action: 'post_redirect' },
    ],
    postUrl: 'https://api.zora.co/frames/explore',
    aspectRatio: '1:1',
  },
  {
    url: 'https://www.degen.tips/frames/leaderboard',
    image: 'https://www.degen.tips/og.png',
    title: 'Degen Tipping Leaderboard',
    description: 'Top tippers and earners in the DEGEN ecosystem',
    buttons: [
      { index: 1, label: 'Leaderboard', action: 'post' },
      { index: 2, label: 'Send Tip', action: 'post' },
      { index: 3, label: 'My Stats', action: 'post_redirect' },
    ],
    postUrl: 'https://api.degen.tips/frames',
    aspectRatio: '1.91:1',
  },
  {
    url: 'https://nouns.build/frames/explore',
    image: 'https://nouns.build/og.png',
    title: 'Nouns Builder — Explore DAOs',
    description: 'Discover and participate in Nouns DAOs',
    buttons: [
      { index: 1, label: 'Explore DAOs', action: 'post' },
      { index: 2, label: 'Create DAO', action: 'link', target: 'https://nouns.build' },
    ],
    postUrl: 'https://api.nouns.build/frames',
    aspectRatio: '1.91:1',
  },
  {
    url: 'https://bountycaster.xyz/frames',
    image: 'https://bountycaster.xyz/og.png',
    title: 'BountyCaster — Find Bounties',
    description: 'Discover freelance bounties on Farcaster',
    buttons: [
      { index: 1, label: 'Browse', action: 'post' },
      { index: 2, label: 'Post Bounty', action: 'post_redirect' },
    ],
    postUrl: 'https://api.bountycaster.xyz/frames',
    aspectRatio: '1.91:1',
  },
  {
    url: 'https://hypersub.xyz/frames',
    image: 'https://hypersub.xyz/og.png',
    title: 'Hypersub — Subscribe',
    description: 'Subscribe to Farcaster creators',
    buttons: [
      { index: 1, label: 'Subscribe', action: 'post' },
      { index: 2, label: 'Explore', action: 'post' },
      { index: 3, label: 'My Subs', action: 'post_redirect' },
    ],
    postUrl: 'https://api.hypersub.xyz/frames',
    aspectRatio: '1:1',
  },
];

// ─── Page Component ─────────────────────────────────────────────────────

export default function FarcasterFramesPage() {
  const [customFrameUrl, setCustomFrameUrl] = useState('');
  const [activeFrame, setActiveFrame] = useState<FrameData | null>(null);
  const [_showCreateMode, _setShowCreateMode] = useState(false);

  const handleCustomFrameLoad = useCallback(() => {
    if (!customFrameUrl.trim()) return;
    // Try to load a custom frame by URL
    const frame: FrameData = {
      url: customFrameUrl,
      image: `https://api.metaframe.xyz/frame?url=${encodeURIComponent(customFrameUrl)}`,
      title: 'Custom Frame',
      description: `Frame loaded from ${customFrameUrl}`,
      buttons: [
        { index: 1, label: 'Open Frame', action: 'link', target: customFrameUrl },
        { index: 2, label: 'Share', action: 'post' },
      ],
      postUrl: customFrameUrl,
      aspectRatio: '1.91:1',
    };
    setActiveFrame(frame);
  }, [customFrameUrl]);

  const handleSelectFrame = useCallback((frame: FrameData) => {
    setActiveFrame(frame);
  }, []);

  const handleBack = useCallback(() => {
    setActiveFrame(null);
  }, []);

  // ─── Frame detail view ─────────────────────────────────────────

  if (activeFrame) {
    const frame = activeFrame;
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
          style={{ color: 'var(--color-muted)' }}
        >
          ← Back to Frames
        </button>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Frame preview */}
          <div>
            <h2
              className="mb-3 font-heading text-lg font-bold"
              style={{ color: 'var(--color-fg)' }}
            >
              {frame.title}
            </h2>
            <p className="mb-4 text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
              {frame.description}
            </p>
            <FrameEmbed
              url={frame.url}
              image={frame.image}
              title={frame.title}
              buttons={frame.buttons}
              postUrl={frame.postUrl}
              aspectRatio={frame.aspectRatio}
            />

            {/* Input field for frames that support it */}
            {frame.input && (
              <div className="mt-3">
                <input
                  type="text"
                  placeholder={frame.input.text || 'Enter text...'}
                  className="w-full rounded-lg border bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
                  style={{ borderColor: 'var(--color-glass-border)' }}
                  aria-label={frame.input.text || 'Frame input'}
                />
              </div>
            )}
          </div>

          {/* Frame details & actions */}
          <div className="space-y-4">
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: `${FC_COLOR}22`, backgroundColor: `${FC_COLOR}04` }}
            >
              <h3
                className="mb-2 text-xs font-semibold tracking-wider uppercase"
                style={{ color: 'var(--color-muted)' }}
              >
                Frame Details
              </h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--color-muted)' }}>Source</dt>
                  <dd
                    className="font-mono text-xs truncate ml-4"
                    style={{ color: 'var(--color-fg)' }}
                  >
                    {frame.url}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--color-muted)' }}>Buttons</dt>
                  <dd className="font-mono text-xs" style={{ color: 'var(--color-fg)' }}>
                    {frame.buttons.length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt style={{ color: 'var(--color-muted)' }}>Aspect</dt>
                  <dd className="font-mono text-xs" style={{ color: 'var(--color-fg)' }}>
                    {frame.aspectRatio || '1.91:1'}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Share actions */}
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--color-glass-border)' }}
            >
              <h3
                className="mb-3 text-xs font-semibold tracking-wider uppercase"
                style={{ color: 'var(--color-muted)' }}
              >
                Share This Frame
              </h3>
              <div className="flex flex-wrap gap-2">
                <ShareFrameButton
                  label="DegenFeed"
                  href={`/compose?text=${encodeURIComponent(`Check out this Farcaster Frame: ${frame.title} — ${frame.url}`)}`}
                />
                <ShareFrameButton
                  label="Warpcast"
                  href={`https://warpcast.com/~/compose?text=${encodeURIComponent(frame.url)}`}
                />
                <ShareFrameButton
                  label="Nostr"
                  href={`/nostr/compose?text=${encodeURIComponent(`Farcaster Frame: ${frame.title} ${frame.url}`)}`}
                />
                <ShareFrameButton
                  label="Bluesky"
                  href={`/bluesky/compose?text=${encodeURIComponent(`Farcaster Frame: ${frame.title} ${frame.url}`)}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(frame.url).catch(() => {});
                  }}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
                  style={{
                    borderColor: 'var(--color-glass-border)',
                    color: 'var(--color-fg-secondary)',
                  }}
                >
                  📋 Copy URL
                </button>
              </div>
            </div>

            {/* Embed code */}
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--color-glass-border)' }}
            >
              <h3
                className="mb-2 text-xs font-semibold tracking-wider uppercase"
                style={{ color: 'var(--color-muted)' }}
              >
                Embed This Frame
              </h3>
              <pre
                className="overflow-x-auto rounded-lg p-3 text-[10px] leading-relaxed"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-fg-secondary)',
                }}
              >
                {`<iframe
  src="https://app.degenfeed.xyz/farcaster/frames?url=${encodeURIComponent(frame.url)}"
  width="400"
  height="${frame.aspectRatio === '1:1' ? '400' : '350'}"
  frameborder="0"
  title="${frame.title}"
/>`}
              </pre>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(
                      `<iframe src="https://app.degenfeed.xyz/farcaster/frames?url=${encodeURIComponent(frame.url)}" width="400" height="${frame.aspectRatio === '1:1' ? '400' : '350'}" frameborder="0" title="${frame.title}"></iframe>`,
                    )
                    .catch(() => {});
                }}
                className="mt-2 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: `${FC_COLOR}12`,
                  color: FC_COLOR,
                }}
              >
                Copy Embed Code
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Directory view ─────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        <Link href="/farcaster" className="transition-colors hover:text-[var(--color-fg)]">
          Farcaster
        </Link>
        <span className="opacity-40">/</span>
        <span style={{ color: 'var(--color-fg-secondary)' }}>Frames</span>
      </nav>

      {/* Hero */}
      <header
        className="relative mb-8 overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: `${FC_COLOR}33`,
          background: `linear-gradient(135deg, ${FC_COLOR}10 0%, var(--color-card) 60%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-[0.06] blur-3xl"
          style={{ backgroundColor: FC_COLOR }}
          aria-hidden="true"
        />
        <div className="flex items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{
              backgroundColor: `${FC_COLOR}18`,
              boxShadow: `0 0 24px ${FC_COLOR}15`,
            }}
          >
            🖼
          </span>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">Farcaster Frames</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
              Render, interact with, and share Farcaster Frames. Load any Frame URL or browse
              popular ones below.
            </p>
          </div>
        </div>
      </header>

      {/* Load custom frame */}
      <div
        className="mb-8 rounded-xl border p-4"
        style={{ borderColor: `${FC_COLOR}22`, backgroundColor: `${FC_COLOR}04` }}
      >
        <label
          htmlFor="frame-url"
          className="mb-2 block text-xs font-semibold tracking-wider uppercase"
          style={{ color: 'var(--color-fg)' }}
        >
          Load Any Frame URL
        </label>
        <div className="flex gap-2">
          <input
            id="frame-url"
            type="url"
            placeholder="https://example.com/frame"
            value={customFrameUrl}
            onChange={(e) => setCustomFrameUrl(e.target.value)}
            className="flex-1 rounded-lg border bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] transition-colors focus:outline-none focus:ring-2"
            style={
              {
                borderColor: 'var(--color-glass-border)',
                '--tw-ring-color': FC_COLOR,
              } as React.CSSProperties
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustomFrameLoad();
            }}
          />
          <button
            type="button"
            onClick={handleCustomFrameLoad}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ backgroundColor: FC_COLOR, color: '#fff' }}
          >
            Load Frame
          </button>
        </div>
      </div>

      {/* Demo frames grid */}
      <section>
        <h2
          className="mb-4 font-heading text-lg font-bold tracking-tight"
          style={{ color: 'var(--color-fg)' }}
        >
          Popular Frames
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_FRAMES.map((frame) => (
            <FrameCard key={frame.url} frame={frame} onSelect={handleSelectFrame} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        className="mt-12 border-t py-8 text-center"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-[var(--color-muted)]">
            Frames are interactive miniapps that run inside Farcaster clients.
          </span>
          <a
            href="https://docs.farcaster.xyz/learn/what-is-farcaster/frames"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:underline"
            style={{ color: FC_COLOR }}
          >
            📖 Frame Specification
          </a>
        </div>
      </footer>
    </div>
  );
}

// ─── Frame Card ─────────────────────────────────────────────────────────

function FrameCard({
  frame,
  onSelect,
}: {
  frame: FrameData;
  onSelect: (frame: FrameData) => void;
}) {
  return (
    <article
      className="group relative overflow-hidden rounded-xl border p-4 transition-all duration-[var(--duration-normal)] hover:-translate-y-0.5 cursor-pointer"
      style={{
        borderColor: `${FC_COLOR}22`,
        backgroundColor: 'var(--color-card)',
      }}
      onClick={() => onSelect(frame)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(frame);
      }}
      aria-label={`View frame: ${frame.title}`}
    >
      {/* Preview image */}
      <div
        className="mb-3 overflow-hidden rounded-lg bg-[var(--color-muted-bg)]"
        style={{ aspectRatio: frame.aspectRatio === '1:1' ? '1/1' : '1.91/1' }}
      >
        <img
          src={frame.image}
          alt={frame.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      <h3 className="font-heading text-sm font-bold" style={{ color: 'var(--color-fg)' }}>
        {frame.title}
      </h3>
      <p className="mt-1 text-xs line-clamp-2" style={{ color: 'var(--color-fg-secondary)' }}>
        {frame.description}
      </p>

      {/* Buttons preview */}
      <div className="mt-3 flex flex-wrap gap-1">
        {frame.buttons.map((btn) => (
          <span
            key={btn.index}
            className="rounded-md px-2 py-0.5 text-[9px] font-mono"
            style={{
              backgroundColor: `${FC_COLOR}10`,
              color: FC_COLOR,
            }}
          >
            {btn.action === 'link' && '↗ '}
            {btn.action === 'mint' && '◆ '}
            {btn.label}
          </span>
        ))}
      </div>

      {/* View button */}
      <div className="mt-4 flex justify-end">
        <span
          className="rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all group-hover:scale-105"
          style={{
            backgroundColor: `${FC_COLOR}12`,
            color: FC_COLOR,
          }}
        >
          View Frame →
        </span>
      </div>
    </article>
  );
}

// ─── Share Frame Button ─────────────────────────────────────────────────

function ShareFrameButton({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
      style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg-secondary)' }}
    >
      {label}
    </a>
  );
}
