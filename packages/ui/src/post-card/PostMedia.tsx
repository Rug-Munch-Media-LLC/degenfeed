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
  const embeds = post.embeds ?? [];
  const attachments = post.media ?? [];

  // Guard against url-less embeds (some bridges emit `{ kind: 'link' }` with
  // no URL). Never pass undefined into Image/Link/Video renderers.
  const hasUrl = (e: Embed) => Boolean(e.url);

  const images = embeds.filter((e) => e.kind === 'image' && hasUrl(e)).map((e) => e.url);
  const links = embeds.filter((e) => e.kind === 'link' && hasUrl(e));
  const videoUrls = embeds.filter((e) => e.kind === 'video' && hasUrl(e)).map((e) => e.url);
  const frames = embeds.filter((e) => e.kind === 'frame' && hasUrl(e));
  const audioUrls = embeds.filter((e) => e.kind === 'audio' && hasUrl(e)).map((e) => e.url);

  // `post.media` (MediaAttachment[]: { type, url }) mirrors image/video/audio
  // embeds but carries stable per-attachment metadata. Merge them in so posts
  // whose bridge populates `media` instead of `embeds` still render content.
  const attachmentImages: string[] = [];
  const attachmentVideos: string[] = [];
  const attachmentAudio: string[] = [];
  for (const m of attachments) {
    if (!m?.url) continue;
    const kind = (m.type ?? '').toLowerCase();
    if (kind === 'image' || kind === 'gif') attachmentImages.push(m.url);
    else if (kind === 'video') attachmentVideos.push(m.url);
    else if (kind === 'audio') attachmentAudio.push(m.url);
  }

  // Dedupe by URL so a post with both `embeds` and `media` doesn't render
  // the same image twice.
  const allImages = [...new Set([...images, ...attachmentImages])];
  const mergedVideos = [...new Set([...videoUrls, ...attachmentVideos])];
  const mergedAudio = [...new Set([...audioUrls, ...attachmentAudio])];

  if (
    embeds.length === 0 &&
    allImages.length === 0 &&
    mergedVideos.length === 0 &&
    mergedAudio.length === 0
  ) {
    return null;
  }

  return (
    <>
      {allImages.length > 0 && (
        <ImageGrid images={allImages} authorName={authorName} mediaPriority={mediaPriority} />
      )}
      {frames.map((embed) => (
        <FrameCard key={`frame-${embed.url}`} url={embed.url} />
      ))}
      {frames.length === 0 &&
        post.protocol === 'farcaster' &&
        links.length > 0 &&
        links[0]?.url && <FrameCard key={`link-frame-${links[0].url}`} url={links[0].url} />}
      {mergedAudio.map((url) => (
        <AudioEmbedCard key={`audio-${url}`} embed={{ kind: 'audio', url }} />
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
      {mergedVideos.map((url) => {
        const videoInfo = parseVideoUrl(url);
        if (!videoInfo) {
          return (
            <a
              key={`video-${url}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-xs text-degen-500 hover:text-degen-400 transition-colors truncate"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              ▶ {url.replace(/^https?:\/\//, '').slice(0, 60)}
            </a>
          );
        }
        return <VideoEmbedCard key={`video-${url}`} videoInfo={videoInfo} />;
      })}
    </>
  );
});
