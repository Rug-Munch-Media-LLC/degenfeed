'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { parseVideoUrl } from '@degenfeed/utils';
import { memo } from 'react';
import { FrameCard, ImageGrid, LinkPreview, VideoEmbedCard } from '../PostCardMedia';

export interface PostMediaProps {
  post: UnifiedPost;
  authorName?: string;
}

export const PostMedia = memo(function PostMedia({ post, authorName }: PostMediaProps) {
  if (post.embeds.length === 0) return null;

  const images = post.embeds.filter((e) => e.kind === 'image').map((e) => e.url);
  const links = post.embeds.filter((e) => e.kind === 'link');
  const videos = post.embeds.filter((e) => e.kind === 'video');
  const frames = post.embeds.filter((e) => e.kind === 'frame');

  return (
    <>
      {images.length > 0 && <ImageGrid images={images} authorName={authorName} />}
      {frames.map((embed) => (
        <FrameCard key={`frame-${embed.url}`} url={embed.url} />
      ))}
      {frames.length === 0 &&
        post.protocol === 'farcaster' &&
        links.length > 0 &&
        links[0]?.url && <FrameCard key={`link-frame-${links[0].url}`} url={links[0].url} />}
      {links.map((embed) => {
        const linkVideoInfo = parseVideoUrl(embed.url);
        if (linkVideoInfo) {
          return <VideoEmbedCard key={`link-video-${embed.url}`} videoInfo={linkVideoInfo} />;
        }
        return <LinkPreview key={`link-${embed.url}`} embed={embed} authorName={authorName} />;
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
