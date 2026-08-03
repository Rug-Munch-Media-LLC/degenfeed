'use client';

/**
 * DegenChatBrand — DegenChat logo/icon + tagline
 *
 * The DegenChat mark is a chat bubble with 7 protocol dots (Nostr, Farcaster,
 * Mastodon, Bluesky, Lens, Matrix, XMPP) orbiting — "Chat across every protocol".
 */

import { DEGENCHAT_BRAND_COLORS, DEGENCHAT_NAME, DEGENCHAT_TAGLINE } from '@degenfeed/degenchat';

export function DegenChatLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label={DEGENCHAT_NAME}
    >
      <title>{DEGENCHAT_NAME}</title>
      {/* Chat bubble */}
      <path
        d="M24 5c-10.5 0-19 7.4-19 16.5 0 5.2 2.7 9.8 6.9 12.8L10 42l8.3-3.9c1.8.5 3.7.8 5.7.8 10.5 0 19-7.4 19-16.5S34.5 5 24 5z"
        fill="rgba(0,255,65,0.08)"
        stroke="#00FF41"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Protocol dots */}
      {DEGENCHAT_BRAND_COLORS.map((color, i) => {
        const angle = (Math.PI * 2 * i) / DEGENCHAT_BRAND_COLORS.length - Math.PI / 2;
        const cx = 24 + Math.cos(angle) * 12;
        const cy = 24 + Math.sin(angle) * 12;
        return <circle key={color} cx={cx} cy={cy} r={3.2} fill={color} />;
      })}
      {/* Center spark */}
      <circle cx="24" cy="24" r="4.5" fill="#00FF41" opacity="0.9" />
    </svg>
  );
}

export function DegenChatWordmark({
  size = 'md',
  showTagline = true,
}: {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}) {
  const nameSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-lg';
  const taglineSize = size === 'lg' ? 'text-xs' : size === 'sm' ? 'text-[9px]' : 'text-[10px]';
  const logoSize = size === 'lg' ? 48 : size === 'sm' ? 24 : 32;

  return (
    <div className="flex items-center gap-2.5">
      <DegenChatLogo size={logoSize} />
      <div className="min-w-0">
        <p
          className={`${nameSize} font-bold tracking-tight leading-none`}
          style={{ color: 'var(--color-fg)' }}
        >
          {DEGENCHAT_NAME}
        </p>
        {showTagline && (
          <p className={`${taglineSize} mt-0.5 leading-tight text-[var(--color-muted)]`}>
            {DEGENCHAT_TAGLINE}
          </p>
        )}
      </div>
    </div>
  );
}
