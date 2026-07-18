/**
 * @degenfeed/ui — FeedWhyCard
 *
 * "Why this post?" transparency panel.
 * Explains to the user why a specific post appeared in their feed,
 * using non-technical language and the ranking algorithm's debug signals.
 *
 * Shows:
 *   - Main reason (the strongest signal)
 *   - Secondary signals
 *   - Filter status (not muted/blocked)
 *   - Source protocol
 *   - "Manage your feed preferences" link
 */

import type { FeedDebug, UnifiedPost } from '@degenfeed/types';
import { memo, useMemo } from 'react';

export interface FeedWhyCardProps {
  /** The post to explain. Must have `score` and/or `feedDebug` populated. */
  post: UnifiedPost;
  /** Called when the user closes the panel. */
  onClose: () => void;
}

// ─── Human-readable translations of machine signal names ───────────

const SIGNAL_LABELS: Record<string, string> = {
  fresh: 'This post was published recently — fresh content gets priority',
  viral: 'High engagement — lots of likes and reposts across the network',
  'on-topic': 'Matches topics you care about based on your activity',
  'original-content': 'Original content — not a repost or link-only post',
  media: 'Contains images or video, which enrich the feed',
  'verified-author': 'Published by a verified creator',
  'established-author': 'From an established account with followers',
  'trending-now': 'Gaining rapid engagement right now',
  followed: 'You follow this author',
  'muted-penalty': 'This topic was partially reduced because you muted similar content',
  'author-diversity': 'Shown less often to keep the feed varied',
  'high-quality': 'High-quality content detected by our quality filter',
};

const SIGNAL_ICONS: Record<string, string> = {
  fresh: '🕐',
  viral: '🔥',
  'on-topic': '🎯',
  'original-content': '✍️',
  media: '🖼️',
  'verified-author': '✅',
  'established-author': '⭐',
  'trending-now': '📈',
  followed: '👤',
  'high-quality': '💎',
};

// ─── Signal priority for determining the "main reason" ────────────

const SIGNAL_PRIORITY: Record<string, number> = {
  followed: 100,
  'verified-author': 90,
  'high-quality': 80,
  viral: 70,
  'trending-now': 65,
  'on-topic': 60,
  'original-content': 50,
  'established-author': 40,
  media: 30,
  fresh: 20,
};

function getMainReason(reasons: string[], debug?: FeedDebug): { icon: string; text: string } {
  // Priority-ordered: pick the highest-priority signal
  const sorted = [...reasons].sort((a, b) => (SIGNAL_PRIORITY[a] ?? 0) - (SIGNAL_PRIORITY[b] ?? 0));
  const best = sorted[sorted.length - 1];
  if (best && SIGNAL_LABELS[best]) {
    return { icon: SIGNAL_ICONS[best] ?? '◆', text: SIGNAL_LABELS[best] };
  }

  // Fallback: build a main reason from debug data
  if (debug) {
    const signals: { score: number; label: string }[] = [];
    if (debug.topicMatch > 0.7)
      signals.push({ score: debug.topicMatch, label: 'Matches your interests' });
    if (debug.velocity > 1.5) signals.push({ score: debug.velocity, label: 'Gaining traction' });
    if (debug.authorReputation > 1)
      signals.push({ score: debug.authorReputation, label: 'From a reputable creator' });
    if (debug.freshness > 1.2) signals.push({ score: debug.freshness, label: 'Recently posted' });
    if (debug.qualityScore > 0.8)
      signals.push({ score: debug.qualityScore, label: 'High-quality content' });
    signals.sort((a, b) => b.score - a.score);
    if (signals.length > 0) {
      return { icon: '◆', text: signals[0]?.label ?? '' };
    }
  }

  return { icon: '◆', text: 'Scored by the DegenFeed ranking algorithm' };
}

// ─── Format a protocol string for display ─────────────────────────

const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads',
  reddit: 'Reddit',
  rss: 'RSS',
  lemmy: 'Lemmy',
  peertube: 'PeerTube',
  youtube: 'YouTube',
  ethereum: 'Ethereum',
  solana: 'Solana',
  ponder: 'Ponder',
};

function protocolLabel(protocol: string): string {
  return PROTOCOL_LABELS[protocol] ?? protocol;
}

// ─── Component ────────────────────────────────────────────────────

export const FeedWhyCard = memo(function FeedWhyCard({ post, onClose }: FeedWhyCardProps) {
  const { score, feedDebug } = post;

  const mainReason = useMemo(
    () => getMainReason(score?.reasons ?? [], feedDebug),
    [score?.reasons, feedDebug],
  );

  // Filter secondary signals (exclude the main one, keep the rest)
  const secondarySignals = useMemo(() => {
    const results: { icon: string; text: string }[] = [];
    const seen = new Set<string>();
    for (const r of score?.reasons ?? []) {
      if (seen.has(r)) continue;
      seen.add(r);
      if (r === 'followed') {
        results.push({
          icon: '👤',
          text: `You follow @${post.author.displayName}${post.author.handles[post.protocol] ? ` on ${protocolLabel(post.protocol)}` : ''}`,
        });
      } else if (SIGNAL_LABELS[r] && SIGNAL_LABELS[r] !== mainReason.text) {
        results.push({ icon: SIGNAL_ICONS[r] ?? '•', text: SIGNAL_LABELS[r] });
      }
    }
    // Add supplementary signals from debug data if not already covered
    if (feedDebug && !seen.has('high-quality') && feedDebug.qualityScore > 0.8) {
      results.push({
        icon: '💎',
        text: `High quality score (${feedDebug.qualityScore.toFixed(2)})`,
      });
    }
    if (feedDebug && !seen.has('verified-author') && feedDebug.authorReputation >= 1) {
      results.push({ icon: '✅', text: 'From a verified creator' });
    }
    if (feedDebug && !seen.has('trending-now') && feedDebug.velocity > 1.3) {
      results.push({ icon: '📈', text: 'Gaining rapid engagement' });
    }
    return results;
  }, [score?.reasons, feedDebug, post, mainReason.text]);

  // Quality score for display
  const _qualityScore =
    feedDebug?.qualityScore ?? (score?.quality ? Math.min(score.quality / 10, 1) : null);

  return (
    <div className="rounded-2xl border border-degen-500/30 bg-[var(--color-card)] p-4 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-degen-500/15 text-xs text-degen-400">
            ?
          </span>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">Why this post?</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-muted)] transition-colors"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M12 4L4 12M4 4l8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Main reason — largest signal */}
      <div className="mb-3 rounded-xl bg-degen-500/5 p-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-base">{mainReason.icon}</span>
          <div>
            <p className="text-xs font-medium text-[var(--color-fg)]">{mainReason.text}</p>
            <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
              Main reason this post appeared
            </p>
          </div>
        </div>
      </div>

      {/* Secondary signals */}
      {secondarySignals.length > 0 && (
        <div className="mb-3 space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Also contributing
          </p>
          {secondarySignals.slice(0, 5).map((_s, _i) => (
            {/* biome-ignore lint/suspicious/noArrayIndexKey: static list */}
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-xs text-[var(--color-muted)]">{s.icon}</span>
              <span className="text-xs text-[var(--color-muted)]">{s.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter status */}
      <div className="mb-3 rounded-lg border border-[var(--color-glass-border)] p-2.5">
        <div className="flex items-center gap-2 text-xs">
          {feedDebug?.isMutedOrBlocked ? (
            <>
              <span className="text-red-400">⚠️</span>
              <span className="text-red-400">This author is muted or blocked</span>
            </>
          ) : (
            <>
              <span className="text-degen-400">✓</span>
              <span className="text-[var(--color-muted)]">Not muted or blocked</span>
            </>
          )}
        </div>
</div>

{
  /* Source + quality */
}
<div className="mb-3 grid grid-cols-2 gap-2 text-xs">
  <div className="rounded-lg bg-[var(--color-muted)] p-2">
    <span className="block text-[10px] text-[var(--color-muted)]">Source</span>
    <span className="font-medium text-[var(--color-muted)]">
      {feedDebug
        ? `${protocolLabel(feedDebug.sourceProtocol)} via DegenFeed bridge`
        : protocolLabel(post.protocol)}
    </span>
  </div>
  <div className="rounded-lg bg-[var(--color-muted)] p-2">
    <span className="block text-[10px] text-[var(--color-muted)]">Quality</span>
    <span className="font-medium text-[var(--color-muted)]">
      {qualityScore !== null ? `${(qualityScore * 100).toFixed(0)}/100` : 'N/A'}
    </span>
  </div>
</div>;

{
  /* Score breakdown (if available) */
}
{
  score && (
    <details className="group mb-3">
      <summary className="cursor-pointer text-[10px] font-medium text-[var(--color-muted)] hover:text-[var(--color-muted)] transition-colors">
        <span className="inline-flex items-center gap-1">
          <svg
            width="8"
            height="8"
            viewBox="0 0 16 16"
            fill="none"
            className="transition-transform group-open:rotate-90"
            aria-hidden="true"
          >
            <path
              d="M6 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Algorithm score breakdown
        </span>
      </summary>
      <div className="mt-2 space-y-1">
        <ScoreBar label="Recency" value={score.recency} max={2} color="bg-blue-500" />
        <ScoreBar label="Engagement" value={score.engagement} max={5} color="bg-orange-500" />
        <ScoreBar label="Relevance" value={score.relevance} max={3} color="bg-green-500" />
        <ScoreBar label="Quality" value={score.quality} max={3} color="bg-purple-500" />
        <ScoreBar label="Velocity" value={score.velocity} max={3} color="bg-yellow-500" />
        <ScoreBar label="Source" value={score.source} max={2} color="bg-gray-500" />
        <div className="flex items-center justify-between pt-1 text-[10px] font-semibold text-degen-400">
          <span>Total score</span>
          <span>{score.total.toFixed(1)}</span>
        </div>
      </div>
    </details>
  );
}

{
  /* Manage feed link */
}
<a
  href="/settings"
  onClick={(e) => {
    e.preventDefault();
    window.location.href = '/settings';
  }}
  className="mt-2 block text-center text-xs text-degen-500 hover:text-degen-400 underline decoration-dotted transition-colors"
>
  Manage your feed preferences →
</a>;
</div>
  )
})

// ─── Tiny score bar sub-component ─────────────────────────────────

function ScoreBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
      <span className="w-16 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-muted)]">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono text-[9px] text-[var(--color-muted)]">
        {value.toFixed(2)}
      </span>
    </div>
  );
}
