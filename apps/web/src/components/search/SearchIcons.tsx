'use client';

import { getProtocolColor, getProtocolIcon } from '@degenfeed/ui';
import Image from 'next/image';

export function SearchIcon({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

export function ProtocolBadge({ protocol }: { protocol: string }) {
  const color = getProtocolColor(protocol);
  return (
    <span
      className="shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span className="text-[0.7em]">{getProtocolIcon(protocol)}</span>
      <span>{protocol}</span>
    </span>
  );
}

export function ResultAvatar({
  url, fallback, protocol, size = 36, rounded = 'full',
}: {
  url?: string | null; fallback: string; protocol: string;
  size?: number; rounded?: 'full' | 'xl' | 'lg';
}) {
  const color = getProtocolColor(protocol);
  const roundClass = rounded === 'full' ? 'rounded-full' : rounded === 'xl' ? 'rounded-xl' : 'rounded-lg';
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden text-xs font-bold ${roundClass}`}
      style={{ backgroundColor: `${color}22`, color }}
    >
      {url ? (
        <Image src={url} alt="" width={size} height={size} className={`h-9 w-9 object-cover ${roundClass}`} />
      ) : (
        fallback[0]?.toUpperCase() || '?'
      )}
    </div>
  );
}
