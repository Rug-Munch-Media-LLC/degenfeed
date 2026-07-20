'use client';

/**
 * ShortsCreatorInfo — Creator avatar, display name, handle, and follow button.
 */

import Image from 'next/image';

interface ShortsCreatorInfoProps {
  avatarUrl?: string;
  displayName: string;
  handle: string;
  protocol?: string;
  protocolColor?: string;
  onFollow?: () => void;
  following?: boolean;
}

export function ShortsCreatorInfo({
  avatarUrl,
  displayName,
  handle,
  protocol,
  protocolColor = '#666',
  onFollow,
  following,
}: ShortsCreatorInfoProps) {
  return (
    <div className="flex items-center gap-2">
      <a
        href={`/profile?protocol=${protocol}&id=${encodeURIComponent(handle)}`}
        className="flex items-center gap-2 group shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full border border-white/10 object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-degen-500/20 text-xs font-bold text-degen-400">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </a>

      <div className="flex-1 min-w-0">
        <a
          href={`/profile?protocol=${protocol}&id=${encodeURIComponent(handle)}`}
          className="text-sm font-semibold text-white drop-shadow-lg hover:underline truncate block"
          onClick={(e) => e.stopPropagation()}
        >
          {displayName}
        </a>
        <span className="text-xs text-white/60 drop-shadow-lg">@{handle}</span>
      </div>

      {protocol && (
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider shrink-0"
          style={{ backgroundColor: `${protocolColor}22`, color: protocolColor }}
        >
          {protocol}
        </span>
      )}

      {onFollow && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFollow();
          }}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
            following
              ? 'border-degen-500/40 bg-degen-500/15 text-degen-400'
              : 'border-white/20 text-white hover:bg-white/10'
          }`}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}
