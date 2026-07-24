'use client';
import { CrossPlatformSetup, ErrorBoundary, type PlatformAccount } from '@degenfeed/ui';
import { useCallback, useEffect, useState } from 'react';
import { useHardwareWallet2FA } from '../../hooks/useHardwareWallet2FA';
import type { FontSize, Theme } from '../../hooks/usePreferences';
import { usePreferences } from '../../hooks/usePreferences';
import { usePremium } from '../../hooks/usePremium';
import { useAuth } from '../AuthProvider';
import { HardwareWalletVerify } from '../auth/HardwareWalletVerify';
import { PremiumPaymentModal } from '../PremiumPaymentModal';
import { useToast } from '../Toast';
import { AccountsCredentialsDisplay } from './AccountsCredentialsDisplay';
import { ApiKeyCard } from './ApiKeyCard';
import { SelectRow } from './SelectRow';
import { SettingsSection } from './SettingsSection';
import { TagList } from './TagList';
import { Toggle } from './Toggle';
import type { Section } from './types';
import { NOTIFICATION_TYPES, PROTOCOLS } from './types';

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
  const {
    tier: currentTier,
    isPremium,
    expiresAt,
    loading: premiumLoading,
    refresh: refreshPremium,
  } = usePremium();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [crossPlatformKey, setCrossPlatformKey] = useState(0);

  const handleCrossPlatformRegistered = useCallback(
    (result: PlatformAccount) => {
      const label = result.platform.charAt(0).toUpperCase() + result.platform.slice(1);
      showToast('success', `✓ Created @${result.username} on ${label}`);
      setCrossPlatformKey((k) => k + 1);
    },
    [showToast],
  );

  const handleCancelSubscription = useCallback(async () => {
    setCancelling(true);
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Cancel failed');
      showToast('success', 'Subscription cancelled.');
      setShowCancelConfirm(false);
      await refreshPremium();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  }, [showToast, refreshPremium]);

  const [openSections, setOpenSections] = useState<Section[]>(['appearance']);
  const toggleSection = useCallback((s: Section) => {
    setOpenSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }, []);

  const [email, setEmail] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);

  const { status: hw2FA, fetchStatus: fetchHw2FA, toggle2FA } = useHardwareWallet2FA();
  const [hw2faLoading, setHw2faLoading] = useState(true);
  useEffect(() => {
    fetchHw2FA().finally(() => setHw2faLoading(false));
  }, [fetchHw2FA]);

  const handleHw2FAToggle = useCallback(async () => {
    const newState = !hw2FA?.enabled;
    const ok = await toggle2FA(newState);
    showToast('success', ok ? (newState ? '2FA enabled' : '2FA disabled') : 'Failed to toggle 2FA');
  }, [hw2FA, toggle2FA, showToast]);

  useEffect(() => {
    if (saveStatus === 'saved') showToast('success', 'Preferences saved');
    else if (saveStatus === 'error') showToast('error', 'Failed to save preferences');
  }, [saveStatus, showToast]);

  const handleSaveEmail = useCallback(async () => {
    try {
      const res = await fetch('/api/preferences/email', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      setEmailSaved(true);
      showToast('success', 'Email saved');
      setTimeout(() => setEmailSaved(false), 3000);
    } catch {
      showToast('error', 'Failed to save email');
    }
  }, [email, showToast]);

  const handleGenerateApiKey = useCallback(async () => {
    try {
      const res = await fetch('/api/keys', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Settings</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Customize your DegenFeed experience
          </p>
        </div>

        <section className="space-y-3" aria-label="Settings sections">
          {/* ACCOUNT */}
          <SettingsSection
            section="account"
            isOpen={openSections.includes('account')}
            onToggle={() => toggleSection('account')}
          >
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

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[var(--color-fg)]">
                    Hardware Wallet 2FA
                  </div>
                  <p className="text-xs text-[var(--color-muted)] mt-0.5">
                    Your private key never leaves your hardware device.
                  </p>
                </div>
                {!hw2faLoading && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hw2FA?.enabled ?? false}
                    data-checked={hw2FA?.enabled ?? false}
                    onClick={handleHw2FAToggle}
                    className="toggle-track shrink-0"
                  >
                    <span className="toggle-thumb" />
                  </button>
                )}
              </div>
              {hw2FA?.enabled && (
                <div className="flex items-start gap-2.5 rounded-lg border border-degen-500/20 bg-degen-500/5 px-3 py-2.5">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="mt-0.5 shrink-0 text-degen-400"
                    aria-hidden="true"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <div>
                    <p className="text-xs font-medium text-degen-400">Active</p>
                  </div>
                </div>
              )}
              {hw2FA?.enabled && hw2FA.lastVerifiedAt && (
                <p className="text-[10px] text-[var(--color-muted)]">
                  Last verified: {new Date(hw2FA.lastVerifiedAt).toLocaleString()}
                </p>
              )}
              {!hw2FA?.enabled && walletAddress && (
                <HardwareWalletVerify
                  mode="inline"
                  walletType={walletAddress?.startsWith('0x') ? 'ethereum' : 'solana'}
                  onVerified={() => {
                    showToast('success', 'Hardware wallet verified');
                    toggle2FA(true);
                    fetchHw2FA();
                  }}
                />
              )}
              {!walletAddress && (
                <p className="text-xs text-amber-400">
                  Connect a wallet to enable hardware wallet 2FA.
                </p>
              )}
              {hw2faLoading && (
                <div className="h-5 w-24 animate-pulse rounded bg-[var(--color-overlay)]" />
              )}
            </div>

            <hr className="border-[var(--color-glass-border)]" />

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
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${linked ? 'bg-degen-500/15 text-degen-400 border border-degen-500/30' : 'bg-[var(--color-overlay)] text-[var(--color-muted)] border border-[var(--color-glass-border)]'}`}
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

          {/* APPEARANCE */}
          <SettingsSection
            section="appearance"
            isOpen={openSections.includes('appearance')}
            onToggle={() => toggleSection('appearance')}
          >
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
            <div className="space-y-2">
              <span className="text-sm text-[var(--color-fg)]">Layout Density</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'compact', label: 'Compact', icon: '▬', desc: 'Tighter spacing' },
                  { value: 'comfortable', label: 'Comfortable', icon: '▭', desc: 'Balanced' },
                  { value: 'visual', label: 'Visual', icon: '◻', desc: 'More media' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setLayoutDensity(opt.value as 'compact' | 'comfortable' | 'visual')
                    }
                    className={`rounded-xl border-2 p-3 text-center transition-all ${prefs.layoutDensity === opt.value ? 'border-degen-500 bg-degen-500/10' : 'border-[var(--color-glass-border)] bg-[var(--color-overlay)] hover:border-degen-500/30'}`}
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

          {/* NOTIFICATIONS */}
          <SettingsSection
            section="notifications"
            isOpen={openSections.includes('notifications')}
            onToggle={() => toggleSection('notifications')}
          >
            <p className="text-xs text-[var(--color-muted)]">
              Configure which notifications you receive per protocol.
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

          {/* PRIVACY */}
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

          {/* SECURITY */}
          <SettingsSection
            section="security"
            isOpen={openSections.includes('security')}
            onToggle={() => toggleSection('security')}
          >
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              Manage security settings: passkeys, TOTP, hardware wallet, recovery codes.
            </p>
            <a
              href="/settings/security"
              className="flex items-center justify-between rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3 transition-colors hover:bg-[var(--color-card-hover)] group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-degen-500/10 text-degen-400">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-medium text-[var(--color-fg)]">
                    Open full security page
                  </span>
                  <p className="text-xs text-[var(--color-muted)]">
                    2FA, passkeys, sessions, and more
                  </p>
                </div>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </a>
          </SettingsSection>

          {/* CONTENT */}
          <SettingsSection
            section="content"
            isOpen={openSections.includes('content')}
            onToggle={() => toggleSection('content')}
          >
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

          {/* SUBSCRIPTION */}
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
                    <p className="text-xs text-red-400 font-medium">Are you sure?</p>
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
                <div className="border-t border-[var(--color-glass-border)] pt-4">
                  <h4 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
                    Cross-Platform Accounts
                  </h4>
                  <CrossPlatformSetup
                    key={crossPlatformKey}
                    walletAddress={walletAddress ?? ''}
                    isPremium={isPremium}
                    onRegistered={(result) => {
                      handleCrossPlatformRegistered(result);
                      setCrossPlatformKey((k) => k + 1);
                    }}
                    onUpgrade={() => setShowUpgradeModal(true)}
                  />
                  <div className="mt-6 border-t border-[var(--color-glass-border)] pt-4">
                    <h4 className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
                      Your Portable Credentials
                    </h4>
                    <AccountsCredentialsDisplay walletAddress={walletAddress} />
                  </div>
                </div>
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
                <div className="border-t border-[var(--color-glass-border)] pt-4">
                  <h4 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
                    Cross-Platform Accounts
                  </h4>
                  <CrossPlatformSetup
                    key={crossPlatformKey}
                    walletAddress={walletAddress ?? ''}
                    isPremium={isPremium}
                    onRegistered={(result) => {
                      handleCrossPlatformRegistered(result);
                      setCrossPlatformKey((k) => k + 1);
                    }}
                    onUpgrade={() => setShowUpgradeModal(true)}
                  />
                </div>
              </div>
            )}
          </SettingsSection>

          {/* API */}
          <SettingsSection
            section="api"
            isOpen={openSections.includes('api')}
            onToggle={() => toggleSection('api')}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--color-fg)]">API Keys</div>
                <p className="text-xs text-[var(--color-muted)]">
                  Generate API keys for programmatic access.
                </p>
              </div>
              <button type="button" onClick={handleGenerateApiKey} className="btn-primary text-xs">
                Generate Key
              </button>
            </div>
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
              <Toggle
                id="dev-mode"
                checked={false}
                onChange={() => showToast('info', 'Developer mode toggled')}
                label="Enable Developer Mode"
              />
            </div>
          </SettingsSection>
        </section>

        {/* Sticky Save Footer */}
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

        <PremiumPaymentModal
          open={showUpgradeModal}
          onClose={() => {
            setShowUpgradeModal(false);
            refreshPremium();
          }}
          onSuccess={refreshPremium}
        />
      </div>
    </ErrorBoundary>
  );
}
