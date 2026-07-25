'use client';

/**
 * @degenfeed/ui — MentionAutocomplete & HashtagAutocomplete
 *
 * Inline autocomplete for @mentions and #hashtags.
 * Uses a virtual list of recently interacted profiles / trending hashtags.
 */

import { memo, useEffect, useMemo, useRef, useState } from 'react';

/* ─── Types ────────────────────────────────────────────────── */

export interface MentionUser {
  id: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
  protocol?: string;
}

export interface AutocompleteHandlers {
  /** Called when user selects a suggestion. Returns the replacement text (including @/@/handle/word suffix). */
  onSelect: (item: string, type: 'mention' | 'hashtag') => void;
}

/* ─── Props ────────────────────────────────────────────────── */

interface MentionAutocompleteProps {
  /** The partial query after @ — e.g. "alice" from typing "@alice" */
  query: string;
  /** Position in the textarea where the @ was typed */
  position: { top: number; left: number } | null;
  /** Available users to search (can be passed from parent or we fetch) */
  users?: MentionUser[];
  onSelect: (handle: string) => void;
  onClose: () => void;
}

/* ─── Fake user database (in prod, fetch from search API) ─── */

const FALLBACK_USERS: MentionUser[] = [
  { id: '1', handle: 'alice', displayName: 'Alice', protocol: 'nostr' },
  { id: '2', handle: 'bob', displayName: 'Bob', protocol: 'farcaster' },
  { id: '3', handle: 'charlie', displayName: 'Charlie', protocol: 'lens' },
  { id: '4', handle: 'degen', displayName: 'Degen Maxi', protocol: 'bluesky' },
  { id: '5', handle: 'vitalik', displayName: 'Vitalik Buterin', protocol: 'farcaster' },
  { id: '6', handle: 'jack', displayName: 'Jack Dorsey', protocol: 'nostr' },
];

/* ─── Mention Autocomplete ─────────────────────────────────── */

export const MentionAutocomplete = memo(function MentionAutocomplete({
  query,
  position,
  users: externalUsers,
  onSelect,
  onClose,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const users = externalUsers ?? FALLBACK_USERS;

  const filtered = useMemo(
    () =>
      query
        ? users.filter(
            (u) =>
              u.handle.toLowerCase().includes(query.toLowerCase()) ||
              u.displayName?.toLowerCase().includes(query.toLowerCase()),
          )
        : users,
    [query, users],
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filtered[activeIdx];
        if (selected) {
          onSelect(`@${selected.handle} `);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, activeIdx, onSelect, onClose]);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIdx(0);
  }, []);

  if (!position || filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="mention-autocomplete"
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 100,
      }}
      role="listbox"
      aria-label="User suggestions"
    >
      {filtered.slice(0, 8).map((user, idx) => (
        <button
          key={user.id}
          type="button"
          role="option"
          aria-selected={idx === activeIdx}
          className={`mention-autocomplete-item ${idx === activeIdx ? 'active' : ''}`}
          onClick={() => onSelect(`@${user.handle} `)}
          onMouseEnter={() => setActiveIdx(idx)}
        >
          <span className="mention-avatar">{user.displayName?.[0] ?? user.handle[0] ?? '?'}</span>
          <span className="mention-name">{user.displayName ?? user.handle}</span>
          <span className="mention-handle">@{user.handle}</span>
          {user.protocol && <span className="mention-protocol">{user.protocol}</span>}
        </button>
      ))}
    </div>
  );
});

/* ─── Hashtag Autocomplete ─────────────────────────────────── */

const TRENDING_HASHTAGS = [
  'bitcoin',
  'ethereum',
  'solana',
  'defi',
  'nft',
  'memecoin',
  'ai',
  'web3',
  'crypto',
  'layer2',
  'degen',
  'base',
  'arbitrum',
  'polygon',
  'bitcoinnews',
  'ethereumnews',
  'cryptogaming',
  'privacy',
  'oss',
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
];

interface HashtagAutocompleteProps {
  query: string;
  position: { top: number; left: number } | null;
  onSelect: (hashtag: string) => void;
  onClose: () => void;
}

export const HashtagAutocomplete = memo(function HashtagAutocomplete({
  query,
  position,
  onSelect,
  onClose,
}: HashtagAutocompleteProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = useMemo(
    () =>
      query ? TRENDING_HASHTAGS.filter((h) => h.includes(query.toLowerCase())) : TRENDING_HASHTAGS,
    [query],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filtered[activeIdx];
        if (selected) {
          onSelect(`#${selected} `);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, activeIdx, onSelect, onClose]);

  useEffect(() => {
    setActiveIdx(0);
  }, []);

  if (!position || filtered.length === 0) return null;

  return (
    <div
      className="hashtag-autocomplete"
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 100,
      }}
      role="listbox"
      aria-label="Hashtag suggestions"
    >
      {filtered.slice(0, 10).map((tag, idx) => (
        <button
          key={tag}
          type="button"
          role="option"
          aria-selected={idx === activeIdx}
          className={`hashtag-autocomplete-item ${idx === activeIdx ? 'active' : ''}`}
          onClick={() => onSelect(`#${tag} `)}
          onMouseEnter={() => setActiveIdx(idx)}
        >
          <span className="hashtag-icon">#</span>
          <span className="hashtag-text">{tag}</span>
        </button>
      ))}
    </div>
  );
});
