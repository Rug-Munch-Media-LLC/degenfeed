'use client';

import Image from 'next/image';
import { useCallback, useState } from 'react';
import type { CommunityPost, FeddyCommunity } from './types';

// === Helpers ===========================================================

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString();
}

function shortenWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

// === Post Composer =====================================================

function PostComposer({
  community,
  walletAddress,
  onPostCreated,
}: {
  community: FeddyCommunity;
  walletAddress?: string | null;
  onPostCreated: () => void;
}) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePost = useCallback(async () => {
    if (!text.trim() || posting) return;

    setPosting(true);
    setError(null);

    try {
      const res = await fetch(`/api/feddy/${encodeURIComponent(community.name)}/post`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as Record<string, string>).error || `Failed to post (${res.status})`);
      }

      setText('');
      onPostCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setPosting(false);
    }
  }, [text, posting, community.name, onPostCreated]);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-xs font-bold text-degen-400">
          {walletAddress ? shortenWallet(walletAddress).charAt(0).toUpperCase() : '?'}
        </div>
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Post to ${community.displayName}...`}
            rows={3}
            maxLength={5000}
            className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] p-3 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-all focus:border-degen-500/40"
          />

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-[var(--color-muted)]">{text.length}/5000</span>
            <button
              type="button"
              onClick={handlePost}
              disabled={!text.trim() || posting}
              className="rounded-lg bg-degen-500 px-4 py-1.5 text-xs font-bold text-black transition-all hover:bg-degen-400 disabled:opacity-40"
            >
              {posting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Post Card =========================================================

function PostCard({ post }: { post: CommunityPost }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-all hover:border-[var(--color-border)]">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-xs font-bold text-degen-400">
          {post.authorAvatarUrl ? (
            <Image
              src={post.authorAvatarUrl}
              alt={post.authorDisplayName}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            post.authorDisplayName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--color-fg)]">
              {post.authorDisplayName}
            </span>
            <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
              {formatTime(post.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)] whitespace-pre-wrap">
            {post.text}
          </p>
          {post.embeds && post.embeds.length > 0 && (
            <div className="mt-2 space-y-2">
              {post.embeds.map((embed, i) => (
                <div key={i}>
                  {embed.kind === 'image' && (
                    <Image
                      src={embed.url}
                      alt="Embedded image"
                      width={400}
                      height={300}
                      className="w-full rounded-lg object-cover"
                      style={{ maxHeight: 300 }}
                    />
                  )}
                  {embed.kind === 'link' && (
                    <a
                      href={embed.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] p-3 text-xs text-degen-400 hover:underline"
                    >
                      {(embed.meta?.title as string) || embed.url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-4 text-[10px] text-[var(--color-muted)]">
            <span>♥ {post.likes}</span>
            <span>🔁 {post.boosts}</span>
            <span>💬 {post.replies}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Feed ==============================================================

export function CommunityFeed({
  community,
  posts,
  isMember,
  isPremium,
  walletAddress,
  onPostCreated,
}: {
  community: FeddyCommunity;
  posts: CommunityPost[];
  isMember: boolean;
  isPremium: boolean;
  walletAddress?: string | null;
  onPostCreated: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Composer */}
      {isMember && walletAddress && (
        <PostComposer
          community={community}
          walletAddress={walletAddress}
          onPostCreated={onPostCreated}
        />
      )}

      {!isMember && walletAddress && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center">
          <p className="text-sm text-[var(--color-muted)]">Join this community to post.</p>
        </div>
      )}

      {/* Posts */}
      {posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="mb-3 text-4xl">💬</span>
          <h3 className="mb-1 text-base font-bold text-[var(--color-fg)]">No posts yet</h3>
          <p className="max-w-sm text-sm text-[var(--color-muted)]">
            {isMember
              ? 'Be the first to post in this community!'
              : 'Posts will appear here once members start sharing.'}
          </p>
        </div>
      )}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
