'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnifiedPost } from '@degenfeed/types';
import { formatTimeAgo } from '@degenfeed/utils';
import { getProtocolColor } from '@degenfeed/ui';

function VideoCard({ post }: { post: UnifiedPost }) {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(!!entry?.isIntersecting),
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const videoUrl = post.embeds.find((e) => e.kind === 'video')?.url
    || post.embeds.find((e) => e.kind === 'link')?.url;
  const youtubeId = videoUrl?.match(/(?:v=|\/)([\w-]{11})/)?.[1];

  return (
    <div ref={ref} className={`rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden transition-all ${inView ? 'border-degen-500/20 ring-1 ring-degen-500/10' : ''}`}>
      {youtubeId ? (
        <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={`https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
            alt=""
            className="aspect-video w-full object-cover"
            loading="lazy"
          />
        </a>
      ) : videoUrl ? (
        <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="block aspect-video bg-gray-900 flex items-center justify-center">
          <span className="text-4xl">▶</span>
        </a>
      ) : null}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-gray-500" style={{ color: getProtocolColor(post.protocol) }}>{post.protocol}</span>
          <span className="text-[10px] text-gray-600">{formatTimeAgo(post.createdAt)} ago</span>
        </div>
        <p className="text-sm text-white line-clamp-2 font-medium">{post.text}</p>
        <p className="mt-0.5 text-xs text-gray-500">{post.author.displayName}</p>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-600">
          <span>{post.metrics.likes} likes</span>
          <span>{post.metrics.reposts} reposts</span>
          {post.metrics.quotes > 0 && <span>{post.metrics.quotes} zaps</span>}
        </div>
      </div>
    </div>
  );
}

export default function VideosPage() {
  const [posts, setPosts] = useState<UnifiedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/feed/home?type=video&sort=new&limit=50', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json() as { data?: UnifiedPost[] };
      if (data.data) setPosts(data.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs tracking-widest text-degen-400 uppercase">Video Feed</p>
          <h1 className="text-2xl font-bold text-white">Video</h1>
          <p className="mt-1 text-sm text-gray-500">93 YouTube channels, PeerTube, and video content from all protocols</p>
        </div>
        <Link href="/home/all" className="text-sm text-gray-500 hover:text-white transition-colors">&larr; Feed</Link>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden animate-pulse">
              <div className="aspect-video bg-gray-800" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 rounded bg-gray-800" />
                <div className="h-3 w-1/2 rounded bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="card py-16 text-center">
          <p className="text-gray-500">No videos found.</p>
          <p className="mt-1 text-sm text-gray-600">Video content appears here as it's discovered from RSS, YouTube, and PeerTube feeds.</p>
          <button onClick={load} className="btn-secondary mt-4 text-sm">Refresh</button>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((p) => <VideoCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
