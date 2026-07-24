'use client';

import { memo, useEffect, useState } from 'react';
import { FrameEmbed } from '../FrameEmbed';

interface FrameData {
  url: string;
  image: string;
  title?: string;
  buttons: Array<{ index: number; label: string; action?: string; target?: string }>;
  postUrl?: string;
  version: string;
}

export interface FarcasterFrameProps {
  url: string;
}

export const FarcasterFrame = memo(function FarcasterFrame({ url }: FarcasterFrameProps) {
  const [frame, setFrame] = useState<FrameData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/frame/resolve?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? (r.json() as Promise<FrameData>) : null))
      .then((d) => {
        if (!cancelled && d?.image) setFrame(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!frame) return null;

  return (
    <FrameEmbed
      url={frame.url}
      image={frame.image}
      title={frame.title}
      buttons={frame.buttons}
      postUrl={frame.postUrl}
    />
  );
});
