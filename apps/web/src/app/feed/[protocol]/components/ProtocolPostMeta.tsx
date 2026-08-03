'use client';

/**
 * @degenfeed/web — ProtocolPostMeta
 *
 * Per-protocol metadata strip rendered inside each post card on the
 * /feed/[protocol] pages. Shows protocol-native chips (npub, FID, DID,
 * community, subreddit, …) plus a small action row with protocol-specific
 * actions: zap (nostr), open frame (farcaster), open in native app, copy link.
 *
 * The strip is rendered by FeedList's `postMetaSlot` hook, so it appears
 * inside the post's article after the shared PostCard.
 */

import type { EngagementAction, UnifiedPost } from '@degenfeed/types';
import { useCallback, useEffect, useState } from 'react';
import {
  extractProtocolMeta,
  getProtocolInfo,
  nativeAppUrl,
  type ProtocolMetaChips,
} from './protocolMeta';

interface ProtocolPostMetaProps {
  post: UnifiedPost;
  onEngage?: (
    action: EngagementAction,
    postId: string,
    content?: string,
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  onReply?: (post: UnifiedPost) => void;
}

export function ProtocolPostMeta({ post, onEngage, onReply }: ProtocolPostMetaProps) {
  const info = getProtocolInfo(post.protocol);
  const [chips, setChips] = useState<ProtocolMetaChips[]>([]);
  const [nativeUrl, setNativeUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void extractProtocolMeta(post).then((c) => {
      if (!cancelled) setChips(c);
    });
    void nativeAppUrl(post).then((u) => {
      if (!cancelled) setNativeUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [post]);

  const handleCopy = useCallback(async () => {
    const url = `${window.location.origin}/post/${encodeURIComponent(post.dfUri || post.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      window.dispatchEvent(
        new CustomEvent('df-toast', {
          detail: { kind: 'success', message: 'Link copied to clipboard' },
        }),
      );
    } catch {
      /* clipboard unavailable */
    }
  }, [post.dfUri, post.id]);

  const handleZap = useCallback(async () => {
    if (!onEngage) return;
    await onEngage('like', post.id);
  }, [onEngage, post.id]);

  if (
    chips.length === 0 &&
    post.protocol !== 'nostr' &&
    post.protocol !== 'farcaster' &&
    post.protocol !== 'mastodon' &&
    !nativeUrl
  ) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t px-4 py-2"
      style={{
        borderColor: 'var(--color-glass-border)',
        backgroundColor: 'color-mix(in srgb, var(--color-fg) 2%, transparent)',
      }}
    >
      {/* Protocol-native metadata chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => (
          <span
            key={`${chip.label}-${chip.value}`}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none"
            style={{
              backgroundColor: chip.accent ? `${info.color}1c` : 'var(--color-overlay)',
              color: chip.accent ? info.color : 'var(--color-muted)',
            }}
            title={chip.title ?? `${chip.label}: ${chip.value}`}
          >
            <span className="opacity-70">{chip.label}</span>
            <span className="font-semibold tabular-nums">{chip.value}</span>
          </span>
        ))}
      </div>

      {/* Protocol-specific actions */}
      <div className="ml-auto flex items-center gap-1">
        {post.protocol === 'nostr' && onEngage && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleZap();
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors hover:opacity-80"
            style={{ backgroundColor: `${info.color}18`, color: info.color }}
            aria-label={`Zap ${post.author.displayName || 'author'}`}
            title={`Send a Lightning zap (${info.likeVerb})`}
          >
            <span aria-hidden="true">⚡</span>
            <span>{info.likeVerb}</span>
          </button>
        )}

        {post.protocol === 'farcaster' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent('df-toast', {
                  detail: {
                    kind: 'info',
                    message: 'Open the frame from the post preview below',
                  },
                }),
              );
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors hover:opacity-80"
            style={{ backgroundColor: `${info.color}18`, color: info.color }}
            aria-label="Open frame"
            title="This cast contains a Farcaster frame — open it from the embed"
          >
            <span aria-hidden="true">▣</span>
            <span>Frame</span>
          </button>
        )}

        {onReply && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReply(post);
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label={`Reply to ${info.label} ${info.postNoun}`}
          >
            <span aria-hidden="true">↩</span>
            <span>Reply</span>
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void handleCopy();
          }}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
          aria-label="Copy link to post"
        >
          <span aria-hidden="true">🔗</span>
          <span>Copy</span>
        </button>

        {nativeUrl && (
          <a
            href={nativeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label={`Open in ${info.label}`}
            title={`Open in native ${info.label} app`}
          >
            <span aria-hidden="true">↗</span>
            <span>Open</span>
          </a>
        )}
      </div>
    </div>
  );
}
