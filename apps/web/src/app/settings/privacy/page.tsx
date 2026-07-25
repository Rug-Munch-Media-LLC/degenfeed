'use client';

/**
 * Privacy Dashboard — User Control & Data Sovereignty
 *
 * Complete visibility and control over:
 *   - Data inventory (what data we store)
 *   - Privacy controls (who can see what)
 *   - Third-party connections (linked protocols)
 *   - Data requests (export, migrate, delete)
 *
 * Every action here gives the user COMPLETE control over their data.
 * "Your data, your rules, forever."
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { usePreferences } from '../../../hooks/usePreferences';
import PageHeader from '../../../components/ui/PageHeader';
import { useToast } from '../../../components/Toast';

// ─── Types ──────────────────────────────────────────────────────────

interface DataInventoryItem {
  category: string;
  description: string;
  stored: boolean;
  retentionDays: number;
  canBeDeleted: boolean;
  icon: string;
}

interface ThirdPartyConnection {
  protocol: string;
  connected: boolean;
  handle?: string;
  dataShared: string[];
  lastSync?: string;
}

interface ExportFormat {
  id: string;
  label: string;
  description: string;
  icon: string;
  mimeType: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const DATA_INVENTORY: DataInventoryItem[] = [
  {
    category: 'Wallet Address',
    description: 'Your connected wallet address — used for identity and authentication',
    stored: true,
    retentionDays: 365,
    canBeDeleted: true,
    icon: '🔑',
  },
  {
    category: 'Profile',
    description: 'Display name, avatar, bio — visible to other users',
    stored: true,
    retentionDays: 365,
    canBeDeleted: true,
    icon: '👤',
  },
  {
    category: 'Preferences',
    description: 'Theme, font size, layout density, notification settings',
    stored: true,
    retentionDays: 365,
    canBeDeleted: true,
    icon: '⚙️',
  },
  {
    category: 'Follows',
    description: 'Who you follow — used for feed curation',
    stored: true,
    retentionDays: 365,
    canBeDeleted: true,
    icon: '👥',
  },
  {
    category: 'Muted Content',
    description: 'Muted authors and keywords — never shared',
    stored: true,
    retentionDays: 365,
    canBeDeleted: true,
    icon: '🔇',
  },
  {
    category: 'Behavior Profile',
    description: 'Dwell time, scroll patterns, engagement — used for feed ranking',
    stored: true,
    retentionDays: 90,
    canBeDeleted: true,
    icon: '📊',
  },
  {
    category: 'Bookmarks',
    description: 'Saved posts and content — your personal reading list',
    stored: true,
    retentionDays: 365,
    canBeDeleted: true,
    icon: '🔖',
  },
  {
    category: 'Subscriptions',
    description: 'Newsletter and notification subscriptions',
    stored: true,
    retentionDays: 365,
    canBeDeleted: true,
    icon: '📧',
  },
  {
    category: 'Published Content',
    description: 'Your posts, videos, and shorts — your creative work',
    stored: true,
    retentionDays: 365,
    canBeDeleted: true,
    icon: '📝',
  },
  {
    category: 'Platform Accounts',
    description: 'Connected protocol accounts (Nostr, Farcaster, Lens, Bluesky)',
    stored: true,
    retentionDays: 365,
    canBeDeleted: true,
    icon: '🔗',
  },
  {
    category: 'Security Log',
    description: 'Login attempts, device changes, security events — retained for compliance',
    stored: true,
    retentionDays: 90,
    canBeDeleted: false,
    icon: '🛡️',
  },
  {
    category: 'Session Data',
    description: 'Active browser sessions — cleared on logout or delete',
    stored: true,
    retentionDays: 7,
    canBeDeleted: true,
    icon: '🌐',
  },
];

const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: 'json',
    label: 'JSON',
    description: 'Full data export — machine-readable, complete',
    icon: '{ }',
    mimeType: 'application/json',
  },
  {
    id: 'csv',
    label: 'CSV',
    description: 'Spreadsheet-friendly — open in Excel, Google Sheets',
    icon: '📊',
    mimeType: 'text/csv',
  },
  {
    id: 'html',
    label: 'HTML Archive',
    description: 'Browsable web page — human-readable archive',
    icon: '🌐',
    mimeType: 'text/html',
  },
  {
    id: 'activitypub',
    label: 'ActivityPub',
    description: 'Federated format — import into Mastodon, Pleroma',
    icon: '🔄',
    mimeType: 'application/activity+json',
  },
  {
    id: 'nostr',
    label: 'Nostr Events',
    description: 'NDJSON events — import into any Nostr client',
    icon: '⚡',
    mimeType: 'application/x-ndjson',
  },
  {
    id: 'atproto',
    label: 'AT Protocol',
    description: 'Bluesky-compatible — import into any PDS',
    icon: '☁️',
    mimeType: 'application/json',
  },
  {
    id: 'solid',
    label: 'Solid POD',
    description: 'True data ownership — Solid protocol compatible',
    icon: '📦',
    mimeType: 'application/ld+json',
  },
];

const MIGRATION_PLATFORMS = [
  { id: 'twitter', label: 'Twitter / X', icon: '🐦', direction: 'import' as const },
  { id: 'mastodon', label: 'Mastodon', icon: '🐘', direction: 'both' as const },
  { id: 'nostr', label: 'Nostr', icon: '⚡', direction: 'both' as const },
  { id: 'bluesky', label: 'Bluesky', icon: '☁️', direction: 'both' as const },
  { id: 'farcaster', label: 'Farcaster', icon: '🏠', direction: 'import' as const },
];

// ─── Sub-components ─────────────────────────────────────────────────

function CollapsibleSection({
  title,
  description,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] transition-all">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--color-overlay)]"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-degen-500/10 text-lg">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--color-fg)]">{title}</div>
          <div className="text-xs text-[var(--color-muted)] truncate">{description}</div>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={`shrink-0 text-[var(--color-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="border-t border-[var(--color-glass-border)] px-5 py-4 space-y-3">{children}</div>}
    </div>
  );
}

function DataInventoryRow({ item }: { item: DataInventoryItem }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
      <span className="text-lg mt-0.5">{item.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[var(--color-fg)]">{item.category}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
              item.stored
                ? 'bg-degen-500/15 text-degen-400'
                : 'bg-[var(--color-muted-bg)] text-[var(--color-muted)]'
            }`}
          >
            {item.stored ? 'Stored' : 'Not stored'}
          </span>
          {!item.canBeDeleted && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-medium text-amber-400">
              Compliance required
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">{item.description}</p>
        <p className="text-[10px] text-[var(--color-muted)] mt-1">
          Retained for {item.retentionDays} days
          {!item.canBeDeleted && ' (GDPR Article 30 — security/compliance)'}
        </p>
      </div>
    </div>
  );
}

function ExportButton({ format, walletAddress }: { format: ExportFormat; walletAddress: string | null }) {
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [lastExported, setLastExported] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!walletAddress) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/account/export/${format.id}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');

      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `degenfeed-${format.id}-${new Date().toISOString().slice(0, 10)}.${format.id === 'html' ? 'html' : format.id === 'csv' ? 'csv' : 'json'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastExported(new Date().toLocaleString());
      showToast('success', `✓ ${format.label} export downloaded`);
    } catch {
      showToast('error', `Failed to export ${format.label}`);
    } finally {
      setExporting(false);
    }
  }, [format, walletAddress, showToast]);

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting || !walletAddress}
      className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3 transition-colors hover:bg-[var(--color-card-hover)] disabled:opacity-40 text-left w-full group"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-degen-500/10 text-sm font-bold text-degen-400">
        {format.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--color-fg)]">{format.label}</div>
        <p className="text-xs text-[var(--color-muted)]">{format.description}</p>
        {lastExported && (
          <p className="text-[10px] text-degen-400 mt-0.5">Last exported: {lastExported}</p>
        )}
      </div>
      <span className="text-xs text-[var(--color-muted)] group-hover:text-degen-400 transition-colors">
        {exporting ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
      </span>
    </button>
  );
}

function MigrationCard({
  platform,
  walletAddress,
  onStatusChange,
}: {
  platform: typeof MIGRATION_PLATFORMS[0];
  walletAddress: string | null;
  onStatusChange: () => void;
}) {
  const { showToast } = useToast();
  const [importing, setImporting] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const handleImport = useCallback(async () => {
    if (!jsonInput.trim()) return;
    setImporting(true);
    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonInput);
      } catch {
        showToast('error', 'Invalid JSON format');
        setImporting(false);
        return;
      }

      const res = await fetch(`/api/account/migrate/import/${platform.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Import failed');
      }

      const result = await res.json() as { imported?: number; total?: number; errors?: string[] };
      showToast(
        'success',
        `✓ Imported ${result.imported || 0}/${result.total || 0} items from ${platform.label}`,
      );
      setJsonInput('');
      setShowInput(false);
      onStatusChange();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [platform, jsonInput, showToast, onStatusChange]);

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-lg">{platform.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--color-fg)]">{platform.label}</div>
          <p className="text-xs text-[var(--color-muted)]">
            {platform.direction === 'both' ? 'Import & Export' : `${platform.direction === 'import' ? 'Import from' : 'Export to'} ${platform.label}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInput(!showInput)}
          className="rounded-lg bg-degen-500/15 px-3 py-1.5 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/25"
        >
          {showInput ? 'Cancel' : 'Import Data'}
        </button>
      </div>

      {showInput && (
        <div className="mt-3 space-y-2">
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder={`Paste ${platform.label} archive JSON here...
Example: { "tweets": [...] } or { "events": [...] }`}
            className="input w-full min-h-[100px] text-xs font-mono"
            spellCheck={false}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !jsonInput.trim() || !walletAddress}
              className="btn-primary text-xs"
            >
              {importing ? 'Importing...' : `Import into DegenFeed`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PrivacyToggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-fg)]">
          {label}
        </label>
        <p className="text-xs text-[var(--color-muted)] mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        data-checked={checked}
        onClick={() => onChange(!checked)}
        className="toggle-track shrink-0"
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function PrivacySettingsPage() {
  const { walletAddress, linkedIdentities, primaryIdentity } = useAuth();
  const { prefs, setPrivacy, saveToServer, saving } = usePreferences();
  const { showToast } = useToast();
  const [connectedAccounts, setConnectedAccounts] = useState<ThirdPartyConnection[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [deleteStatus, setDeleteStatus] = useState<{
    pending: boolean;
    recoverableUntil?: string;
    message?: string;
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState('');
  const [signatureInput, setSignatureInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [migrationKey, setMigrationKey] = useState(0);

  // Fetch connected accounts status
  useEffect(() => {
    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const res = await fetch('/api/accounts/connected', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json() as { accounts?: Array<{ platform: string; username?: string; connected: boolean; lastSync?: string }> };
          const accounts = (data.accounts || []).map((a) => ({
            protocol: a.platform,
            connected: a.connected,
            handle: a.username,
            dataShared: ['public posts', 'profile'],
            lastSync: a.lastSync,
          }));
          // Default platforms
          const allPlatforms = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'activitypub'];
          const result: ThirdPartyConnection[] = allPlatforms.map((p) => {
            const existing = accounts.find((a) => a.protocol === p);
            return existing || { protocol: p, connected: false, dataShared: [], icon: '' };
          });
          // Assign icons
          const icons: Record<string, string> = {
            nostr: '⚡', farcaster: '🏠', lens: '🌿', bluesky: '☁️', mastodon: '🐘', activitypub: '🔄',
          };
          setConnectedAccounts(result.map((r) => ({ ...r, icon: icons[r.protocol] || '🔗' })));
        }
      } catch { /* ignore */ }
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
          const data = await res.json() as { pendingSince?: string; recoverableUntil?: string; message?: string };
          setDeleteStatus({
            pending: true,
            recoverableUntil: data.recoverableUntil,
            message: data.message,
          });
        }
      } catch { /* ignore */ }
    };
    fetchDeleteStatus();
  }, []);

  // Handle privacy toggle
  const handlePrivacyToggle = useCallback(
    (key: 'publicProfile' | 'showTipsReceived' | 'showFollowers', value: boolean) => {
      setPrivacy({ ...prefs.privacy, [key]: value });
    },
    [prefs.privacy, setPrivacy],
  );

  // Handle save
  const handleSave = useCallback(async () => {
    await saveToServer();
    showToast('success', 'Privacy settings saved');
  }, [saveToServer, showToast]);

  // Handle account deletion
  const handleInitiateDeletion = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json() as { pending?: boolean; message?: string; recoverableUntil?: string; error?: string };
      if (res.ok || res.status === 409) {
        if (data.pending || res.status === 409) {
          setDeleteStatus({
            pending: true,
            recoverableUntil: data.recoverableUntil,
            message: data.message || 'Deletion scheduled',
          });
          showToast('warning', '⏳ 30-day grace period started. Check your email.');
          setShowDeleteConfirm(false);
        }
      } else {
        showToast('error', data.error || 'Failed to initiate deletion');
      }
    } catch {
      showToast('error', 'Failed to initiate deletion');
    }
    setDeleting(false);
  }, [showToast]);

  // Handle deletion cancel
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

  // Handle reactivation
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
        const data = await res.json() as { error?: string };
        showToast('error', data.error || 'Failed to reactivate');
      }
    } catch {
      showToast('error', 'Failed to reactivate');
    }
  }, [showToast]);

  // Handle signature confirmation
  const handleSignatureConfirm = useCallback(async () => {
    if (!signatureInput.trim()) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete/confirm-signature', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          signature: signatureInput.trim(),
          message: signatureMessage,
        }),
      });
      if (res.ok) {
        showToast('success', '✓ Signature confirmed. Deletion will proceed after grace period.');
        setShowSignatureModal(false);
        setSignatureInput('');
      } else {
        const data = await res.json() as { error?: string };
        showToast('error', data.error || 'Signature verification failed');
      }
    } catch {
      showToast('error', 'Failed to confirm signature');
    }
    setDeleting(false);
  }, [signatureInput, signatureMessage, showToast]);

  // Generate signature message
  const handleGetSignatureMessage = useCallback(async () => {
    const msg = `I confirm deletion of my DegenFeed account (${walletAddress?.slice(0, 8)}...${walletAddress?.slice(-4)})\nNonce: ${Date.now().toString(36)}\nTimestamp: ${new Date().toISOString()}`;
    setSignatureMessage(msg);
    setShowSignatureModal(true);
  }, [walletAddress]);

  // Connected protocols
  const connectedProtocols = linkedIdentities
    .map((i) => i.protocol)
    .filter(Boolean)
    .concat(primaryIdentity?.protocol || []);

  const shieldIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );

  const totalDataItems = DATA_INVENTORY.filter((d) => d.stored).length;
  const totalDeletable = DATA_INVENTORY.filter((d) => d.canBeDeleted).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-28 sm:pb-6">
      <PageHeader
        title="Privacy & Data"
        description="Complete control over your data. Export, migrate, or delete — your data, your rules."
        icon={shieldIcon}
        breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Privacy & Data' }]}
      />

      {/* === DATA INVENTORY ======================================== */}
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
              <strong>Your data, your rules.</strong> We store only what's needed to provide the service.
              {totalDeletable < totalDataItems
                ? ' Some data is retained for legal compliance (GDPR Article 30).'
                : ' All stored data can be deleted on request.'}
            </p>
          </div>
        </CollapsibleSection>
      </section>

      {/* === PRIVACY CONTROLS ====================================== */}
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

      {/* === DATA EXPORT =========================================== */}
      <section className="mb-6" aria-labelledby="heading-export">
        <CollapsibleSection
          title="Export Your Data"
          description="Download everything in the format you choose"
          icon="📥"
          defaultOpen={true}
        >
          <p className="text-xs text-[var(--color-muted)] mb-3">
            Export all your data in any format. JSON for developers, CSV for spreadsheets,
            HTML for browsing, or protocol-specific formats for migration.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXPORT_FORMATS.map((fmt) => (
              <ExportButton key={fmt.id} format={fmt} walletAddress={walletAddress} />
            ))}
          </div>
          <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3">
            <p className="text-xs text-degen-400">
              🔒 All exports are generated on-the-fly from your live data.
              No copies are retained by us after download.
            </p>
          </div>
        </CollapsibleSection>
      </section>

      {/* === DATA MIGRATION ======================================== */}
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
          <div className="space-y-2" key={migrationKey}>
            {MIGRATION_PLATFORMS.map((platform) => (
              <MigrationCard
                key={platform.id}
                platform={platform}
                walletAddress={walletAddress}
                onStatusChange={() => setMigrationKey((k) => k + 1)}
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

      {/* === THIRD-PARTY CONNECTIONS =============================== */}
      <section className="mb-6" aria-labelledby="heading-connections">
        <CollapsibleSection
          title="Connected Protocols"
          description={`${connectedAccounts.filter((a) => a.connected).length} protocols connected`}
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
                    href={`/settings/connected-accounts`}
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

      {/* === DATA REQUESTS (Delete Account) ======================== */}
      <section aria-labelledby="heading-requests">
        <CollapsibleSection
          title="Delete Account & Data"
          description={deleteStatus?.pending ? '⏳ Deletion pending — grace period active' : 'Permanently delete your account and all data'}
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
                  onClick={handleGetSignatureMessage}
                  className="rounded-xl border border-amber-500/30 px-4 py-2.5 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10"
                >
                  ✍️ Confirm with Wallet Signature
                </button>
              </div>

              <p className="text-[10px] text-[var(--color-muted)]">
                Wallet signature confirmation is required before deletion can be finalized.
                This prevents unauthorized deletion if your session is compromised.
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
                    <span className="text-red-400 mt-1">•</span>
                    A deletion certificate is issued for your records
                  </li>
                  <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                    <span className="text-red-400 mt-1">•</span>
                    Security audit logs retained for 90 days (GDPR compliance)
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 px-4 py-3">
                <p className="text-xs text-degen-400">
                  💡 Before deleting, we recommend exporting your data first.
                  Use the export section above to download your data in any format.
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

          {/* Signature confirmation modal */}
          {showSignatureModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-md rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 shadow-2xl">
                <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">
                  Sign Deletion Confirmation
                </h3>
                <p className="text-xs text-[var(--color-muted)] mb-3">
                  Sign this message with your wallet to authorize the deletion.
                </p>

                <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-3 mb-3">
                  <p className="text-xs font-mono text-[var(--color-fg)] break-all">
                    {signatureMessage}
                  </p>
                </div>

                <div className="mb-3">
                  <label className="mb-1 block text-xs font-medium text-[var(--color-fg)]">
                    Signature
                  </label>
                  <textarea
                    value={signatureInput}
                    onChange={(e) => setSignatureInput(e.target.value)}
                    placeholder="Paste your wallet signature here..."
                    className="input w-full min-h-[80px] text-xs font-mono"
                    spellCheck={false}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSignatureConfirm}
                    disabled={deleting || !signatureInput.trim()}
                    className="flex-1 rounded-xl bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                  >
                    {deleting ? 'Verifying...' : 'Confirm Signature'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignatureModal(false);
                      setSignatureInput('');
                    }}
                    className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
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
