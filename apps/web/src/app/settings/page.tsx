'use client';

/**
 * Settings page — Full-featured preferences with sections:
 * Account, Appearance, Notifications, Privacy, Content, API
 *
 * Mobile: single column, collapsible sections, sticky save button.
 */

import type { Protocol } from '@degenfeed/types';
import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { PremiumPaymentModal } from '../../components/PremiumPaymentModal';
import { useToast } from '../../components/Toast';
import type { FontSize, NotificationType, Theme } from '../../hooks/usePreferences';
import { usePreferences } from '../../hooks/usePreferences';
import { usePremium } from '../../hooks/usePremium';

/* ─── Types ──────────────────────────────────────────────────── */

type Section = 'account' | 'appearance' | 'notifications' | 'privacy' | 'content' | 'subscription' | 'api';

const SECTION_LABELS: Record<Section, { label: string; icon: string; desc: string }> = {
  account: {
    label: 'Account',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    desc: 'Wallet addresses, email, connected protocols',
  },
  appearance: {
    label: 'Appearance',
    icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
    desc: 'Theme, font size, layout density',
  },
  notifications: {
    label: 'Notifications',
    icon: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
    desc: 'Per-protocol per-type toggles',
  },
  privacy: {
    label: 'Privacy',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    desc: 'Public/private profile, visibility settings',
  },
  content: {
    label: 'Content',
    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
    desc: 'Default feed, muted words, muted & blocked users',
  },
  subscription: {
    label: 'Subscription',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    desc: 'Plan, billing, and premium features',
  },
  api: {
    label: 'API & Developers',
    icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
    desc: 'API keys and developer settings',
  },
};

const PROTOCOLS: Protocol[] = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'threads'];
const NOTIFICATION_TYPES: NotificationType[] = ['likes', 'reposts', 'replies', 'follows', 'tips'];

/* ─── Collapsible Section ────────────────────────────────────── */

function SettingsSection({
  section,
  isOpen,
  onToggle,
  children,
}: {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const meta = SECTION_LABELS[section];
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] transition-all">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--color-overlay)]"
        aria-expanded={isOpen}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-degen-500/10 text-degen-400">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={meta.icon} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--color-fg)]">{meta.label}</div>
          <div className="text-xs text-[var(--color-muted)] truncate">{meta.desc}</div>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={`shrink-0 text-[var(--color-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div className="border-t border-[var(--color-glass-border)] px-5 py-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Toggle Switch ──────────────────────────────────────────── */

function Toggle({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-[var(--color-fg)] cursor-pointer">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        data-checked={checked}
        onClick={() => onChange(!checked)}
        className="toggle-track"
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}

/* ─── Select Row ─────────────────────────────────────────────── */

function SelectRow({
  label,
  value,
  options,
  onChange,
  id,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-[var(--color-fg)]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-fg)] focus:border-degen-500 focus:outline-none focus:ring-1 focus:ring-degen-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ─── Muted/Blocked Tag List ──────────────────────────────────── */

function TagList({
  items,
  onRemove,
  placeholder,
  onAdd,
  addLabel,
}: {
  items: string[];
  onRemove: (item: string) => void;
  placeholder: string;
  onAdd: (item: string) => void;
  addLabel: string;
}) {
  const [input, setInput] = useState('');

  const handleAdd = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onAdd(trimmed);
    setInput('');
  }, [input, items, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd],
  );

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.length === 0 && (
          <span className="text-xs text-[var(--color-muted)] py-1">None added yet</span>
        )}
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-2.5 py-1 text-xs text-[var(--color-fg)]"
          >
            {item}
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="ml-0.5 text-[var(--color-muted)] hover:text-red-400 transition-colors"
              aria-label={`Remove ${item}`}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="input flex-1 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim()}
          className="btn-secondary text-xs shrink-0"
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}

/* ─── API Key Card ───────────────────────────────────────────── */

function ApiKeyCard({
  name,
  keyPreview,
  created,
  onRevoke,
}: {
  name: string;
  keyPreview: string;
  created: string;
  onRevoke: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--color-fg)]">{name}</div>
        <code className="text-xs font-mono text-[var(--color-muted)]">{keyPreview}</code>
        <div className="text-[10px] text-[var(--color-muted)]">Created {created}</div>
      </div>
      <button
        type="button"
        onClick={onRevoke}
        className="shrink-0 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
      >
        Revoke
      </button>
    </div>
  );
}

/* ─── Main Settings Page ─────────────────────────────────────── */

export default function SettingsPage() {
  const { primaryIdentity, walletAddress, openSignIn, linkedIdentities } = useAuth();
  const { showToast } = useToast();

  const {
    prefs,
    setTheme,
    setFontSize,
    setLayoutDensity,
    toggleNotificationType,
    setPrivacy,
    setContent,
    saveToServer,
    saving,
    saveStatus,
    addMutedWord,
    removeMutedWord,
    addMutedUser,
    removeMutedUser,
    addBlockedUser,
    removeBlockedUser,
  } = usePreferences();

  const { tier: currentTier, isPremium, expiresAt, loading: premiumLoading } = usePremium();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancelSubscription = useCallback(async () => {
    setCancelling(true);
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Cancel failed');
      showToast('success', 'Subscription cancelled. Access continues until period end.');
      setShowCancelConfirm(false);
    } catch {
      showToast('error', 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  }, [showToast]);

  const [openSections, setOpenSections] = useState<Section[]>(['appearance']);
  const [_mutedWordInput, _setMutedWordInput] = useState('');
  const [_mutedUserInput, _setMutedUserInput] = useState('');
  const [_blockedUserInput, _setBlockedUserInput] = useState('');

  const toggleSection = useCallback((s: Section) => {
    setOpenSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }, []);

  const [email, setEmail] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);

  // Toast feedback on save to server
  useEffect(() => {
    if (saveStatus === 'saved') {
      showToast('success', 'Preferences saved');
    } else if (saveStatus === 'error') {
      showToast('error', 'Failed to save preferences');
    }
  }, [saveStatus, showToast]);

  const handleSaveEmail = useCallback(async () => {
    try {
      const res = await fetch('/api/preferences/email', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error('Failed to save email');
      setEmailSaved(true);
      showToast('success', 'Email saved');
      setTimeout(() => setEmailSaved(false), 3000);
    } catch {
      showToast('error', 'Failed to save email');
    }
  }, [email, showToast]);

  const handleGenerateApiKey = useCallback(async () => {
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to generate key');
      const data = (await res.json()) as { key: string };
      showToast('success', `API key generated: ${data.key.slice(0, 12)}...`);
    } catch {
      showToast('error', 'Failed to generate API key');
    }
  }, [showToast]);

  const connectedProtocols = PROTOCOLS.filter(
    (p) => linkedIdentities.some((i) => i.protocol === p) || primaryIdentity?.protocol === p,
  );

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-24 sm:pb-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Settings</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Customize your DegenFeed experience
          </p>
        </div>

        {/* Sections */}
        <section className="space-y-3" aria-label="Settings sections">
          {/* ─────────── ACCOUNT ─────────── */}
          <SettingsSection
            section="account"
            isOpen={openSections.includes('account')}
            onToggle={() => toggleSection('account')}
          >
            {/* Wallet */}
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]">
                Wallet Address
              </span>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-degen-500/20 text-degen-400">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <path d="M18 12h.01" />
                  </svg>
                </div>
                <code className="flex-1 text-sm font-mono text-[var(--color-fg)]">
                  {walletAddress
                    ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
                    : 'No wallet connected'}
                </code>
                {!walletAddress && (
                  <button
                    type="button"
                    onClick={openSignIn}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="settings-email"
                className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]"
              >
                Email
              </label>
              <div className="flex gap-2">
                <input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input flex-1 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSaveEmail}
                  disabled={!email.trim()}
                  className="btn-primary text-xs shrink-0"
                >
                  {emailSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>

            {/* Connected Protocols */}
            <div>
              <span className="mb-1.5 block text-xs font-medium text-[var(--color-fg)]">
                Connected Protocols
              </span>
              <div className="flex flex-wrap gap-2">
                {PROTOCOLS.map((p) => {
                  const linked = connectedProtocols.includes(p);
                  return (
                    <span
                      key={p}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                        linked
                          ? 'bg-degen-500/15 text-degen-400 border border-degen-500/30'
                          : 'bg-[var(--color-overlay)] text-[var(--color-muted)] border border-[var(--color-glass-border)]'
                      }`}
                    >
                      {linked && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="text-degen-400"
                        >
                          <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                        </svg>
                      )}
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={openSignIn}
                className="mt-2 rounded-lg bg-degen-500/15 px-3 py-1.5 text-xs font-medium text-degen-400 hover:bg-degen-500/25 transition-colors"
              >
                + Link another protocol
              </button>
            </div>
          </SettingsSection>

          {/* ─────────── APPEARANCE ─────────── */}
          <SettingsSection
            section="appearance"
            isOpen={openSections.includes('appearance')}
            onToggle={() => toggleSection('appearance')}
          >
            {/* Theme */}
            <SelectRow
              id="settings-theme"
              label="Theme"
              value={prefs.theme}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'auto', label: 'System' },
              ]}
              onChange={(v) => setTheme(v as Theme)}
            />

            {/* Font Size */}
            <SelectRow
              id="settings-font-size"
              label="Font Size"
              value={prefs.fontSize}
              options={[
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
              ]}
              onChange={(v) => setFontSize(v as FontSize)}
            />

            {/* Layout Density */}
            <div className="space-y-2">
              <span className="text-sm text-[var(--color-fg)]">Layout Density</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    value: 'compact' as const,
                    label: 'Compact',
                    icon: '▬',
                    desc: 'Tighter spacing',
                  },
                  {
                    value: 'comfortable' as const,
                    label: 'Comfortable',
                    icon: '▭',
                    desc: 'Balanced',
                  },
                  { value: 'visual' as const, label: 'Visual', icon: '◻', desc: 'More media' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLayoutDensity(opt.value)}
                    className={`rounded-xl border-2 p-3 text-center transition-all ${
                      prefs.layoutDensity === opt.value
                        ? 'border-degen-500 bg-degen-500/10'
                        : 'border-[var(--color-glass-border)] bg-[var(--color-overlay)] hover:border-degen-500/30'
                    }`}
                    aria-pressed={prefs.layoutDensity === opt.value}
                  >
                    <div className="text-lg mb-1">{opt.icon}</div>
                    <div className="text-xs font-medium text-[var(--color-fg)]">{opt.label}</div>
                    <div className="text-[10px] text-[var(--color-muted)]">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </SettingsSection>

          {/* ─────────── NOTIFICATIONS ─────────── */}
          <SettingsSection
            section="notifications"
            isOpen={openSections.includes('notifications')}
            onToggle={() => toggleSection('notifications')}
          >
            <p className="text-xs text-[var(--color-muted)]">
              Configure which notifications you receive per protocol. Changes save automatically.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Notification preferences">
                <thead>
                  <tr className="border-b border-[var(--color-glass-border)]">
                    <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--color-muted)]">
                      Protocol
                    </th>
                    {NOTIFICATION_TYPES.map((nt) => (
                      <th
                        key={nt}
                        className="py-2 px-2 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]"
                      >
                        {nt}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PROTOCOLS.map((protocol) => (
                    <tr
                      key={protocol}
                      className="border-b border-[var(--color-glass-border)] last:border-0"
                    >
                      <td className="py-2.5 pr-4 text-sm font-medium text-[var(--color-fg)] capitalize">
                        {protocol}
                      </td>
                      {NOTIFICATION_TYPES.map((nt) => (
                        <td key={nt} className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={prefs.notifications[protocol]?.[nt] ?? true}
                            data-checked={prefs.notifications[protocol]?.[nt] ?? true}
                            onClick={() => toggleNotificationType(protocol, nt)}
                            className="toggle-track mx-auto"
                            aria-label={`${protocol} ${nt} notifications`}
                          >
                            <span className="toggle-thumb" />
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SettingsSection>

          {/* ─────────── PRIVACY ─────────── */}
          <SettingsSection
            section="privacy"
            isOpen={openSections.includes('privacy')}
            onToggle={() => toggleSection('privacy')}
          >
            <Toggle
              id="privacy-public"
              checked={prefs.privacy.publicProfile}
              onChange={(v) => setPrivacy({ ...prefs.privacy, publicProfile: v })}
              label="Public profile"
            />
            <p className="text-xs text-[var(--color-muted)] -mt-2">
              Anyone can view your profile. Turn off to show to followers only.
            </p>
            <Toggle
              id="privacy-tips"
              checked={prefs.privacy.showTipsReceived}
              onChange={(v) => setPrivacy({ ...prefs.privacy, showTipsReceived: v })}
              label="Show tips received"
            />
            <Toggle
              id="privacy-followers"
              checked={prefs.privacy.showFollowers}
              onChange={(v) => setPrivacy({ ...prefs.privacy, showFollowers: v })}
              label="Show followers"
            />
          </SettingsSection>

          {/* ─────────── CONTENT ─────────── */}
          <SettingsSection
            section="content"
            isOpen={openSections.includes('content')}
            onToggle={() => toggleSection('content')}
          >
            {/* Default Feed */}
            <SelectRow
              id="settings-default-feed"
              label="Default feed"
              value={prefs.content.defaultFeed}
              options={[
                { value: 'following', label: 'Following' },
                { value: 'for-you', label: 'For You' },
                { value: 'trending', label: 'Trending' },
              ]}
              onChange={(v) =>
                setContent({
                  ...prefs.content,
                  defaultFeed: v as 'following' | 'for-you' | 'trending',
                })
              }
            />

            {/* Muted Words */}
            <div>
              <span className="mb-1.5 block text-sm text-[var(--color-fg)]">Muted Words</span>
              <TagList
                items={prefs.content.mutedWords}
                onRemove={removeMutedWord}
                onAdd={addMutedWord}
                placeholder="Add word or phrase..."
                addLabel="Add"
              />
            </div>

            {/* Muted Users */}
            <div>
              <span className="mb-1.5 block text-sm text-[var(--color-fg)]">Muted Users</span>
              <TagList
                items={prefs.content.mutedUsers}
                onRemove={removeMutedUser}
                onAdd={addMutedUser}
                placeholder="User ID or handle..."
                addLabel="Mute"
              />
            </div>

            {/* Blocked Users */}
            <div>
              <span className="mb-1.5 block text-sm text-[var(--color-fg)]">Blocked Users</span>
              <TagList
                items={prefs.content.blockedUsers}
                onRemove={removeBlockedUser}
                onAdd={addBlockedUser}
                placeholder="User ID or handle..."
                addLabel="Block"
              />
            </div>
          </SettingsSection>

          {/* ─────────── SUBSCRIPTION ─────────── */}
          <SettingsSection
            section="subscription"
            isOpen={openSections.includes('subscription')}
            onToggle={() => toggleSection('subscription')}
          >
            {premiumLoading ? (
              <div className="flex items-center gap-3 py-2">
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-overlay)]" />
              </div>
            ) : isPremium ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-degen-500/20 text-lg">
                    ⚡
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-degen-400 capitalize">
                        {currentTier}
                      </span>
                      <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[10px] font-medium text-degen-400">
                        Active
                      </span>
                    </div>
                    {expiresAt && (
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">
                        Renews {new Date(expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUpgradeModal(true)}
                    className="btn-primary text-xs"
                  >
                    Change plan
                  </button>
                </div>

                {/* Cancel confirmation */}
                {!showCancelConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Cancel subscription
                  </button>
                ) : (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
                    <p className="text-xs text-red-400 font-medium">
                      Are you sure? Your subscription stays active until the end of the billing
                      period.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCancelSubscription}
                        disabled={cancelling}
                        className="flex-1 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCancelConfirm(false)}
                        className="flex-1 rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                      >
                        Keep subscription
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
                  <div className="text-xs font-medium text-[var(--color-fg)] mb-1">Free Plan</div>
                  <p className="text-xs text-[var(--color-muted)] mb-2">
                    Upgrade to Pro for unlimited feeds, analytics, scheduling, and cross-platform
                    registration.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowUpgradeModal(true)}
                    className="btn-primary text-xs"
                  >
                    Upgrade to Pro — $10 first month
                  </button>
                </div>
              </div>
            )}
          </SettingsSection>

          {/* ─────────── API ─────────── */}
          <SettingsSection
            section="api"
            isOpen={openSections.includes('api')}
            onToggle={() => toggleSection('api')}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--color-fg)]">API Keys</div>
                <p className="text-xs text-[var(--color-muted)]">
                  Generate API keys for programmatic access to DegenFeed.
                </p>
              </div>
              <button type="button" onClick={handleGenerateApiKey} className="btn-primary text-xs">
                Generate Key
              </button>
            </div>

            {/* Placeholder for existing keys */}
            <ApiKeyCard
              name="Development"
              keyPreview="df_dev_...a1b2"
              created="2026-06-15"
              onRevoke={() => showToast('success', 'Key revoked')}
            />
            <ApiKeyCard
              name="Production Bot"
              keyPreview="df_prod_...c3d4"
              created="2026-07-01"
              onRevoke={() => showToast('success', 'Key revoked')}
            />

            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
              <div className="text-xs font-medium text-[var(--color-fg)] mb-1">Developer Mode</div>
              <p className="text-xs text-[var(--color-muted)] mb-2">
                Enable developer features, debug logs, and experimental endpoints.
              </p>
              <Toggle
                id="dev-mode"
                checked={false}
                onChange={() => showToast('info', 'Developer mode toggled')}
                label="Enable Developer Mode"
              />
            </div>
          </SettingsSection>
        </section>

        {/* ─── Sticky Save Footer ─── */}
        <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--color-glass-border)] bg-[var(--color-card)]/95 backdrop-blur-xl px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:backdrop-blur-none sm:px-0 sm:py-0 lg:pb-3">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div className="text-xs text-[var(--color-muted)]">
              {saveStatus === 'saved' && (
                <span className="text-degen-400">✓ Preferences saved</span>
              )}
              {saveStatus === 'error' && <span className="text-red-400">✗ Failed to save</span>}
              {saveStatus === 'idle' && <span>Changes are saved locally</span>}
            </div>
            <button
              type="button"
              onClick={saveToServer}
              disabled={saving}
              className="btn-primary text-sm"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </span>
              ) : (
                'Save to server'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Upgrade modal */}
      <PremiumPaymentModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </ErrorBoundary>
  );
}
