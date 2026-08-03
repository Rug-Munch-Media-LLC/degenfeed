'use client';

import Link from 'next/link';
import { useState } from 'react';

/* ─── Types ───────────────────────────────────────────────────── */

interface SettingSection {
  id: string;
  label: string;
  icon: string;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  scopes: string[];
}

interface SocialLink {
  protocol: string;
  label: string;
  handle: string;
  connected: boolean;
  color: string;
}

/* ─── Sections ─────────────────────────────────────────────────── */

const SETTINGS_SECTIONS: SettingSection[] = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'monetization', label: 'Monetization', icon: '💰' },
  { id: 'crosspost', label: 'Cross-Posting', icon: '📤' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'branding', label: 'Branding', icon: '🎨' },
  { id: 'api', label: 'API Keys', icon: '🔑' },
];

const SOCIAL_LINKS: SocialLink[] = [
  {
    protocol: 'farcaster',
    label: 'Farcaster',
    handle: '@degencreator',
    connected: true,
    color: 'var(--color-protocol-farcaster)',
  },
  {
    protocol: 'bluesky',
    label: 'Bluesky',
    handle: '@degencreator.bsky.social',
    connected: true,
    color: 'var(--color-protocol-bluesky)',
  },
  {
    protocol: 'nostr',
    label: 'Nostr',
    handle: 'npub1...7xz9',
    connected: true,
    color: 'var(--color-protocol-nostr)',
  },
  {
    protocol: 'lens',
    label: 'Lens',
    handle: '@degencreator.lens',
    connected: true,
    color: 'var(--color-protocol-lens)',
  },
  {
    protocol: 'mastodon',
    label: 'Mastodon',
    handle: '@degencreator@mastodon.social',
    connected: false,
    color: 'var(--color-protocol-mastodon)',
  },
  {
    protocol: 'threads',
    label: 'Threads',
    handle: '@degencreator',
    connected: false,
    color: 'var(--color-protocol-threads)',
  },
  {
    protocol: 'youtube',
    label: 'YouTube',
    handle: 'DegenCreator',
    connected: false,
    color: 'var(--color-protocol-youtube)',
  },
  {
    protocol: 'reddit',
    label: 'Reddit',
    handle: 'u/degencreator',
    connected: false,
    color: 'var(--color-protocol-reddit)',
  },
];

const SUBSCRIPTION_TIERS = [
  { name: 'Free', price: '$0', benefits: ['Basic posts', 'Public content', 'Follow'] },
  {
    name: 'Supporter',
    price: '$5/mo',
    benefits: ['Exclusive content', 'Early access', 'Badge', 'No ads'],
    popular: true,
  },
  {
    name: 'Premium',
    price: '$15/mo',
    benefits: ['All Supporter perks', 'Direct messages', 'Token-gated alpha', '1-on-1 chat'],
  },
  {
    name: 'Whale',
    price: '$50/mo',
    benefits: ['All Premium perks', 'Custom alerts', 'Coin allocation', 'Governance vote'],
  },
];

const EXISTING_API_KEYS: ApiKey[] = [
  {
    id: '1',
    name: 'Production Bot',
    key: 'df_sk_prod_8xH3...mN9q',
    created: '2025-06-15',
    lastUsed: '2m ago',
    scopes: ['read:analytics', 'write:posts'],
  },
  {
    id: '2',
    name: 'Analytics Dashboard',
    key: 'df_sk_analytics_2kL7...pR4w',
    created: '2025-05-20',
    lastUsed: '1h ago',
    scopes: ['read:analytics'],
  },
];

/* ─── Profile Section ─────────────────────────────────────────── */

function ProfileSection() {
  return (
    <div className="space-y-6">
      {/* Avatar + basic info */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-degen-500/30 bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-3xl">
          🎭
        </div>
        <div className="flex-1">
          <div className="text-lg font-bold text-[var(--color-fg)]">Degen Creator</div>
          <div className="text-xs text-[var(--color-muted)]">@degencreator · Joined Mar 2025</div>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="btn-primary text-xs px-4 py-1.5">
              Change Avatar
            </button>
            <button type="button" className="btn-secondary text-xs px-4 py-1.5">
              Remove
            </button>
          </div>
        </div>
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]">
            Display Name
          </span>
          <input type="text" defaultValue="Degen Creator" className="input text-sm" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]">
            Username
          </span>
          <input type="text" defaultValue="degencreator" className="input text-sm" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]">Bio</span>
          <textarea
            rows={3}
            defaultValue="Web3 creator building on Farcaster, Nostr, Bluesky & Lens. Creator of $TICKER, $CRE8. Making degen content since 2025."
            className="input text-sm resize-none"
          />
          <span className="mt-1 block text-right text-[9px] text-[var(--color-muted)]">
            142/280
          </span>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--color-fg)]">Website</span>
          <input
            type="url"
            defaultValue="https://degenfeed.xyz/@degencreator"
            className="input text-sm"
          />
        </label>
      </div>

      {/* Social links */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-[var(--color-fg)]">Connected Social Accounts</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SOCIAL_LINKS.map((link) => (
            <div
              key={link.protocol}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${link.connected ? 'border-degen-500/20' : 'border-[var(--color-glass-border)] opacity-60'}`}
              style={
                link.connected
                  ? { borderColor: `${link.color}40`, backgroundColor: `${link.color}08` }
                  : {}
              }
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold"
                style={{ backgroundColor: `${link.color}18`, color: link.color }}
              >
                {link.label[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[var(--color-fg)]">{link.label}</div>
                <div className="truncate text-[10px] text-[var(--color-muted)]">{link.handle}</div>
              </div>
              <button
                type="button"
                className={`rounded-full px-2.5 py-1 text-[9px] font-semibold transition-colors ${link.connected ? 'bg-degen-500/15 text-degen-400' : 'border border-[var(--color-glass-border)] text-[var(--color-muted)]'}`}
              >
                {link.connected ? 'Connected' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn-primary text-sm">
          Save Profile
        </button>
      </div>
    </div>
  );
}

/* ─── Monetization Section ────────────────────────────────────── */

function MonetizationSection() {
  const [tipEnabled, setTipEnabled] = useState(true);
  const [gateDefault, setGateDefault] = useState(false);

  return (
    <div className="space-y-6">
      {/* Tip Settings */}
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-fg)]">Tipping</h3>
            <p className="text-[10px] text-[var(--color-muted)]">
              Receive tips in BTC, ETH, SOL, and fiat
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={tipEnabled}
            aria-label="Toggle tipping"
            onClick={() => setTipEnabled(!tipEnabled)}
            className={`relative h-6 w-11 rounded-full transition-colors ${tipEnabled ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${tipEnabled ? 'translate-x-5' : ''}`}
            />
          </button>
        </div>
        {tipEnabled && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                BTC Lightning Address
              </span>
              <input
                type="text"
                defaultValue="degencreator@getalby.com"
                className="input text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                ETH Address
              </span>
              <input type="text" defaultValue="0x1234...5678" className="input text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                SOL Address
              </span>
              <input type="text" defaultValue="5Yw4...H3mN" className="input text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                Min Tip Amount (USD)
              </span>
              <input type="number" defaultValue="1" className="input text-sm" />
            </label>
          </div>
        )}
      </div>

      {/* Subscription Tiers */}
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-5">
        <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)]">Subscription Tiers</h3>
        <p className="mb-4 text-[10px] text-[var(--color-muted)]">
          Define what each subscription level gets
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SUBSCRIPTION_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-4 ${tier.popular ? 'border-degen-500/30 bg-degen-500/5' : 'border-[var(--color-glass-border)] bg-[var(--color-card)]'}`}
            >
              {tier.popular && (
                <span className="absolute -top-2 right-3 rounded-full bg-degen-500 px-2 py-0.5 text-[8px] font-bold text-black">
                  POPULAR
                </span>
              )}
              <div className="text-sm font-bold text-[var(--color-fg)]">{tier.name}</div>
              <div className="mt-1 text-lg font-black tabular-nums text-degen-400">
                {tier.price}
              </div>
              <ul className="mt-3 space-y-1.5">
                {tier.benefits.map((b) => (
                  <li
                    key={b}
                    className="flex items-center gap-1.5 text-[9px] text-[var(--color-muted)]"
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`mt-4 w-full rounded-xl py-2 text-[10px] font-bold transition-all ${tier.popular ? 'bg-degen-500 text-black' : 'border border-[var(--color-glass-border)] text-[var(--color-fg)]'}`}
              >
                {tier.popular ? 'Active' : 'Configure'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Token Gating Defaults */}
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-fg)]">Token-Gating Defaults</h3>
            <p className="text-[10px] text-[var(--color-muted)]">
              Require token holdings to access content
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={gateDefault}
            aria-label="Toggle token gating"
            onClick={() => setGateDefault(!gateDefault)}
            className={`relative h-6 w-11 rounded-full transition-colors ${gateDefault ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${gateDefault ? 'translate-x-5' : ''}`}
            />
          </button>
        </div>
        {gateDefault && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                Required $TICKER
              </span>
              <input type="number" defaultValue="1000" className="input text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                Required $CRE8
              </span>
              <input type="number" defaultValue="500" className="input text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                Min Holding Time
              </span>
              <select className="input text-sm">
                <option>1 day</option>
                <option>7 days</option>
                <option>30 days</option>
              </select>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Cross-Posting Section ────────────────────────────────────── */

function CrossPostSection() {
  const defaultProtocols = ['farcaster', 'bluesky', 'nostr', 'lens'];
  const [autoPost, setAutoPost] = useState(true);
  const [selectedProtocols, setSelectedProtocols] = useState(defaultProtocols);

  const toggleProtocol = (id: string) => {
    setSelectedProtocols((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-5">
        <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)]">Default Posting Protocols</h3>
        <p className="mb-4 text-[10px] text-[var(--color-muted)]">
          Select which protocols to post to by default
        </p>
        <div className="flex flex-wrap gap-2">
          {SOCIAL_LINKS.filter((l) =>
            ['farcaster', 'bluesky', 'nostr', 'lens', 'mastodon'].includes(l.protocol),
          ).map((link) => {
            const isSelected = selectedProtocols.includes(link.protocol);
            return (
              <button
                key={link.protocol}
                type="button"
                onClick={() => toggleProtocol(link.protocol)}
                className={`flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-medium transition-all ${isSelected ? 'text-black' : 'border border-[var(--color-glass-border)] text-[var(--color-muted)]'}`}
                style={isSelected ? { backgroundColor: link.color, borderColor: link.color } : {}}
              >
                {isSelected && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {link.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-fg)]">Auto-Post Rules</h3>
            <p className="text-[10px] text-[var(--color-muted)]">
              Automatically publish to all selected protocols
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoPost}
            aria-label="Toggle auto-post"
            onClick={() => setAutoPost(!autoPost)}
            className={`relative h-6 w-11 rounded-full transition-colors ${autoPost ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${autoPost ? 'translate-x-5' : ''}`}
            />
          </button>
        </div>
        {autoPost && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                Schedule
              </span>
              <select className="input text-sm">
                <option>Post immediately</option>
                <option>Best time (AI suggested)</option>
                <option>Every 4 hours</option>
                <option>Custom schedule</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]">
                Content Filter
              </span>
              <select className="input text-sm">
                <option>All posts</option>
                <option>Original posts only</option>
                <option>Token-gated only</option>
              </select>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Notifications Section ────────────────────────────────────── */

function NotificationsSection() {
  const [notifSettings, setNotifSettings] = useState({
    newFollower: true,
    tip: true,
    coinTrade: true,
    reply: true,
    repost: true,
    subscriber: true,
    email: false,
    webhook: true,
    push: true,
  });

  const toggle = (key: keyof typeof notifSettings) => {
    setNotifSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const rows = [
    { key: 'newFollower' as const, label: 'New followers' },
    { key: 'tip' as const, label: 'New tips' },
    { key: 'coinTrade' as const, label: 'Large coin trades' },
    { key: 'reply' as const, label: 'Replies & mentions' },
    { key: 'repost' as const, label: 'Reposts & shares' },
    { key: 'subscriber' as const, label: 'New subscribers' },
  ];

  const channels = [
    { key: 'email' as const, label: 'Email' },
    { key: 'webhook' as const, label: 'Webhook' },
    { key: 'push' as const, label: 'Push notification' },
  ];

  return (
    <div className="space-y-6">
      {/* Events */}
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-5">
        <h3 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Notify me when...</h3>
        <div className="space-y-2">
          {rows.map((row) => (
            <label
              key={row.key}
              className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] px-4 py-3"
            >
              <span className="text-xs text-[var(--color-fg)]">{row.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={notifSettings[row.key]}
                onClick={() => toggle(row.key)}
                className={`relative h-5 w-9 rounded-full transition-colors ${notifSettings[row.key] ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${notifSettings[row.key] ? 'translate-x-4' : ''}`}
                />
              </button>
            </label>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-5">
        <h3 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Delivery Channels</h3>
        <div className="space-y-2">
          {channels.map((ch) => (
            <label
              key={ch.key}
              className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] px-4 py-3"
            >
              <div>
                <span className="text-xs text-[var(--color-fg)]">{ch.label}</span>
                {ch.key === 'webhook' && (
                  <input
                    type="url"
                    placeholder="https://hooks.example.com/notify"
                    className="mt-1.5 block w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-1.5 text-[10px] text-[var(--color-fg)] outline-none focus:border-degen-500"
                  />
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifSettings[ch.key]}
                onClick={() => toggle(ch.key)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${notifSettings[ch.key] ? 'bg-degen-500' : 'bg-[var(--color-glass-border)]'}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${notifSettings[ch.key] ? 'translate-x-4' : ''}`}
                />
              </button>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Branding Section ─────────────────────────────────────────── */

function BrandingSection() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-5">
        <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)]">Personal Brand</h3>
        <p className="mb-4 text-[10px] text-[var(--color-muted)]">
          Customize your creator page appearance
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)]">
              Brand Color
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                defaultValue="#8b5cf6"
                className="h-10 w-10 cursor-pointer rounded-xl border border-[var(--color-glass-border)] bg-transparent"
              />
              <input type="text" defaultValue="#8b5cf6" className="input text-sm flex-1" />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)]">
              Accent Color
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                defaultValue="#8b5cf6"
                className="h-10 w-10 cursor-pointer rounded-xl border border-[var(--color-glass-border)] bg-transparent"
              />
              <input type="text" defaultValue="#8b5cf6" className="input text-sm flex-1" />
            </div>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-fg)]">Custom Domain</h3>
            <p className="text-[10px] text-[var(--color-muted)]">
              Use your own domain for your creator page
            </p>
          </div>
          <span className="rounded-full bg-gradient-to-r from-yellow-500/20 to-amber-500/20 px-3 py-1 text-[9px] font-bold text-yellow-400">
            PREMIUM
          </span>
        </div>
        <div className="mt-4">
          <input type="text" placeholder="creator.yourdomain.com" className="input text-sm" />
          <p className="mt-1 text-[9px] text-[var(--color-muted)]">
            Requires Creator Pro plan ($29/mo)
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── API Keys Section ─────────────────────────────────────────── */

function ApiKeysSection() {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState(false);

  const toggleVisibility = (id: string) => {
    setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-fg)]">API Keys</h3>
            <p className="text-[10px] text-[var(--color-muted)]">
              Generate keys for external integrations
            </p>
          </div>
          <button
            type="button"
            disabled={generating}
            onClick={() => setGenerating(true)}
            className="btn-primary text-xs"
          >
            {generating ? 'Generating...' : '+ Generate Key'}
          </button>
        </div>

        {EXISTING_API_KEYS.length > 0 && (
          <div className="space-y-2">
            {EXISTING_API_KEYS.map((apiKey) => (
              <div
                key={apiKey.id}
                className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-fg)]">
                      {apiKey.name}
                    </div>
                    <div className="text-[9px] text-[var(--color-muted)]">
                      Created {apiKey.created} · Last used {apiKey.lastUsed}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--color-glass-border)] px-2 py-1 text-[9px] text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Revoke
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-[var(--color-glass-border)] px-3 py-2 font-mono text-[11px] text-[var(--color-fg)]">
                  <span className="flex-1 truncate">
                    {showKey[apiKey.id] ? apiKey.key : `${apiKey.key.slice(0, 12)}••••••••••`}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleVisibility(apiKey.id)}
                    className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                    aria-label={showKey[apiKey.id] ? 'Hide key' : 'Show key'}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      {showKey[apiKey.id] ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                    aria-label="Copy key"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </button>
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  {apiKey.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="rounded-full bg-degen-500/10 px-2 py-0.5 text-[8px] font-medium text-degen-400"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
          <p className="text-[9px] text-yellow-400">
            🛡️ API keys inherit your creator permissions. Keep them secret. Regenerate if
            compromised.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────── */

export default function CreatorSettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileSection />;
      case 'monetization':
        return <MonetizationSection />;
      case 'crosspost':
        return <CrossPostSection />;
      case 'notifications':
        return <NotificationsSection />;
      case 'branding':
        return <BrandingSection />;
      case 'api':
        return <ApiKeysSection />;
      default:
        return <ProfileSection />;
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* ── Breadcrumb ──────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href="/creator" className="hover:text-degen-400 transition-colors">
          Creator Studio
        </Link>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-degen-400">Settings</span>
      </div>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1
          className="text-[28px] font-black tracking-tight text-[var(--color-fg)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Creator Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Configure your profile, monetization, branding, and integrations
        </p>
      </div>

      {/* ── Two-column layout ─────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar nav */}
        <nav className="lg:w-48 shrink-0" aria-label="Settings sections">
          <div className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-1 scrollbar-none">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-medium transition-all lg:w-full ${
                  activeSection === section.id
                    ? 'bg-degen-500/15 text-degen-400 shadow-sm'
                    : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
                }`}
              >
                <span aria-hidden="true">{section.icon}</span>
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">{renderSection()}</div>
      </div>
    </div>
  );
}
