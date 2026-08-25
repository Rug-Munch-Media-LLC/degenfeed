'use client';

//
// Shared profile content for /profile/[protocol]/[id] and the nested
// /profile/lemmy/[instance]/[username] route.
//
// Aggregates a user's profile + posts for ANY protocol (Nostr, Mastodon,
// Bluesky, Farcaster, Lens, Reddit, YouTube, SoundCloud, Lemmy, …) from our
// index. Post cards link here via the clickable author name/avatar in
// PostHeader (getAuthorProfileHref in @degenfeed/utils).
//
// `id` may be:
//   - a native id (npub/hex pubkey, DID, FID, channel id…)
//   - a handle (lens handle, reddit username)
//   - a fediverse acct `user@instance` (mastodon, lemmy — the nested lemmy
//     route combines `{instance}/{username}` back into `user@instance`).
//
// Data source: the protocol feed filtered to the requested author. The
// author identity embedded in the first matching post provides the profile
// header (avatar, display name, handle, bio, followers, verified). The
// bridge identity endpoint is also probed for enrichment but its absence
// never blocks the page.
//

import type { EngagementAction, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import { ErrorBoundary, FeedList, ProtocolBadge } from '@degenfeed/ui';
import {
  getExternalProfileUrl,
  getProfileUrlFromParts,
  getProtocolColor,
  getProtocolIcon,
  getProtocolLabel,
} from '@degenfeed/utils';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';

interface Props {
  protocol: string;
  /** Native id, handle, or fediverse `user@instance` acct. */
  id: string;
}

interface ProfileEnrichment {
  profile?: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    totalFollowers?: number;
    handles?: Array<{ protocol: string; handle: string; verified?: boolean }>;
  };
}

function fallbackIdentity(protocol: string, id: string, handle: string): UnifiedIdentity {
  return {
    id: `${protocol}:${id}`,
    primary: { protocol: protocol as UnifiedIdentity['primary']['protocol'], id },
    handles: { [protocol]: handle } as UnifiedIdentity['handles'],
    displayName: handle || id,
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  };
}

/**
 * Match a post's author against the profile id in the URL. Handles native
 * ids, `protocol:id` forms, plain handles, and fediverse `user@instance`
 * accts (lemmy nested route passes `username@instance`).
 */
function matchesAuthor(post: UnifiedPost, protocol: string, rawId: string): boolean {
  const a = post.author;
  const primaryId = a.primary?.id ?? '';
  const handle = a.handles?.[protocol as keyof typeof a.handles] ?? '';

  if (rawId.includes('@')) {
    // `user@instance` acct (lemmy/mastodon) — compare both parts.
    const [user, instance] = rawId.split('@');
    if (user && instance) {
      if (handle === `${user}@${instance}`) return true;
      if (handle === `@${user}@${instance}`) return true;
      if (a.id === `${protocol}:${user}@${instance}`) return true;
      if (primaryId === user) return true;
    }
  }
  if (handle.includes('@')) {
    // Handle is `user@instance`; URL carries just the username.
    const [user] = handle.split('@');
    if (user && user === rawId) return true;
  }

  return (
    primaryId === rawId ||
    a.id === rawId ||
    a.id === `${protocol}:${rawId}` ||
    handle === rawId ||
    handle === `@${rawId}` ||
    handle.replace(/^u\//, '') === rawId
  );
}

/** Display form of a handle: fediverse accts get the leading `@`. */
function formatHandle(protocol: string, handle: string): string {
  if (!handle) return '';
  if (
    (protocol === 'lemmy' || protocol === 'mastodon' || protocol === 'gotosocial') &&
    handle.includes('@') &&
    !handle.startsWith('@')
  ) {
    return `@${handle}`;
  }
  return handle;
}

export function ProfilePageContent({ protocol, id }: Props) {
  const router = useRouter();
  const { engage } = useAuth();

  // Adapt the auth engage signature (action, postId, protocol, opts) to the
  // EngageHandler contract (action, postId, content?) used by FeedList.
  const handleEngage = useCallback(
    async (action: EngagementAction, postId: string, content?: string) => {
      return engage(action, postId, protocol, { content });
    },
    [engage, protocol],
  );

  const decodedId = useMemo(() => {
    try {
      return decodeURIComponent(id);
    } catch {
      return id;
    }
  }, [id]);

  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [profile, setProfile] = useState<ProfileEnrichment | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setError('');

    const load = async () => {
      // 1. Enrichment (best-effort — bridge may not resolve arbitrary ids).
      try {
        const res = await fetch(
          `/api/identity/profile?protocol=${encodeURIComponent(protocol)}&id=${encodeURIComponent(decodedId)}&depth=basic`,
        );
        if (res.ok) {
          const data = (await res.json()) as ProfileEnrichment;
          if (!cancelled) setProfile(data);
        }
      } catch {
        /* enrichment is optional */
      }

      // 2. Posts from the protocol feed filtered to this author.
      try {
        const res = await fetch(`/api/feed/${encodeURIComponent(protocol)}?limit=50`);
        if (!res.ok) throw new Error(`Feed returned ${res.status}`);
        const data = (await res.json()) as { data?: UnifiedPost[]; meta?: { errors?: string[] } };
        const all = Array.isArray(data.data) ? data.data : [];
        const mine = all.filter((post) => matchesAuthor(post, protocol, decodedId));
        if (!cancelled) {
          setPosts(mine);
          setState(mine.length > 0 ? 'loaded' : 'empty');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load profile');
          setState('error');
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [protocol, decodedId]);

  // Profile header from the first matching post's author identity.
  const author: UnifiedIdentity | undefined = posts[0]?.author;
  const handle = author?.handles?.[protocol as keyof typeof author.handles] ?? decodedId;
  const displayName = profile?.profile?.displayName || author?.displayName || handle || decodedId;
  const bio = profile?.profile?.bio ?? author?.bio ?? '';
  const avatarUrl = profile?.profile?.avatarUrl ?? author?.avatarUrl ?? '';
  const followerCount = profile?.profile?.totalFollowers ?? author?.followerCount ?? 0;
  const handleMap = (author?.handles ?? {}) as Record<string, string | null>;
  const verified =
    (author?.verified && author.verified.length > 0) ||
    (handleMap.nip05 != null && handleMap.nip05 !== '') ||
    profile?.profile?.handles?.some((h) => h.protocol === protocol && h.verified) === true;

  const color = getProtocolColor(protocol);
  const label = getProtocolLabel(protocol);
  const icon = getProtocolIcon(protocol);
  const identity =
    author ??
    fallbackIdentity(protocol, decodedId, typeof handle === 'string' ? handle : decodedId);
  const externalUrl =
    getExternalProfileUrl(identity, protocol) ||
    getProfileUrlFromParts(protocol, decodedId, typeof handle === 'string' ? handle : undefined);

  return (
    <ErrorBoundary>
      <div className="mx-auto w-full max-w-2xl px-4 py-6 animate-page-enter">
        {/* ── Profile header ── */}
        <header className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <div className="flex items-start gap-4">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={`Avatar of ${displayName}`}
                width={64}
                height={64}
                sizes="64px"
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-2"
                style={{ ['--tw-ring-color' as string]: `${color}66` } as React.CSSProperties}
                priority
              />
            ) : (
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold"
                style={{ backgroundColor: `${color}1f`, color, border: `1px solid ${color}40` }}
                role="img"
                aria-label={`Avatar of ${displayName}`}
              >
                {displayName?.[0]?.toUpperCase() || icon || '?'}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-bold text-[var(--color-fg)]">{displayName}</h1>
                {verified && (
                  <span
                    className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-blue-400"
                    style={{ backgroundColor: '#3b82f620' }}
                    title="Verified"
                  >
                    ✓
                  </span>
                )}
                <ProtocolBadge protocol={protocol} size="sm" />
              </div>

              <div className="mt-0.5 truncate text-sm text-[var(--color-muted)]">
                {typeof handle === 'string' ? formatHandle(protocol, handle) : ''}
                {followerCount > 0 && (
                  <>
                    <span className="mx-1.5">·</span>
                    <span className="font-medium text-[var(--color-fg)]">
                      {formatCount(followerCount)} followers
                    </span>
                  </>
                )}
              </div>

              {bio && <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg)]">{bio}</p>}

              {externalUrl && (
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  {icon} View on {label} ↗
                </a>
              )}
            </div>
          </div>
        </header>

        {/* ── Posts from this author ── */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          {label} posts
        </h2>
        <FeedList
          state={state}
          posts={posts}
          error={error || undefined}
          protocolLabel={label}
          protocolColor={color}
          onPostClick={(postId) => router.push(`/post/${encodeURIComponent(postId)}`)}
          onEngage={handleEngage}
          onRetry={() => {
            setState('loading');
            void (async () => {
              try {
                const res = await fetch(`/api/feed/${encodeURIComponent(protocol)}?limit=50`);
                const data = (await res.json()) as { data?: UnifiedPost[] };
                const mine = Array.isArray(data.data)
                  ? data.data.filter((post) => matchesAuthor(post, protocol, decodedId))
                  : [];
                setPosts(mine);
                setState(mine.length > 0 ? 'loaded' : 'empty');
              } catch {
                setError('Failed to load posts');
                setState('error');
              }
            })();
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
