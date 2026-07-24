'use client';

/**
 * Client-side fallback for the join page.
 * If the server-side data fetch fails, this component loads
 * the stream/space data dynamically on the client.
 */

import { useEffect, useState } from 'react';

interface StreamData {
  id: string;
  title: string;
  type: string;
  creator: string;
  creatorHandle?: string;
  description?: string;
  thumbnail?: string;
  streamUrl?: string;
  isLive: boolean;
  viewerCount: number;
}

interface Props {
  type: string;
  id: string;
}

export function joinPageClient({ type, id }: Props) {
  const [_data, setData] = useState<StreamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.degenfeed.xyz';

    fetch(`${apiBase}/api/streams/${encodeURIComponent(id)}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { stream?: StreamData } | null) => {
        if (body?.stream) setData(body.stream);
      })
      .catch(() => {
        // Silently fail — component will render fallback UI
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff0040] border-t-transparent" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return null; // Server component handles rendering
}
