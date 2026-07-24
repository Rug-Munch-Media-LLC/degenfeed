'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { memo } from 'react';
import { BlueskyPostContext } from '../BlueskyPostContext';
import { LemmyThreadView } from '../LemmyThreadView';
import { LensPublicationBadge } from '../LensPublicationBadge';
import { MastodonInstanceContext } from '../MastodonInstanceContext';
import { PeerTubeEmbed } from '../PeerTubeEmbed';

export interface PostThreadProps {
  post: UnifiedPost;
}

export const PostThread = memo(function PostThread({ post }: PostThreadProps) {
  const raw = post.raw as Record<string, unknown> | undefined;

  return (
    <>
      {post.protocol === 'lemmy' && <LemmyThreadView post={post} />}
      {post.protocol === 'peertube' && (
        <PeerTubeEmbed
          url={
            post.embeds.find((e) => e.kind === 'video')?.url ??
            post.embeds.find((e) => e.kind === 'link')?.url ??
            ''
          }
          title={raw?.videoTitle as string | undefined}
          channelName={raw?.channelName as string | undefined}
        />
      )}
      {post.protocol === 'mastodon' && (
        <MastodonInstanceContext
          instance={(raw?.instance as string) ?? 'mastodon.social'}
          federatedFrom={raw?.federatedFrom as string | undefined}
        />
      )}
      {post.protocol === 'lens' && <LensPublicationBadge post={post} />}
      {post.protocol === 'bluesky' && <BlueskyPostContext post={post} />}
      {post.protocol === 'threads' && raw?._viaActivityPub && (
        <span
          className="mb-2 inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-fg) 10%, transparent)',
            color: 'var(--color-fg)',
          }}
          title="Delivered via ActivityPub federation"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M8 2v12M2 8h12"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          via ActivityPub
        </span>
      )}
    </>
  );
});
