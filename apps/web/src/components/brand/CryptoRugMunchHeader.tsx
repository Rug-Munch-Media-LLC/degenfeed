'use client';

import Image from 'next/image';

/**
 * @CryptoRugMunch feed header — brands feed.rugmunch.io as a sub-page of the
 * Rug Munch Intelligence platform (matching the @CryptoRugMunch X profile).
 *
 * Self-hosted avatar/banner (public/avatar.jpg, public/banner.jpg) — no
 * pbs.twimg.com hotlinks.
 */

const PROFILE = {
  displayName: 'Crypto Rug Muncher',
  handle: '@CryptoRugMunch',
  bio: 'Independent research & analysis on the crypto industry. 🕵️ Our next-gen crypto security suite is powered by $CRM — $cryptorugmunch 🔍',
  followers: 65_287,
} as const;

export function CryptoRugMunchHeader() {
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-bg)]">
      {/* Banner */}
      <div className="relative h-28 w-full sm:h-36">
        <Image
          src="/banner.jpg"
          alt="Crypto Rug Muncher banner"
          fill
          priority
          sizes="(max-width: 640px) 100vw, 672px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)]/80 via-transparent to-transparent" />
      </div>

      <div className="px-4 pb-4">
        {/* Avatar */}
        <div className="-mt-10 flex items-end justify-between">
          <div className="relative">
            <Image
              src="/avatar.jpg"
              alt="Crypto Rug Muncher"
              width={80}
              height={80}
              priority
              className="h-20 w-20 rounded-full border-4 object-cover"
              style={{ borderColor: 'var(--color-bg)' }}
            />
          </div>
          <span
            className="rounded-full border border-[var(--color-glass-border)] px-3 py-1 text-xs font-semibold"
            style={{ color: 'var(--color-fg)' }}
          >
            {PROFILE.followers.toLocaleString('en-US')} followers
          </span>
        </div>

        {/* Name / handle / bio */}
        <div className="mt-3">
          <h1 className="text-lg font-bold leading-tight" style={{ color: 'var(--color-fg)' }}>
            {PROFILE.displayName}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            {PROFILE.handle}
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--color-fg)' }}>
            {PROFILE.bio}
          </p>
        </div>
      </div>
    </div>
  );
}
