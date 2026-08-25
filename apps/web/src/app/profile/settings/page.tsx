'use client';

/**
 * /profile/settings — Creator Settings Hub
 *
 * One unified settings page: profile, cross-posting, monetization,
 * notifications, connected protocols, API keys.
 */

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectAccountPanel } from '../../../components/profile/ConnectAccountPanel';
import { CustomLinksEditor } from '../../../components/profile/CustomLinksEditor';
import { useToast } from '../../../components/Toast';
import { renderMarkdown } from '../../../lib/markdown';
import { sanitizeHtml } from '../../../lib/sanitize';
import { PROTOCOL_COLORS, PROTOCOL_LABELS } from '../constants';
import type { CreatorSettings } from '../types';

type SettingsTab =
  | 'profile'
  | 'crossposting'
  | 'monetization'
  | 'notifications'
  | 'protocols'
  | 'api-keys';

const SETTINGS_TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'crossposting', label: 'Cross-Posting', icon: '🔄' },
  { id: 'monetization', label: 'Monetization', icon: '💰' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'protocols', label: 'Protocols', icon: '🔗' },
  { id: 'api-keys', label: 'API Keys', icon: '🔑' },
];

const DEFAULT_SETTINGS: CreatorSettings = {
  profile: {
    displayName: '',
    bio: '',
    avatarUrl: '',
    coverUrl: '',
    website: '',
    location: '',
    customLinks: [],
  },
  crossPosting: { defaultProtocols: [], autoPost: true, defaultLicense: 'cc-by' },
  monetization: {
    evmAddress: '',
    solanaAddress: '',
    lightningAddress: '',
    preferredMethod: 'auto',
    tipEnabled: true,
    subscriptionEnabled: false,
    coinFlipEnabled: false,
  },
  notifications: {
    tips: true,
    subscriptions: true,
    follows: true,
    mentions: true,
    reposts: true,
    newsletter: false,
    emailDigest: 'daily',
    pushEnabled: true,
  },
  connectedProtocols: [],
  apiKeys: [],
};

export default function SettingsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [settings, setSettings] = useState<CreatorSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const mountedRef = useRef(true);

  // Load settings from KV/localStorage
  useEffect(() => {
    async function load() {
      try {
        const raw = localStorage.getItem('degenfeed:settings');
        if (raw) {
          const parsed = JSON.parse(raw) as CreatorSettings;
          if (mountedRef.current) setSettings(parsed);
        }
      } catch {
        /* ignore */
      }
    }
    load();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      localStorage.setItem('degenfeed:settings', JSON.stringify(settings));
      setSaved(true);
      showToast('success', '✓ Settings saved');
      setTimeout(() => setSaved(false), 2000);
    } catch {
      showToast('error', 'Failed to save settings');
    }
    setSaving(false);
  }, [settings, showToast]);

  const updateSettings = useCallback((patch: Partial<CreatorSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const updateProfile = useCallback((patch: Partial<CreatorSettings['profile']>) => {
    setSettings((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));
    setSaved(false);
  }, []);

  const updateMonetization = useCallback((patch: Partial<CreatorSettings['monetization']>) => {
    setSettings((prev) => ({ ...prev, monetization: { ...prev.monetization, ...patch } }));
    setSaved(false);
  }, []);

  const updateNotifications = useCallback((patch: Partial<CreatorSettings['notifications']>) => {
    setSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, ...patch } }));
    setSaved(false);
  }, []);

  const handleAddApiKey = useCallback(() => {
    if (!newKeyName.trim()) return;
    const key = `df_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const newKey = {
      name: newKeyName.trim(),
      key,
      createdAt: Date.now(),
      scopes: newKeyScopes,
    };
    updateSettings({ apiKeys: [...settings.apiKeys, newKey] });
    setNewKeyName('');
    showToast('success', `✓ API key created: ${key.slice(0, 12)}...`);
  }, [newKeyName, newKeyScopes, settings.apiKeys, updateSettings, showToast]);

  const handleDeleteApiKey = useCallback(
    (index: number) => {
      const updated = settings.apiKeys.filter((_, i) => i !== index);
      updateSettings({ apiKeys: updated });
      showToast('success', 'API key deleted');
    },
    [settings.apiKeys, updateSettings, showToast],
  );

  const toggleProtocol = useCallback(
    (protocol: string) => {
      const current = settings.crossPosting.defaultProtocols;
      const updated = current.includes(protocol)
        ? current.filter((p) => p !== protocol)
        : [...current, protocol];
      setSettings((prev) => ({
        ...prev,
        crossPosting: { ...prev.crossPosting, defaultProtocols: updated },
      }));
      setSaved(false);
    },
    [settings.crossPosting.defaultProtocols],
  );

  const allProtocols = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'threads'];

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-4xl px-4 py-6 animate-page-enter">
        {/* ── Header ────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500/20 to-gray-500/20 text-lg">
              ⚙️
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">Creator Settings</h1>
              <p className="text-xs text-[var(--color-muted])">Manage your creator configuration</p>
            </div>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────── */}
        <div
          className="mb-6 flex flex-wrap gap-1 border-b border-[var(--color-glass-border)]"
          role="tablist"
          aria-label="Settings tabs"
        >
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-degen-400'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-degen-500" />
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: Profile ──────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Profile Information</h2>
              <div className="space-y-4">
                <div>
                  <label
                    className="mb-1 block text-xs text-[var(--color-muted)]"
                    htmlFor="settings-displayName"
                  >
                    Display Name
                  </label>
                  <input
                    id="settings-displayName"
                    type="text"
                    value={settings.profile.displayName}
                    onChange={(e) => updateProfile({ displayName: e.target.value })}
                    className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs text-[var(--color-muted)]"
                    htmlFor="settings-bio"
                  >
                    Bio (Markdown supported: **bold**, *italic*, `code`, [links](https://...))
                  </label>
                  <textarea
                    id="settings-bio"
                    value={settings.profile.bio}
                    onChange={(e) => updateProfile({ bio: e.target.value })}
                    rows={3}
                    className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30 resize-none"
                    placeholder="Tell your story..."
                  />
                  {settings.profile.bio && (
                    <div className="mt-2 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2">
                      <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                        Preview
                      </p>
                      <p
                        className="text-xs leading-relaxed text-[var(--color-fg)] [&_a]:text-degen-400 [&_a]:underline [&_code]:rounded [&_code]:bg-[var(--color-card)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[10px]"
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized with DOMPurify
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(renderMarkdown(settings.profile.bio)),
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="mb-1 block text-xs text-[var(--color-muted)]"
                      htmlFor="settings-avatarUrl"
                    >
                      Profile Picture URL
                    </label>
                    <input
                      id="settings-avatarUrl"
                      type="url"
                      value={settings.profile.avatarUrl || ''}
                      onChange={(e) => updateProfile({ avatarUrl: e.target.value })}
                      className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30"
                      placeholder="https://.../avatar.png"
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-xs text-[var(--color-muted)]"
                      htmlFor="settings-coverUrl"
                    >
                      Cover / Banner URL
                    </label>
                    <input
                      id="settings-coverUrl"
                      type="url"
                      value={settings.profile.coverUrl || ''}
                      onChange={(e) => updateProfile({ coverUrl: e.target.value })}
                      className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30"
                      placeholder="https://.../cover.png"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="mb-1 block text-xs text-[var(--color-muted)]"
                      htmlFor="settings-website"
                    >
                      Website
                    </label>
                    <input
                      id="settings-website"
                      type="url"
                      value={settings.profile.website || ''}
                      onChange={(e) => updateProfile({ website: e.target.value })}
                      className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30"
                      placeholder="https://"
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-xs text-[var(--color-muted)]"
                      htmlFor="settings-location"
                    >
                      Location
                    </label>
                    <input
                      id="settings-location"
                      type="text"
                      value={settings.profile.location || ''}
                      onChange={(e) => updateProfile({ location: e.target.value })}
                      className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30"
                      placeholder="City, Country"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Custom links (linktree-style) */}
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Custom Links</h2>
              <CustomLinksEditor
                value={settings.profile.customLinks ?? []}
                onChange={(links) => updateProfile({ customLinks: links })}
              />
            </div>
          </div>
        )}

        {/* ── TAB: Cross-Posting ────────────────────────────── */}
        {activeTab === 'crossposting' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                Cross-Posting Defaults
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs text-[var(--color-muted)]">
                    Default protocols to post to:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allProtocols.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggleProtocol(p)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                          settings.crossPosting.defaultProtocols.includes(p)
                            ? 'text-white'
                            : 'text-[var(--color-muted)] border border-[var(--color-glass-border)]'
                        }`}
                        style={{
                          backgroundColor: settings.crossPosting.defaultProtocols.includes(p)
                            ? PROTOCOL_COLORS[p] || '#666'
                            : 'transparent',
                        }}
                      >
                        {PROTOCOL_LABELS[p] || p}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-[var(--color-fg)]">
                  <input
                    type="checkbox"
                    checked={settings.crossPosting.autoPost}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        crossPosting: { ...prev.crossPosting, autoPost: e.target.checked },
                      }))
                    }
                    className="accent-degen-500"
                  />
                  Auto-post new content to all selected protocols
                </label>
                <div>
                  <label
                    className="mb-1 block text-xs text-[var(--color-muted)]"
                    htmlFor="settings-license"
                  >
                    Default License
                  </label>
                  <select
                    id="settings-license"
                    value={settings.crossPosting.defaultLicense}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        crossPosting: { ...prev.crossPosting, defaultLicense: e.target.value },
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none"
                  >
                    <option value="cc-by">CC BY 4.0</option>
                    <option value="cc-by-sa">CC BY-SA 4.0</option>
                    <option value="cc-by-nc">CC BY-NC 4.0</option>
                    <option value="cc0">CC0 (Public Domain)</option>
                    <option value="all-rights">All Rights Reserved</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Monetization ─────────────────────────────── */}
        {activeTab === 'monetization' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                Monetization Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label
                    className="mb-1 block text-xs text-[var(--color-muted)]"
                    htmlFor="settings-evm"
                  >
                    EVM Address
                  </label>
                  <input
                    id="settings-evm"
                    type="text"
                    value={settings.monetization.evmAddress}
                    onChange={(e) => updateMonetization({ evmAddress: e.target.value })}
                    className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30 font-mono"
                    placeholder="0x..."
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs text-[var(--color-muted)]"
                    htmlFor="settings-solana"
                  >
                    Solana Address
                  </label>
                  <input
                    id="settings-solana"
                    type="text"
                    value={settings.monetization.solanaAddress}
                    onChange={(e) => updateMonetization({ solanaAddress: e.target.value })}
                    className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30 font-mono"
                    placeholder="7x..."
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs text-[var(--color-muted)]"
                    htmlFor="settings-lightning"
                  >
                    Lightning Address
                  </label>
                  <input
                    id="settings-lightning"
                    type="text"
                    value={settings.monetization.lightningAddress}
                    onChange={(e) => updateMonetization({ lightningAddress: e.target.value })}
                    className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30"
                    placeholder="you@getalby.com"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs text-[var(--color-muted)]"
                    htmlFor="settings-preferred-method"
                  >
                    Preferred Payment Method
                  </label>
                  <select
                    id="settings-preferred-method"
                    value={settings.monetization.preferredMethod}
                    onChange={(e) => updateMonetization({ preferredMethod: e.target.value })}
                    className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none"
                  >
                    <option value="auto">Auto (recommended)</option>
                    <option value="ethereum">Ethereum / EVM</option>
                    <option value="solana">Solana</option>
                    <option value="lightning_zap">Lightning Zap</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-[var(--color-fg)]">
                    <input
                      type="checkbox"
                      checked={settings.monetization.tipEnabled}
                      onChange={(e) => updateMonetization({ tipEnabled: e.target.checked })}
                      className="accent-degen-500"
                    />
                    Enable tips
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[var(--color-fg)]">
                    <input
                      type="checkbox"
                      checked={settings.monetization.subscriptionEnabled}
                      onChange={(e) =>
                        updateMonetization({ subscriptionEnabled: e.target.checked })
                      }
                      className="accent-degen-500"
                    />
                    Enable subscriptions
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Notifications ────────────────────────────── */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
                Notification Preferences
              </h2>
              <div className="space-y-3">
                {(
                  [
                    ['tips', '💸', 'Tip received'],
                    ['subscriptions', '💎', 'New subscriber'],
                    ['follows', '👥', 'New follower'],
                    ['mentions', '📢', 'Mentions and replies'],
                    ['reposts', '🔄', 'Content reposted'],
                    ['newsletter', '📬', 'Newsletter updates'],
                  ] as const
                ).map(([key, icon, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] px-4 py-3"
                  >
                    <span className="flex items-center gap-2 text-xs text-[var(--color-fg)]">
                      <span>{icon}</span>
                      <span>{label}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={
                        (settings.notifications as Record<string, boolean | string>)[key] === true
                      }
                      onChange={(e) => updateNotifications({ [key]: e.target.checked })}
                      className="accent-degen-500"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <label
                  className="mb-1 block text-xs text-[var(--color-muted)]"
                  htmlFor="settings-email-digest"
                >
                  Email Digest
                </label>
                <select
                  id="settings-email-digest"
                  value={settings.notifications.emailDigest}
                  onChange={(e) =>
                    updateNotifications({
                      emailDigest: e.target.value as 'never' | 'daily' | 'weekly',
                    })
                  }
                  className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none"
                >
                  <option value="never">Never</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <label className="mt-4 flex items-center gap-2 text-xs text-[var(--color-fg)]">
                <input
                  type="checkbox"
                  checked={settings.notifications.pushEnabled}
                  onChange={(e) => updateNotifications({ pushEnabled: e.target.checked })}
                  className="accent-degen-500"
                />
                Enable push notifications
              </label>
            </div>
          </div>
        )}

        {/* ── TAB: Protocols ────────────────────────────────── */}
        {activeTab === 'protocols' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-1 text-sm font-bold text-[var(--color-fg)]">Connect Accounts</h2>
              <p className="mb-4 text-xs text-[var(--color-muted)]">
                Bring your existing accounts into DegenFeed. Verified connections show as badges on
                your profile and feed the unified identity graph.
              </p>
              <ConnectAccountPanel onConnected={() => setSaved(false)} />
            </div>
          </div>
        )}

        {/* ── TAB: API Keys ─────────────────────────────────── */}
        {activeTab === 'api-keys' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
              <h2 className="mb-4 text-sm font-bold text-[var(--color-fg])">API Keys</h2>
              <p className="mb-4 text-xs text-[var(--color-muted)]">
                Keys for programmatic access to the DegenFeed API. Treat them like passwords.
              </p>

              {/* Existing keys */}
              {(settings.apiKeys ?? []).length > 0 && (
                <div className="mb-6 space-y-2">
                  {settings.apiKeys.map((apiKey, i) => (
                    <div
                      key={apiKey.key}
                      className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--color-fg)]">{apiKey.name}</p>
                        <p className="font-mono text-[11px] text-[var(--color-muted)]">
                          {apiKey.key.slice(0, 12)}...
                        </p>
                        <p className="text-[10px] text-[var(--color-muted)]">
                          Created {new Date(apiKey.createdAt).toLocaleDateString()}
                          {' · '}
                          {apiKey.scopes.join(', ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteApiKey(i)}
                        className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Create new key */}
              <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] p-4">
                <h3 className="mb-3 text-xs font-semibold text-[var(--color-fg)]">
                  Create New API Key
                </h3>
                <div className="space-y-3">
                  <div>
                    <label
                      className="mb-1 block text-xs text-[var(--color-muted)]"
                      htmlFor="settings-key-name"
                    >
                      Key Name
                    </label>
                    <input
                      id="settings-key-name"
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500/30"
                      placeholder="e.g., My App"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-[var(--color-muted)]">Scopes</p>
                    <div className="flex flex-wrap gap-2">
                      {['read', 'write', 'admin'].map((scope) => (
                        <button
                          key={scope}
                          type="button"
                          onClick={() => {
                            setNewKeyScopes((prev) =>
                              prev.includes(scope)
                                ? prev.filter((s) => s !== scope)
                                : [...prev, scope],
                            );
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                            newKeyScopes.includes(scope)
                              ? 'bg-degen-500/20 text-degen-400'
                              : 'border border-[var(--color-glass-border)] text-[var(--color-muted)]'
                          }`}
                        >
                          {scope}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddApiKey}
                    disabled={!newKeyName.trim()}
                    className="w-full rounded-xl bg-degen-500/20 px-4 py-2.5 text-xs font-bold text-degen-400 hover:bg-degen-500/30 transition-colors disabled:opacity-50"
                  >
                    Generate Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Save Button ────────────────────────────────────── */}
        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span className="text-xs text-degen-400">✓ Saved</span>}
        </div>
      </div>
    </ErrorBoundary>
  );
}
