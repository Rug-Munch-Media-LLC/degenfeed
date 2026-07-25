'use client';

import { useState } from 'react';
import { getAdaptiveQuality } from './hooks';
import { IconSettings, IconWifi } from './StreamIcons';
import type { StreamQuality } from './types';

const QUALITY_OPTIONS = [
  { id: 'auto' as const, label: 'Auto (Adaptive)', bitrate: '' },
  { id: '1080p' as const, label: '1080p', bitrate: '6-15 Mbps' },
  { id: '720p' as const, label: '720p', bitrate: '3-6 Mbps' },
  { id: '480p' as const, label: '480p', bitrate: '1-3 Mbps' },
  { id: '360p' as const, label: '360p', bitrate: '<1 Mbps' },
];

interface StreamQualitySelectorProps {
  quality: StreamQuality;
  onSelect: (q: StreamQuality) => void;
  estimatedMbps: number | null;
}

export function StreamQualitySelector({
  quality,
  onSelect,
  estimatedMbps,
}: StreamQualitySelectorProps) {
  const [open, setOpen] = useState(false);
  const adaptiveQuality = getAdaptiveQuality(estimatedMbps);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Video quality"
      >
        <IconSettings /> {quality}
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl">
          {QUALITY_OPTIONS.map((opt) => {
            const isAdaptive = opt.id === adaptiveQuality && estimatedMbps !== null;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-white/5 ${
                  quality === opt.id ? 'text-degen-400 bg-degen-500/10' : 'text-white/70'
                }`}
              >
                <span className="flex items-center gap-2">
                  {opt.label}
                  {isAdaptive && (
                    <span className="rounded bg-degen-500/20 px-1 text-[8px] text-degen-400">
                      BEST
                    </span>
                  )}
                </span>
                <span className="text-[9px] text-white/40">{opt.bitrate}</span>
              </button>
            );
          })}
          {estimatedMbps && (
            <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
              <IconWifi quality={estimatedMbps} />
              <span className="text-[9px] text-white/40">{estimatedMbps.toFixed(1)} Mbps</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
