'use client';

import Link from 'next/link';
import { memo } from 'react';

// === Types ===========================================================

interface SidebarItem {
  label: string;
  sublabel?: string;
  href?: string;
  badge?: string;
  icon?: string;
}

interface SidebarWidget {
  id: string;
  title: string;
  icon: string;
  items: SidebarItem[];
}

// === Farcaster =======================================================

const FARCASTER_WIDGETS: SidebarWidget[] = [
  {
    id: 'trending-channels',
    title: 'Trending Channels',
    icon: '📢',
    items: [
      { label: '/base', sublabel: '12.4k casts', badge: '🏗️', href: '/c/base' },
      { label: '/degen', sublabel: '8.7k casts', badge: '🎲', href: '/c/degen' },
      { label: '/solana', sublabel: '6.2k casts', badge: '◎', href: '/c/solana' },
      { label: '/nouns', sublabel: '4.1k casts', badge: '👓', href: '/c/nouns' },
      { label: '/memes', sublabel: '3.9k casts', badge: '😂', href: '/c/memes' },
    ],
  },
  {
    id: 'popular-frames',
    title: 'Popular Frames',
    icon: '🖼️',
    items: [
      { label: 'DegenSwap', sublabel: 'Swap tokens in a frame', badge: '↔️' },
      { label: 'Nouns Auction', sublabel: 'Live Noun auction #873', badge: '🔨' },
      { label: 'Farcaster Quiz', sublabel: 'Daily trivia', badge: '❓' },
      { label: 'Mint Now', sublabel: 'Free mint — 2h left', badge: '🎨' },
    ],
  },
];

// === Lens ============================================================

const LENS_WIDGETS: SidebarWidget[] = [
  {
    id: 'top-collectors',
    title: 'Top Collectors',
    icon: '🏆',
    items: [
      { label: 'vitalik.lens', sublabel: '847 collects', badge: '🥇' },
      { label: 'stani.lens', sublabel: '623 collects', badge: '🥈' },
      { label: 'brad.lens', sublabel: '512 collects', badge: '🥉' },
      { label: 'lenster.lens', sublabel: '489 collects', badge: '📊' },
      { label: 'aave.lens', sublabel: '367 collects', badge: '💰' },
    ],
  },
  {
    id: 'hot-profiles',
    title: 'Hot Profiles',
    icon: '🔥',
    items: [
      { label: 'defi.lens', sublabel: '+1,240 followers', icon: '📈' },
      { label: 'music.lens', sublabel: '+892 followers', icon: '🎵' },
      { label: 'gaming.lens', sublabel: '+756 followers', icon: '🎮' },
      { label: 'art.lens', sublabel: '+634 followers', icon: '🎨' },
    ],
  },
];

// === Bluesky =========================================================

const BLUESKY_WIDGETS: SidebarWidget[] = [
  {
    id: 'custom-feeds',
    title: 'Popular Custom Feeds',
    icon: '☁️',
    items: [
      { label: "What's Hot", sublabel: 'Trending across Bluesky', badge: '🔥' },
      { label: 'Dev Talk', sublabel: 'Dev & engineering posts', badge: '💻' },
      { label: 'Crypto Sky', sublabel: 'Web3 & crypto content', badge: '₿' },
      { label: 'Art & Design', sublabel: 'Creative portfolio posts', badge: '🎨' },
      { label: 'Science', sublabel: 'Research & discoveries', badge: '🔬' },
    ],
  },
  {
    id: 'starter-packs',
    title: 'Trending Starter Packs',
    icon: '📦',
    items: [
      { label: 'Web3 Devs', sublabel: '42 people', href: '#' },
      { label: 'Bitcoin Maxis', sublabel: '28 people', href: '#' },
      { label: 'NFT Artists', sublabel: '35 people', href: '#' },
    ],
  },
];

// === Nostr ===========================================================

const NOSTR_WIDGETS: SidebarWidget[] = [
  {
    id: 'active-relays',
    title: 'Active Relays',
    icon: '🔁',
    items: [
      { label: 'wss://relay.damus.io', sublabel: '12,847 notes', badge: '✅' },
      { label: 'wss://relay.nostr.band', sublabel: '9,231 notes', badge: '✅' },
      { label: 'wss://nos.lol', sublabel: '7,654 notes', badge: '✅' },
      { label: 'wss://relay.snort.social', sublabel: '5,432 notes', badge: '✅' },
      { label: 'wss://purplepag.es', sublabel: '3,210 notes', badge: '📡' },
    ],
  },
  {
    id: 'most-zapped',
    title: 'Most Zapped',
    icon: '⚡',
    items: [
      { label: 'Plebonomics', sublabel: '12,450 sats', badge: '🥇' },
      { label: 'Nostr Report', sublabel: '8,900 sats', badge: '🥈' },
      { label: 'Citadel Dispatch', sublabel: '7,300 sats', badge: '🥉' },
      { label: 'BTC Sessions', sublabel: '5,600 sats', icon: '🎙️' },
    ],
  },
];

// === Mastodon ========================================================

const MASTODON_WIDGETS: SidebarWidget[] = [
  {
    id: 'trending-hashtags',
    title: 'Trending Hashtags',
    icon: '#️⃣',
    items: [
      { label: '#FediFriday', sublabel: '1,240 posts', badge: '📅' },
      { label: '#Introduction', sublabel: '892 posts', badge: '👋' },
      { label: '#Photography', sublabel: '756 posts', badge: '📷' },
      { label: '#Music', sublabel: '634 posts', badge: '🎵' },
      { label: '#WebDev', sublabel: '521 posts', badge: '💻' },
    ],
  },
  {
    id: 'popular-instances',
    title: 'Popular Instances',
    icon: '🏛️',
    items: [
      { label: 'mastodon.social', sublabel: '284k users', badge: '🟢' },
      { label: 'mstdn.social', sublabel: '142k users', badge: '🟢' },
      { label: 'techhub.social', sublabel: '89k users', badge: '🟢' },
      { label: 'fosstodon.org', sublabel: '67k users', badge: '🟢' },
      { label: 'social.degenfeed.xyz', sublabel: '1.8k users', badge: '🟣' },
    ],
  },
];

// === Registry ========================================================

const PROTOCOL_WIDGETS: Record<string, SidebarWidget[]> = {
  farcaster: FARCASTER_WIDGETS,
  lens: LENS_WIDGETS,
  bluesky: BLUESKY_WIDGETS,
  nostr: NOSTR_WIDGETS,
  mastodon: MASTODON_WIDGETS,
};

// === Quick actions ===================================================

const PROTOCOL_QUICK_ACTIONS: Record<string, { label: string; href: string; icon: string }[]> = {
  farcaster: [
    { label: 'Explore Channels', href: '/c', icon: '📢' },
    { label: 'Farcaster Trending', href: '/farcaster/trending', icon: '📈' },
  ],
  lens: [
    { label: 'Explore Profiles', href: '/discover?protocol=lens', icon: '👤' },
    { label: 'Lens Trending', href: '/lens/trending', icon: '📈' },
  ],
  bluesky: [
    { label: 'Find Feeds', href: '/search?q=bluesky+feeds', icon: '☁️' },
    { label: 'Bluesky Trending', href: '/bluesky/trending', icon: '📈' },
  ],
  nostr: [
    { label: 'Find Relays', href: '/search?q=nostr+relays', icon: '🔁' },
    { label: 'Nostr Trending', href: '/nostr/trending', icon: '📈' },
  ],
  mastodon: [
    { label: 'Browse Instances', href: '/search?q=mastodon+instances', icon: '🏛️' },
    { label: 'Mastodon Trending', href: '/mastodon/trending', icon: '📈' },
  ],
};

// === Widget card =====================================================

function WidgetCard({ widget, color }: { widget: SidebarWidget; color: string }) {
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{ borderColor: `${color}22`, backgroundColor: 'var(--color-card)' }}
    >
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className="text-sm" aria-hidden="true">
          {widget.icon}
        </span>
        <h3
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--color-fg)' }}
        >
          {widget.title}
        </h3>
      </div>
      <div className="divide-y divide-[var(--color-glass-border)]">
        {widget.items.map((item) => {
          const badgeIcon = item.badge || item.icon;
          const content = (
            <>
              {badgeIcon && (
                <span className="shrink-0 text-xs" aria-hidden="true">
                  {badgeIcon}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium" style={{ color: 'var(--color-fg)' }}>
                  {item.label}
                </div>
                {item.sublabel && (
                  <div className="truncate text-[10px] text-[var(--color-muted)]">
                    {item.sublabel}
                  </div>
                )}
              </div>
            </>
          );

          if (item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-[var(--color-overlay)]"
              >
                {content}
              </Link>
            );
          }
          return (
            <div
              key={item.label}
              className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-[var(--color-overlay)]"
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// === Quick actions ===================================================

function QuickActions({ protocol, color }: { protocol: string; color: string }) {
  const actions = PROTOCOL_QUICK_ACTIONS[protocol] ?? [];
  if (actions.length === 0) return null;

  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: `${color}22`, backgroundColor: `${color}06` }}
    >
      <h3
        className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-muted)' }}
      >
        Quick Actions
      </h3>
      <div className="space-y-1">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-overlay)]"
            style={{ color: 'var(--color-fg)' }}
          >
            <span className="text-xs" aria-hidden="true">
              {action.icon}
            </span>
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// === Main export =====================================================

interface ProtocolSidebarProps {
  protocol: string;
  color: string;
}

export const ProtocolSidebar = memo(function ProtocolSidebar({
  protocol,
  color,
}: ProtocolSidebarProps) {
  const widgets = PROTOCOL_WIDGETS[protocol] ?? [];

  return (
    <aside className="flex flex-col gap-3" aria-label={`${protocol} sidebar`}>
      {widgets.map((widget) => (
        <WidgetCard key={widget.id} widget={widget} color={color} />
      ))}
      <QuickActions protocol={protocol} color={color} />
    </aside>
  );
});
