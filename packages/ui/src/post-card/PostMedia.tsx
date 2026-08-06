'use client';

import type { Embed, UnifiedPost } from '@degenfeed/types';
import { parseVideoUrl } from '@degenfeed/utils';
import { memo } from 'react';
import {
  AudioEmbedCard,
  FrameCard,
  ImageGrid,
  LinkPreview,
  VideoEmbedCard,
} from '../PostCardMedia';

export interface PostMediaProps {
  post: UnifiedPost;
  authorName?: string;
  /** Eager-load media for above-the-fold cards. */
  mediaPriority?: boolean;
}

export const PostMedia = memo(function PostMedia({
  post,
  authorName,
  mediaPriority = false,
}: PostMediaProps) {
  if (!post.embeds || post.embeds.length === 0) return null;

  // Guard against url-less embeds (some bridges emit `{ kind: 'link' }` with
  // no URL). Never pass undefined into Image/Link/Video renderers.
  const hasUrl = (e: Embed) => Boolean(e.url);

  const images = post.embeds.filter((e) => e.kind === 'image' && hasUrl(e)).map((e) => e.url);
  const links = post.embeds.filter((e) => e.kind === 'link' && hasUrl(e));
  const videos = post.embeds.filter((e) => e.kind === 'video' && hasUrl(e));
  const frames = post.embeds.filter((e) => e.kind === 'frame' && hasUrl(e));
  const audio = post.embeds.filter((e) => e.kind === 'audio' && hasUrl(e));

  return (
    <>
      {images.length > 0 && (
        <ImageGrid images={images} authorName={authorName} mediaPriority={mediaPriority} />
      )}
      {frames.map((embed) => (
        <FrameCard key={`frame-${embed.url}`} url={embed.url} />
      ))}
      {frames.length === 0 &&
        post.protocol === 'farcaster' &&
        links.length > 0 &&
        links[0]?.url && <FrameCard key={`link-frame-${links[0].url}`} url={links[0].url} />}
      {audio.map((embed) => (
        <AudioEmbedCard key={`audio-${embed.url}`} embed={embed} />
      ))}
      {links.map((embed) => {
        const linkVideoInfo = parseVideoUrl(embed.url);
        if (linkVideoInfo) {
          return <VideoEmbedCard key={`link-video-${embed.url}`} videoInfo={linkVideoInfo} />;
        }
        return (
          <LinkPreview
            key={`link-${embed.url}`}
            embed={embed}
            authorName={authorName}
            mediaPriority={mediaPriority}
          />
        );
      })}
      {videos.map((embed) => {
        const videoInfo = parseVideoUrl(embed.url);
        if (!videoInfo) {
          return (
            <a
              key={`video-${embed.url}`}
              href={embed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-xs text-degen-500 hover:text-degen-400 transition-colors truncate"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              ▶ {embed.url.replace(/^https?:\/\//, '').slice(0, 60)}
            </a>
          );
        }
        return <VideoEmbedCard key={`video-${embed.url}`} videoInfo={videoInfo} />;
      })}
    </>
  );
});
