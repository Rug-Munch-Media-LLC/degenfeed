'use client';

import Image from 'next/image';
import type { FeddyCommunity, MemberRole } from './types';
import { CATEGORY_EMOJIS, CATEGORY_LABELS, type FeddyCategory } from './types';

export function CommunityBanner({
  community,
  viewerRole,
}: {
  community: FeddyCommunity;
  viewerRole: MemberRole | null;
}) {
  const catEmoji = CATEGORY_EMOJIS[community.category as FeddyCategory] || '🌐';
  const catLabel = CATEGORY_LABELS[community.category as FeddyCategory] || community.category;

  const hasBanner = community.bannerUrl && community.bannerUrl.length > 0;

  return (
    <div className="relative">
      {/* Banner image */}
      <div
        className={`h-48 w-full sm:h-64 ${hasBanner ? '' : 'bg-gradient-to-r from-degen-500/10 via-purple-500/10 to-degen-500/5'}`}
      >
        {hasBanner && (
          <Image
            src={community.bannerUrl}
            alt={`${community.displayName} banner`}
            fill
            className="object-cover"
            priority
          />
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-transparent to-transparent" />

      {/* Community info overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="mx-auto flex max-w-6xl items-end gap-4">
          {/* Avatar */}
          <div className="relative -mb-12 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-[var(--bg)] bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-2xl font-bold text-degen-400 shadow-xl sm:h-24 sm:w-24">
            {community.avatarUrl ? (
              <Image
                src={community.avatarUrl}
                alt={community.displayName}
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : (
              community.displayName.charAt(0).toUpperCase()
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-bold text-[var(--color-fg)] sm:text-2xl">
                {community.displayName}
              </h1>
              {viewerRole === 'owner' && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-medium text-amber-400">
                  Owner
                </span>
              )}
              {viewerRole === 'moderator' && (
                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[9px] font-medium text-blue-400">
                  Mod
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[9px] font-medium text-purple-400">
                <span>{catEmoji}</span>
                <span>{catLabel}</span>
              </span>
              <span>{community.memberCount} members</span>
              <span>·</span>
              <span className="font-mono text-degen-400">{community.gtsHandle}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
