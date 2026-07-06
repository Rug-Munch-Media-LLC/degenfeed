'use client';

import { FeedList, type Notification, NotificationBell, type UnifiedPost } from '@degenfeed/ui';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { TipModal } from '../../../components/TipModal';
import { SECTIONS } from '../sections';

export const runtime = 'edge';

interface Props {
  params: Promise<{ section: string }>;
}

function getProtocolColor(p: string): string {
  const colors: Record<string, string> = {
    nostr: '#8e30eb',
    farcaster: '#8a63d2',
    lens: '#abfe2c',
    bluesky: '#1185fe',
    threads: '#888',
    mastodon: '#6364ff',
    rss: '#ffa500',
  };
  return colors[p] ?? '#666';
}

function SectionNav({ current }: { current: string }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto pb-2">
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`/home/${s.id}`}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            s.id === current ? 'text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
          style={s.id === current ? { backgroundColor: `${s.color}22`, color: s.color } : {}}
        >
          {s.icon} {s.label}
        </a>
      ))}
    </div>
  );
}

function SectionContent({ section }: { section: string }) {
  const { signedInProtocols, engage, openSignIn, openCompose } = useAuth();
  const meta = SECTIONS.find((s) => s.id === section);
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [state, setState] = useState<'loading' | 'loaded' | 'empty' | 'error'>('loading');
  const [error, setError] = useState<string>();
  const [tipPost, setTipPost] = useState<UnifiedPost | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean);

  useEffect(() => {
    if (!hasSignedIn) return;
    const fetchNotifs = async () => {
      try {
        const stored = localStorage.getItem('degenfeed_identities');
        if (!stored) return;
        const parsed = JSON.parse(stored) as Array<{ protocol: string; token?: string }>;
        const auth = JSON.stringify({
          mastodon: parsed.find((i) => i.protocol === 'mastodon')?.token,
        });
        const res = await fetch(`/api/notifications?auth=${encodeURIComponent(auth)}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as { notifications?: Notification[] };
        setNotifications(data.notifications || []);
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, [hasSignedIn]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState('loading');
      try {
        const url = new URL(meta?.endpoint || '/api/feed/home', window.location.origin);
        url.searchParams.set('limit', String(meta?.limit || 25));
        if (meta?.params) {
          for (const [k, v] of Object.entries(meta.params)) url.searchParams.set(k, v);
        }
        let res = await fetch(url.toString(), { credentials: 'include' });
        let data = (await res.json()) as { data?: UnifiedPost[] };
        if (!data.data?.length && section === 'all') {
          const rssUrl = new URL('/api/feed/rss', window.location.origin);
          rssUrl.searchParams.set('source', 'reddit');
          rssUrl.searchParams.set('handle', 'CryptoCurrency');
          rssUrl.searchParams.set('limit', '25');
          res = await fetch(rssUrl.toString(), { credentials: 'include' });
          data = (await res.json()) as { data?: UnifiedPost[] };
        }
        if (cancelled) return;
        setPosts(data.data || []);
        setState(data.data?.length ? 'loaded' : 'empty');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed');
          setState('error');
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [section, meta]);

  const displayName = meta?.label ?? section;
  const color = meta?.color ?? '#666';
  const icon = meta?.icon ?? '●';

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <SectionNav current={section} />

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl" style={{ color }}>
            {icon}
          </span>
          <div>
            <h1 className="text-lg font-bold text-white">{displayName}</h1>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {displayName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasSignedIn && (
            <NotificationBell
              notifications={notifications}
              unreadCount={notifications.filter((n) => !n.read).length}
              onFetch={() => {}}
              onMarkRead={(id) =>
                setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)))
              }
            />
          )}
          {hasSignedIn ? (
            <button type="button" className="btn-primary text-xs" onClick={openCompose}>
              Compose
            </button>
          ) : (
            <button type="button" className="btn-secondary text-xs" onClick={openSignIn}>
              Sign In
            </button>
          )}
        </div>
      </div>

      {hasSignedIn && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="text-degen-400">Signed in:</span>
          {Object.keys(signedInProtocols).map((p) => (
            <span
              key={p}
              className="rounded-full px-2 py-0.5 font-medium"
              style={{ backgroundColor: `${getProtocolColor(p)}22`, color: getProtocolColor(p) }}
            >
              {p}
            </span>
          ))}
          <a href="/profile" className="ml-auto text-degen-500 hover:underline">
            Profile
          </a>
        </div>
      )}

      <FeedList
        state={state}
        posts={posts}
        error={error}
        protocolLabel={displayName}
        onPostClick={(id) => {
          window.location.href = `/post/${encodeURIComponent(id)}`;
        }}
        onEngage={(action, postId) => engage(action, postId, section)}
        onTip={(post) => setTipPost(post)}
        onRetry={() => setState('loading')}
      />

      {state === 'empty' && !hasSignedIn && (
        <div className="card mt-6 border-degen-500/20 bg-degen-500/5 py-6 text-center">
          <h3 className="mb-2 text-base font-bold text-degen-400">See the fediverse</h3>
          <p className="mb-4 text-sm text-gray-400">
            Create a free @degenfeed.xyz Mastodon account to see posts from the fediverse.
          </p>
          <a href="/api/auth/gotosocial/register" className="btn-primary text-sm">
            Create free account →
          </a>
        </div>
      )}

      {tipPost && (
        <TipModal
          open={!!tipPost}
          onClose={() => setTipPost(null)}
          recipientProtocol={tipPost.protocol}
          recipientAuthorId={tipPost.author.id}
          recipientDisplayName={tipPost.author.displayName}
          publicationId={
            tipPost.protocol === 'lens' ? (tipPost.raw as { id?: string })?.id : undefined
          }
        />
      )}
    </div>
  );
}

export default async function SectionPage({ params }: Props) {
  const section = (await params).section;
  return <SectionContent section={section} />;
}
