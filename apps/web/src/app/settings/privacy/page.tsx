'use client';

/**
 * Privacy Dashboard — User Control & Data Sovereignty
 *
 * Complete visibility and control over:
 *   - Data inventory (what data we store)
 *   - Privacy controls (who can see what)
 *   - Third-party connections (linked protocols)
 *   - Data requests (export, migrate, delete)
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useToast } from '../../../components/Toast';
import PageHeader from '../../../components/ui/PageHeader';
import { usePreferences } from '../../../hooks/usePreferences';
import { CollapsibleSection } from './components/CollapsibleSection';
import { DataInventoryRow } from './components/DataInventoryRow';
import { ExportButton } from './components/ExportButton';
import { MigrationCard } from './components/MigrationCard';
import { PrivacyToggle } from './components/PrivacyToggle';
import { DATA_INVENTORY, EXPORT_FORMATS, MIGRATION_PLATFORMS, PROTOCOL_ICONS } from './constants';
import type { DeleteStatus, ThirdPartyConnection } from './types';

export default function PrivacySettingsPage() {
  const { walletAddress } = useAuth();
  const { prefs, setPrivacy, saveToServer, saving } = usePreferences();
  const { showToast } = useToast();
  const [connectedAccounts, setConnectedAccounts] = useState<ThirdPartyConnection[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch connected accounts status
  useEffect(() => {
    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const res = await fetch('/api/accounts/connected', { credentials: 'include' });
        if (res.ok) {
          const data = (await res.json()) as {
            accounts?: Array<{
              platform: string;
              username?: string;
              connected: boolean;
              lastSync?: string;
            }>;
          };
          const accounts = (data.accounts || []).map((a) => ({
            protocol: a.platform,
            connected: a.connected,
            handle: a.username,
            dataShared: ['public posts', 'profile'],
            lastSync: a.lastSync,
          }));
          const allPlatforms = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'activitypub'];
          const result: ThirdPartyConnection[] = allPlatforms.map((p) => {
            const existing = accounts.find((a) => a.protocol === p);
            return existing || { protocol: p, connected: false, dataShared: [], icon: '' };
          });
          setConnectedAccounts(
            result.map((r) => ({
              ...r,
              icon: PROTOCOL_ICONS[r.protocol] || '🔗',
            })),
          );
        }
      } catch {
        /* ignore */
      }
      setLoadingAccounts(false);
    };
    fetchAccounts();
  }, []);

  // Fetch pending deletion status
  useEffect(() => {
    const fetchDeleteStatus = async () => {
      try {
        const res = await fetch('/api/account/delete', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ check: true }),
        });
        if (res.status === 409) {
          const data = (await res.json()) as {
            pendingSince?: string;
            recoverableUntil?: string;
            message?: string;
          };
          setDeleteStatus({
            pending: true,
            recoverableUntil: data.recoverableUntil,
            message: data.message,
          });
        }
      } catch {
        /* ignore */
      }
    };
    fetchDeleteStatus();
  }, []);

  const handlePrivacyToggle = useCallback(
    (key: 'publicProfile' | 'showTipsReceived' | 'showFollowers', value: boolean) => {
      setPrivacy({ ...prefs.privacy, [key]: value });
    },
    [prefs.privacy, setPrivacy],
  );

  const handleSave = useCallback(async () => {
    await saveToServer();
    showToast('success', 'Privacy settings saved');
  }, [saveToServer, showToast]);

  const handleInitiateDeletion = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST', credentials: 'include' });
      const data = (await res.json()) as {
        pending?: boolean;
        message?: string;
        recoverableUntil?: string;
        error?: string;
      };
      if (res.ok || res.status === 409) {
        if (data.pending || res.status === 409) {
          setDeleteStatus({
            pending: true,
            recoverableUntil: data.recoverableUntil,
            message: data.message || 'Deletion scheduled',
          });
          setShowDeleteConfirm(false);
          showToast('warning', '⏳ 30-day grace period started. Check your email.');
        }
      } else {
        showToast('error', data.error || 'Failed to initiate deletion');
      }
    } catch {
      showToast('error', 'Failed to initiate deletion');
    }
    setDeleting(false);
  }, [showToast]);

  const handleCancelDeletion = useCallback(async () => {
    try {
      const res = await fetch('/api/account/delete/cancel', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setDeleteStatus(null);
        showToast('success', '✓ Deletion cancelled. All data retained.');
      } else {
        showToast('error', 'Failed to cancel deletion');
      }
    } catch {
      showToast('error', 'Failed to cancel deletion');
    }
  }, [showToast]);

  const handleReactivate = useCallback(async () => {
    try {
      const res = await fetch('/api/account/delete/reactivate', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setDeleteStatus(null);
        showToast('success', '✓ Account reactivated! Welcome back.');
      } else {
        const data = (await res.json()) as { error?: string };
        showToast('error', data.error || 'Failed to reactivate');
      }
    } catch {
      showToast('error', 'Failed to reactivate');
    }
  }, [showToast]);

  const handleSignatureConfirm = useCallback(
    async (signature: string) => {
      setDeleting(true);
      try {
        const msg = `I confirm deletion of my DegenFeed account (${walletAddress?.slice(0, 8)}...${walletAddress?.slice(-4)})\nNonce: ${Date.now().toString(36)}\nTimestamp: ${new Date().toISOString()}`;
        const res = await fetch('/api/account/delete/confirm-signature', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ signature, message: msg }),
        });
        if (res.ok) {
          showToast('success', '✓ Signature confirmed. Deletion will proceed after grace period.');
        } else {
          const data = (await res.json()) as { error?: string };
          showToast('error', data.error || 'Signature verification failed');
        }
      } catch {
        showToast('error', 'Failed to confirm signature');
      }
      setDeleting(false);
    },
    [walletAddress, showToast],
  );

  const handleGetSignatureMessage = useCallback(() => {
    return `I confirm deletion of my DegenFeed account (${walletAddress?.slice(0, 8)}...${walletAddress?.slice(-4)})\nNonce: ${Date.now().toString(36)}\nTimestamp: ${new Date().toISOString()}`;
  }, [walletAddress]);

  const connectedCount = connectedAccounts.filter((a) => a.connected).length;
  const totalDataItems = DATA_INVENTORY.filter((d) => d.stored).length;
  const totalDeletable = DATA_INVENTORY.filter((d) => d.canBeDeleted).length;

  const shieldIcon = (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-28 sm:pb-6">
      <PageHeader
        title="Privacy & Data"
        description="Complete control over your data. Export, migrate, or delete — your data, your rules."
        icon={shieldIcon}
        breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Privacy & Data' }]}
      />

      {/* DATA INVENTORY */}
      <section className="mb-6" aria-labelledby="heading-inventory">
        <CollapsibleSection
          title="Data Inventory"
          description={`${totalDataItems} categories tracked — see exactly what we store`}
          icon="📋"
          defaultOpen={true}
        >
          <div className="space-y-2">
            {DATA_INVENTORY.map((item) => (
              <DataInventoryRow key={item.category} item={item} />
            ))}
          </div>
          <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3">
            <p className="text-xs text-degen-400">
              <strong>Your data, your rules.</strong> We store only what&apos;s needed to provide
              the service.
              {totalDeletable < totalDataItems
                ? ' Some data is retained for legal compliance (GDPR Article 30).'
                : ' All stored data can be deleted on request.'}
            </p>
          </div>
        </CollapsibleSection>
      </section>

      {/* PRIVACY CONTROLS */}
      <section className="mb-6" aria-labelledby="heading-controls">
        <CollapsibleSection
          title="Privacy Controls"
          description="Who can see your profile and activity"
          icon="👁️"
          defaultOpen={true}
        >
          <PrivacyToggle
            id="privacy-public-profile"
            label="Public Profile"
            description="Your profile is visible to everyone. Turn off to hide from non-users."
            checked={prefs.privacy.publicProfile}
            onChange={(v) => handlePrivacyToggle('publicProfile', v)}
          />
          <PrivacyToggle
            id="privacy-show-tips"
            label="Show Tips Received"
            description="Display your received tips on your profile."
            checked={prefs.privacy.showTipsReceived}
            onChange={(v) => handlePrivacyToggle('showTipsReceived', v)}
          />
          <PrivacyToggle
            id="privacy-show-followers"
            label="Show Followers"
            description="Display your follower count and list on your profile."
            checked={prefs.privacy.showFollowers}
            onChange={(v) => handlePrivacyToggle('showFollowers', v)}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm self-start"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving...
              </span>
            ) : (
              'Save Privacy Settings'
            )}
          </button>
        </CollapsibleSection>
      </section>

      {/* DATA EXPORT */}
      <section className="mb-6" aria-labelledby="heading-export">
        <CollapsibleSection
          title="Export Your Data"
          description="Download everything in the format you choose"
          icon="📥"
          defaultOpen={true}
        >
          <p className="text-xs text-[var(--color-muted)] mb-3">
            Export all your data in any format. JSON for developers, CSV for spreadsheets, HTML for
            browsing, or protocol-specific formats for migration.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXPORT_FORMATS.map((fmt) => (
              <ExportButton key={fmt.id} format={fmt} walletAddress={walletAddress ?? null} />
            ))}
          </div>
          <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3">
            <p className="text-xs text-degen-400">
              🔒 All exports are generated on-the-fly from your live data. No copies are retained by
              us after download.
            </p>
          </div>
        </CollapsibleSection>
      </section>

      {/* DATA MIGRATION */}
      <section className="mb-6" aria-labelledby="heading-migration">
        <CollapsibleSection
          title="Import From Other Platforms"
          description="Bring your content from Twitter, Mastodon, Nostr, Bluesky, or Farcaster"
          icon="📦"
          defaultOpen={false}
        >
          <p className="text-xs text-[var(--color-muted)] mb-3">
            Import your existing content into DegenFeed. Paste your platform archive JSON below.
            Your content will be stored in your content library and available for cross-posting.
          </p>
          <div className="space-y-2">
            {MIGRATION_PLATFORMS.map((platform) => (
              <MigrationCard
                key={platform.id}
                platform={platform}
                walletAddress={walletAddress ?? null}
                onStatusChange={() => {}}
              />
            ))}
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-xs text-amber-400">
              ⚠️ Imports are stored in your DegenFeed content library. They are not automatically
              published to connected protocols. Use the publish flow to cross-post imported content.
            </p>
          </div>
        </CollapsibleSection>
      </section>

      {/* THIRD-PARTY CONNECTIONS */}
      <section className="mb-6" aria-labelledby="heading-connections">
        <CollapsibleSection
          title="Connected Protocols"
          description={`${connectedCount} protocols connected`}
          icon="🔗"
          defaultOpen={false}
        >
          {loadingAccounts ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--color-overlay)]" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {connectedAccounts.map((acct) => (
                <div
                  key={acct.protocol}
                  className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3"
                >
                  <span className="text-lg">{acct.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-fg)] capitalize">
                        {acct.protocol}
                      </span>
                      {acct.connected && (
                        <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[9px] font-medium text-degen-400">
                          Connected
                        </span>
                      )}
                    </div>
                    {acct.handle && (
                      <p className="text-xs text-[var(--color-muted)]">{acct.handle}</p>
                    )}
                    {acct.connected && acct.lastSync && (
                      <p className="text-[10px] text-[var(--color-muted)]">
                        Last synced: {new Date(acct.lastSync).toLocaleDateString()}
                      </p>
                    )}
                    {acct.dataShared.length > 0 && (
                      <p className="text-[10px] text-[var(--color-muted)] mt-0.5">
                        Data shared: {acct.dataShared.join(', ')}
                      </p>
                    )}
                  </div>
                  <a
                    href="/settings/connected-accounts"
                    className="rounded-lg border border-[var(--color-glass-border)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                  >
                    Manage
                  </a>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>
      </section>

      {/* DELETE ACCOUNT */}
      <section aria-labelledby="heading-requests">
        <CollapsibleSection
          title="Delete Account & Data"
          description={
            deleteStatus?.pending
              ? '⏳ Deletion pending — grace period active'
              : 'Permanently delete your account and all data'
          }
          icon="🗑️"
          defaultOpen={!!deleteStatus?.pending}
        >
          {deleteStatus?.pending ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <span>⏳</span>
                  <span className="text-sm font-medium">Deletion in Progress</span>
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  Your account deletion is scheduled. You can cancel or reactivate anytime.
                </p>
                {deleteStatus.recoverableUntil && (
                  <p className="text-xs text-[var(--color-muted)] mt-1">
                    Recoverable until:{' '}
                    <strong className="text-amber-400">
                      {new Date(deleteStatus.recoverableUntil).toLocaleDateString()}
                    </strong>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleReactivate}
                  className="rounded-xl bg-degen-500/15 px-4 py-2.5 text-sm font-medium text-degen-400 transition-colors hover:bg-degen-500/25"
                >
                  🔄 Reactivate Account
                </button>
                <button
                  type="button"
                  onClick={handleCancelDeletion}
                  className="rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-[var(--color-overlay)]"
                >
                  Cancel Deletion
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const msg = handleGetSignatureMessage();
                    handleSignatureConfirm(msg);
                  }}
                  className="rounded-xl border border-amber-500/30 px-4 py-2.5 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10"
                >
                  ✍️ Confirm with Wallet Signature
                </button>
              </div>

              <p className="text-[10px] text-[var(--color-muted)]">
                Wallet signature confirmation is required before deletion can be finalized. This
                prevents unauthorized deletion if your session is compromised.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                <p className="text-xs text-red-400 font-medium">What happens when you delete:</p>
                <ul className="mt-2 space-y-1">
                  <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                    <span className="text-red-400 mt-1">•</span>
                    30-day grace period — you can cancel anytime
                  </li>
                  <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                    <span className="text-red-400 mt-1">•</span>
                    All stored data is permanently deleted from our servers
                  </li>
                  <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                    <span className="text-red-400 mt-1">•</span>
                    External protocols (Farcaster, Nostr, Lens) retain your data on their networks
                  </li>
                  <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                    <span className="text-red-400 mt-1">•</span>A deletion certificate is issued for
                    your records
                  </li>
                  <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                    <span className="text-red-400 mt-1">•</span>
                    Security audit logs retained for 90 days (GDPR compliance)
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3">
                <p className="text-xs text-degen-400">
                  💡 Before deleting, we recommend exporting your data first. Use the export section
                  above to download your data in any format.
                </p>
              </div>

              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full rounded-xl bg-red-500/15 px-4 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/25"
                >
                  Request Account Deletion
                </button>
              ) : (
                <div className="space-y-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-xs text-red-400 font-medium">
                    Are you absolutely sure? This will schedule deletion with a 30-day grace period.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleInitiateDeletion}
                      disabled={deleting}
                      className="flex-1 rounded-lg bg-red-500/20 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
                    >
                      {deleting ? 'Processing...' : 'Yes, schedule deletion'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 rounded-lg bg-[var(--color-overlay)] px-3 py-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3 mt-3">
            <p className="text-xs text-degen-400">
              🔒 Deletion requires wallet signature confirmation — your session alone is not enough.
              This prevents anyone with stolen session cookies from deleting your account.
            </p>
          </div>
        </CollapsibleSection>
      </section>
    </div>
  );
}
