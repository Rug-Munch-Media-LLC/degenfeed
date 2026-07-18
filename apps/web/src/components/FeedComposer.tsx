'use client';

import { getPrimaryIdentity } from '@degenfeed/storage';
import { ComposePreview, getProtocolColor, getProtocolIcon } from '@degenfeed/ui';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { publishNoteToNostr } from '../lib/nostr';
import { useAnnouncer } from './ScreenReaderAnnouncer';
import { useToast } from './Toast';

const TARGETS = [
  { id: 'nostr', label: 'Nostr', charLimit: 50000 },
  { id: 'farcaster', label: 'Farcaster', charLimit: 320 },
  { id: 'lens', label: 'Lens', charLimit: 5000 },
  { id: 'bluesky', label: 'Bluesky', charLimit: 300 },
  { id: 'threads', label: 'Threads', charLimit: 500 },
  { id: 'mastodon', label: 'Mastodon', charLimit: 5000 },
];

interface FeedComposerProps {
  signedInProtocols: Record<string, boolean>;
  nostrPublicId?: string;
  onPost: (
    text: string,
    targets: string[],
  ) => Promise<Record<string, { ok: boolean; error?: string }>>;
  onRequestSignIn?: (protocol: string) => void;
}

export function FeedComposer({
  signedInProtocols,
  nostrPublicId,
  onPost,
  onRequestSignIn,
}: FeedComposerProps) {
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bridgeToNostr, setBridgeToNostr] = useState(false);
  const [posting, setPosting] = useState(false);
  const { showToast } = useToast();
  const { announce } = useAnnouncer();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>();
  const [handle, setHandle] = useState<string>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSelected(new Set(TARGETS.filter((t) => signedInProtocols[t.id]).map((t) => t.id)));
  }, [signedInProtocols]);

  useEffect(() => {
    getPrimaryIdentity()
      .then((id) => {
        setAvatar(id?.avatarUrl ?? null);
        setDisplayName(id?.displayName ?? undefined);
        setHandle(id?.handle ?? id?.publicId ?? undefined);
      })
      .catch(() => {});
  }, []);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    setText(el.value);
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, []);

  const handlePost = useCallback(async () => {
    if (!text.trim() || posting || selected.size === 0) return;
    setPosting(true);
    try {
      const targets = Array.from(selected);
      const results = await onPost(text.trim(), targets);
      // Mastodon → Nostr bridge: fire locally-signed Nostr note in parallel
      if (
        bridgeToNostr &&
        nostrPublicId &&
        targets.includes('mastodon') &&
        results.mastodon?.ok !== false
      ) {
        try {
          await publishNoteToNostr({ text: text.trim(), publicId: nostrPublicId });
        } catch {
          /* bridge failure is non-fatal — main post already went out */
        }
      }
      setText('');
      const el = textareaRef.current;
      if (el) {
        el.style.height = 'auto';
      }
      const succeeded = Object.values(results).filter((r) => r.ok).length;
      const targetLabels = targets
        .filter((t) => results[t]?.ok)
        .map((t) => TARGETS.find((x) => x.id === t)?.label || t);
      if (succeeded > 0) {
        showToast('success', `Posted to ${targetLabels.join(', ')}`);
        announce(`Post published to ${targetLabels.join(', ')}`, 'polite');
      }
    } finally {
      setPosting(false);
    }
  }, [text, posting, selected, onPost, bridgeToNostr, nostrPublicId, showToast, announce]);

  const toggleTarget = useCallback(
    (id: string) => {
      if (!signedInProtocols[id]) {
        onRequestSignIn?.(id);
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [signedInProtocols, onRequestSignIn],
  );

  const charCount = text.length;
  const selectedTargets = TARGETS.filter((t) => selected.has(t.id));
  const minCharLimit =
    selectedTargets.length > 0 ? Math.min(...selectedTargets.map((t) => t.charLimit)) : 0;
  const overLimit = minCharLimit > 0 && charCount > minCharLimit;
  const nearLimit = minCharLimit > 0 && charCount > minCharLimit * 0.85 && !overLimit;

  const previewTargets = TARGETS.map((t) => ({
    id: t.id,
    label: t.label,
    charLimit: t.charLimit,
    enabled: selected.has(t.id),
  }));

  return (
    <div className="composer border-b border-white/10 px-4 py-3">
      <div className="flex gap-3">
        <div className="composer-avatar h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-[var(--color-muted)]">
          {avatar ? (
            <Image
              src={avatar}
              alt="Your avatar"
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm text-gray-500">
              ?
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            placeholder="What is happening?!"
            rows={1}
            className="w-full resize-none bg-transparent py-2 text-lg text-[var(--color-fg)] placeholder-gray-600 outline-none"
            aria-label="Compose a new post"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {TARGETS.map((t) => {
              const connected = !!signedInProtocols[t.id];
              const active = selected.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTarget(t.id)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all border ${
                    active ? 'border-current' : 'border-[var(--color-border)] hover:border-gray-600'
                  } ${connected ? '' : 'opacity-40 hover:opacity-70'}`}
                  style={{
                    color: active ? getProtocolColor(t.id) : connected ? '#9ca3af' : '#666',
                    backgroundColor: active ? `${getProtocolColor(t.id)}18` : 'transparent',
                  }}
                  title={
                    connected
                      ? `${t.label} (${t.charLimit} chars)`
                      : `Sign in to ${t.label} to publish`
                  }
                >
                  {!connected ? (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="text-gray-500"
                      aria-hidden="true"
                    >
                      <path
                        d="M8 1C5.5 1 3.5 3 3.5 5.5v2C3 8 2 8.5 2 10v3h12v-3c0-1.5-1-2-1.5-2.5v-2C12.5 3 10.5 1 8 1zM8 13.5c-1 0-1.8-.8-1.8-1.8h3.6c0 1-.8 1.8-1.8 1.8z"
                        fill="currentColor"
                      />
                    </svg>
                  ) : (
                    <span className="text-[0.7em]">{getProtocolIcon(t.id)}</span>
                  )}
                  {t.label}
                </button>
              );
            })}
          </div>

          {selected.has('mastodon') && nostrPublicId && (
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={bridgeToNostr}
                onChange={(e) => setBridgeToNostr(e.target.checked)}
                className="h-3 w-3 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
              />
              <span>
                Also cross-post to <span className="font-medium text-[var(--color-fg)]">Nostr</span>
              </span>
              <span className="text-[10px] text-gray-600">
                (signed locally with your Nostr key)
              </span>
            </label>
          )}

          <ComposePreview
            text={text}
            targets={previewTargets}
            author={
              text.trim() ? { displayName, handle, avatarUrl: avatar ?? undefined } : undefined
            }
          />

          <div className="mt-3 flex items-center justify-between border-t border-[var(--color-glass-border)] pt-3">
            <div className="flex items-center gap-3 text-xs">
              <span
                className={
                  overLimit ? 'text-red-400' : nearLimit ? 'text-yellow-400' : 'text-gray-500'
                }
              >
                {charCount}
                {selected.size > 0 && ` / ${minCharLimit}`}
              </span>
              {selected.size === 0 && (
                <span className="text-yellow-500">Select a network to post</span>
              )}
              {overLimit && (
                <span className="text-red-400">
                  Over {selectedTargets.find((t) => t.charLimit === minCharLimit)?.label} limit
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handlePost}
              disabled={!text.trim() || posting || selected.size === 0 || overLimit}
              className="btn-primary px-4 disabled:opacity-50"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
