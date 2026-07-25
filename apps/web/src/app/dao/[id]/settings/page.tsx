'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MOCK_DAO } from '../layout';

// ─── Types ─────────────────────────────────────────────────────────────

interface GovernanceParam {
  key: string;
  label: string;
  value: string;
  description: string;
  requiresConstitutional: boolean;
}

interface TreasurySigner {
  address: string;
  avatar: string;
  label: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────

const DEFAULT_GOVERNANCE_PARAMS: GovernanceParam[] = [
  {
    key: 'quorum',
    label: 'Quorum Threshold',
    value: '10%',
    description: 'Minimum % of total voting power required for a valid vote',
    requiresConstitutional: true,
  },
  {
    key: 'threshold',
    label: 'Approval Threshold',
    value: '60%',
    description: 'Minimum % of FOR votes required for a proposal to pass',
    requiresConstitutional: true,
  },
  {
    key: 'votingPeriod',
    label: 'Voting Period',
    value: '7 days',
    description: 'Duration each proposal remains open for voting',
    requiresConstitutional: true,
  },
  {
    key: 'timelock',
    label: 'Timelock Duration',
    value: '48 hours',
    description: 'Delay before passed proposals can be executed',
    requiresConstitutional: true,
  },
  {
    key: 'minProposalPower',
    label: 'Min Proposal Power',
    value: '50,000',
    description: 'Minimum voting power required to create a proposal',
    requiresConstitutional: false,
  },
];

const MOCK_SIGNERS: TreasurySigner[] = [
  { address: '0x742d35Cc6634C0532925a3b844Bc4a3b8b8b8b8b', avatar: '🧠', label: 'Lead Steward' },
  {
    address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958D2D3a8b8b8b8b',
    avatar: '⚡',
    label: 'Treasury Steward',
  },
  { address: '0x1234567890abcdef1234567890abcdef12345678', avatar: '🐋', label: 'Community Rep' },
  { address: '0xabcdef1234567890abcdef1234567890abcdef12', avatar: '🦊', label: 'Community Rep' },
];

// ─── Section Wrapper ───────────────────────────────────────────────────

function SettingsSection({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        danger
          ? 'border-red-500/20 bg-red-500/5'
          : 'border-[var(--color-glass-border)] bg-[var(--color-card)]'
      }`}
    >
      <h2
        className={`text-sm font-bold mb-1 ${danger ? 'text-red-400' : 'text-[var(--color-fg)]'}`}
      >
        {danger && '⚠️ '}
        {title}
      </h2>
      {description && <p className="mb-4 text-xs text-[var(--color-muted)]">{description}</p>}
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE — DAO Settings
// ══════════════════════════════════════════════════════════════════════

export default function DAOSettingsPage({ params }: { params: { id: string } }) {
  const [daoName, setDaoName] = useState(MOCK_DAO.name);
  const [daoDescription, setDaoDescription] = useState(MOCK_DAO.description);
  const [daoAvatar, setDaoAvatar] = useState(MOCK_DAO.avatar);
  const [bannerColor, setBannerColor] = useState('#00ff41');
  const [twitterLink, setTwitterLink] = useState(MOCK_DAO.socialLinks.twitter);
  const [discordLink, setDiscordLink] = useState(MOCK_DAO.socialLinks.discord);
  const [telegramLink, setTelegramLink] = useState(MOCK_DAO.socialLinks.telegram);
  const [websiteLink, setWebsiteLink] = useState(MOCK_DAO.socialLinks.website);
  const [showDangerConfirm, setShowDangerConfirm] = useState<string | null>(null);

  // ─── Profile Section ─────────────────────────────────────────────

  const ProfileSection = () => (
    <SettingsSection
      title="DAO Profile"
      description="Update your DAO's name, description, and branding."
    >
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-degen-500/10 text-2xl">
              {daoAvatar}
            </span>
            <button
              type="button"
              onClick={() => {
                const emoji = prompt('Enter emoji for DAO avatar:');
                if (emoji) setDaoAvatar(emoji);
              }}
              className="text-[9px] text-degen-400 hover:underline"
            >
              Change
            </button>
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <label
                htmlFor="dao-name"
                className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
              >
                DAO Name
              </label>
              <input
                id="dao-name"
                type="text"
                value={daoName}
                onChange={(e) => setDaoName(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="dao-desc"
                className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
              >
                Description
              </label>
              <textarea
                id="dao-desc"
                value={daoDescription}
                onChange={(e) => setDaoDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors resize-y"
              />
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );

  // ─── Social Links ────────────────────────────────────────────────

  const SocialSection = () => (
    <SettingsSection title="Social Links">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="twitter"
            className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
          >
            Twitter
          </label>
          <input
            id="twitter"
            type="url"
            value={twitterLink}
            onChange={(e) => setTwitterLink(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs text-[var(--color-fg)] font-mono outline-none focus:border-degen-500 transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="discord"
            className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
          >
            Discord
          </label>
          <input
            id="discord"
            type="url"
            value={discordLink}
            onChange={(e) => setDiscordLink(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs text-[var(--color-fg)] font-mono outline-none focus:border-degen-500 transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="telegram"
            className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
          >
            Telegram
          </label>
          <input
            id="telegram"
            type="url"
            value={telegramLink}
            onChange={(e) => setTelegramLink(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs text-[var(--color-fg)] font-mono outline-none focus:border-degen-500 transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="website"
            className="mb-1 block text-[10px] font-medium text-[var(--color-muted)]"
          >
            Website
          </label>
          <input
            id="website"
            type="url"
            value={websiteLink}
            onChange={(e) => setWebsiteLink(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs text-[var(--color-fg)] font-mono outline-none focus:border-degen-500 transition-colors"
          />
        </div>
      </div>
    </SettingsSection>
  );

  // ─── Governance Parameters ───────────────────────────────────────

  const GovernanceSection = () => (
    <SettingsSection
      title="Governance Parameters"
      description="DAO-wide governance rules. Changes to these parameters require a constitutional proposal."
    >
      <div className="space-y-3">
        {DEFAULT_GOVERNANCE_PARAMS.map((param) => (
          <div
            key={param.key}
            className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[var(--color-fg)]">{param.label}</span>
                {param.requiresConstitutional && (
                  <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[8px] text-purple-400">
                    Constitutional
                  </span>
                )}
              </div>
              <p className="text-[9px] text-[var(--color-muted)] mt-0.5">{param.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold tabular-nums text-[var(--color-fg)] font-mono">
                {param.value}
              </span>
              <button
                type="button"
                className="rounded-lg bg-purple-500/10 px-2.5 py-1 text-[9px] font-semibold text-purple-400 hover:bg-purple-500/20 transition-colors"
              >
                {param.requiresConstitutional ? 'Propose Change' : 'Edit'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </SettingsSection>
  );

  // ─── Treasury Signers ────────────────────────────────────────────

  const TreasurySection = () => {
    const [signers, setSigners] = useState(MOCK_SIGNERS);
    const threshold = 3;

    return (
      <SettingsSection
        title="Treasury Signers"
        description={`Manage who can sign treasury transactions. ${threshold} of ${signers.length} signatures required.`}
      >
        <div className="space-y-2 mb-4">
          {signers.map((signer, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] p-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-glass-border)] text-sm">
                  {signer.avatar}
                </span>
                <div>
                  <div className="text-xs font-semibold text-[var(--color-fg)]">{signer.label}</div>
                  <div className="text-[9px] font-mono text-[var(--color-muted)]">
                    {signer.address.slice(0, 10)}...{signer.address.slice(-6)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSigners(signers.filter((_, j) => j !== i))}
                className="rounded-lg bg-red-500/10 px-2.5 py-1 text-[9px] text-red-400 hover:bg-red-500/20 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-dashed border-[var(--color-glass-border)] px-3 py-2 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            + Add Signer
          </button>
          <div className="flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
            <span>Current threshold:</span>
            <select
              className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-2 py-1 text-[10px] text-[var(--color-fg)] outline-none"
              defaultValue={threshold}
            >
              {Array.from({ length: signers.length }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} of {signers.length}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SettingsSection>
    );
  };

  // ─── Appearance ──────────────────────────────────────────────────

  const AppearanceSection = () => (
    <SettingsSection title="Appearance" description="Customize your DAO's visual identity.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)]">
            Accent Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={bannerColor}
              onChange={(e) => setBannerColor(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded-lg border border-[var(--color-glass-border)] bg-transparent"
            />
            <span className="font-mono text-[10px] text-[var(--color-muted)]">{bannerColor}</span>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)]">
            Preview
          </label>
          <div
            className="h-10 rounded-lg border border-[var(--color-glass-border)]"
            style={{ backgroundColor: `${bannerColor}20`, borderColor: `${bannerColor}40` }}
          >
            <div className="h-full w-1/3 rounded-lg" style={{ backgroundColor: bannerColor }} />
          </div>
        </div>
      </div>
    </SettingsSection>
  );

  // ─── Integration Connection Status Badge ─────────────────────────

  function IntegrationBadge({ connected, label }: { connected: boolean; label: string }) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
          connected ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-amber-400'}`}
        />
        {label}
      </span>
    );
  }

  // ─── External Integrations Section ────────────────────────────────

  const IntegrationsSection = () => {
    // In production, fetch from /api/dao/:daoId/registry
    const [integrations, setIntegrations] = useState({
      snapshot: { connected: false, spaceId: '', url: '', syncing: false, votesImported: 0 },
      tally: { connected: false, governorAddress: '', url: '', verified: false },
      realms: { connected: false, realmId: '', url: '' },
      defender: {
        connected: false,
        autotaskConfigured: false,
        sentinelConfigured: false,
        relayConfigured: false,
        url: 'https://defender.openzeppelin.com',
      },
      delegateRegistry: { connected: false, registered: false },
    });

    const [showSyncModal, setShowSyncModal] = useState<string | null>(null);
    const [snapshotSpaceInput, setSnapshotSpaceInput] = useState('');
    const [governorAddressInput, setGovernorAddressInput] = useState('');
    const [realmIdInput, setRealmIdInput] = useState('');

    // In production, useEffect would fetch registry state
    useEffect(() => {
      // fetch(`/api/dao/${params.id}/registry`).then(...)
    }, [params.id]);

    return (
      <SettingsSection
        title="External Integrations"
        description="Connect your DAO with the broader DAO ecosystem — Snapshot, Tally, Realms, and OpenZeppelin Defender."
      >
        <div className="space-y-4">
          {/* ── Snapshot ── */}
          <div className="rounded-lg border border-[var(--color-glass-border)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-glass-border)] text-sm">
                  🗳️
                </span>
                <div>
                  <div className="text-xs font-semibold text-[var(--color-fg)]">Snapshot.org</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <IntegrationBadge
                      connected={integrations.snapshot.connected}
                      label={integrations.snapshot.connected ? 'Connected' : 'Not Configured'}
                    />
                    {integrations.snapshot.syncing && (
                      <span className="text-[9px] text-degen-400 animate-pulse">Syncing...</span>
                    )}
                  </div>
                </div>
              </div>
              {integrations.snapshot.url ? (
                <a
                  href={integrations.snapshot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
                >
                  View on Snapshot ↗
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSyncModal('snapshot')}
                  className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
                >
                  Connect
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[9px] text-[var(--color-muted)]">
              <div>
                <span className="block font-semibold text-[var(--color-fg)]">Space</span>
                {integrations.snapshot.spaceId || '—'}
              </div>
              <div>
                <span className="block font-semibold text-[var(--color-fg)]">Votes Imported</span>
                {integrations.snapshot.votesImported}
              </div>
            </div>
            {integrations.snapshot.connected && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[var(--color-glass-border)] px-2.5 py-1 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  Sync Proposals
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[var(--color-glass-border)] px-2.5 py-1 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  Import Votes
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[var(--color-glass-border)] px-2.5 py-1 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  View Strategy JSON
                </button>
              </div>
            )}
            <div className="mt-2 text-[8px] text-[var(--color-muted)]">
              Snapshot enables off-chain voting using your DegenFeed token balance. Create a space
              at snapshot.org to get started.
            </div>
          </div>

          {/* ── Tally ── */}
          <div className="rounded-lg border border-[var(--color-glass-border)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-glass-border)] text-sm">
                  📊
                </span>
                <div>
                  <div className="text-xs font-semibold text-[var(--color-fg)]">Tally.xyz</div>
                  <IntegrationBadge
                    connected={integrations.tally.connected}
                    label={integrations.tally.connected ? 'Connected' : 'Not Configured'}
                  />
                </div>
              </div>
              {integrations.tally.connected ? (
                <a
                  href={integrations.tally.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
                >
                  View on Tally ↗
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSyncModal('tally')}
                  className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
                >
                  Connect
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[9px] text-[var(--color-muted)]">
              <div>
                <span className="block font-semibold text-[var(--color-fg)]">Governor</span>
                {integrations.tally.governorAddress
                  ? `${integrations.tally.governorAddress.slice(0, 6)}...${integrations.tally.governorAddress.slice(-4)}`
                  : '—'}
              </div>
              <div>
                <span className="block font-semibold text-[var(--color-fg)]">Verified</span>
                {integrations.tally.verified ? '✅ Yes' : '—'}
              </div>
            </div>
            {integrations.tally.connected && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[var(--color-glass-border)] px-2.5 py-1 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  Check Compatibility
                </button>
              </div>
            )}
            <div className="mt-2 text-[8px] text-[var(--color-muted)]">
              Tally provides a governance UI for on-chain DAOs. Your governor must implement the
              OpenZeppelin Governor interface.
            </div>
          </div>

          {/* ── Realms / SPL Governance ── */}
          <div className="rounded-lg border border-[var(--color-glass-border)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-glass-border)] text-sm">
                  🌐
                </span>
                <div>
                  <div className="text-xs font-semibold text-[var(--color-fg)]">
                    Realms / SPL Governance
                  </div>
                  <IntegrationBadge
                    connected={integrations.realms.connected}
                    label={integrations.realms.connected ? 'Connected' : 'Not Configured'}
                  />
                </div>
              </div>
              {integrations.realms.connected ? (
                <a
                  href={integrations.realms.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
                >
                  View on Realms ↗
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSyncModal('realms')}
                  className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
                >
                  Connect
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[9px] text-[var(--color-muted)]">
              <div>
                <span className="block font-semibold text-[var(--color-fg)]">Realm ID</span>
                {integrations.realms.realmId
                  ? `${integrations.realms.realmId.slice(0, 8)}...`
                  : '—'}
              </div>
            </div>
            {integrations.realms.connected && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[var(--color-glass-border)] px-2.5 py-1 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                >
                  Bridge Proposals
                </button>
              </div>
            )}
            <div className="mt-2 text-[8px] text-[var(--color-muted)]">
              For Solana DAOs. Manage your DAO via Realms, the leading Solana governance interface.
            </div>
          </div>

          {/* ── OpenZeppelin Defender ── */}
          <div className="rounded-lg border border-[var(--color-glass-border)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-glass-border)] text-sm">
                  🛡️
                </span>
                <div>
                  <div className="text-xs font-semibold text-[var(--color-fg)]">
                    OpenZeppelin Defender
                  </div>
                  <IntegrationBadge
                    connected={integrations.defender.connected}
                    label={integrations.defender.connected ? 'Active' : 'Not Configured'}
                  />
                </div>
              </div>
              <a
                href={integrations.defender.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
              >
                Open Defender ↗
              </a>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[9px] text-[var(--color-muted)]">
              <div>
                <span className="block font-semibold text-[var(--color-fg)]">Autotask</span>
                {integrations.defender.autotaskConfigured ? '✅ Active' : '❌ Inactive'}
              </div>
              <div>
                <span className="block font-semibold text-[var(--color-fg)]">Sentinel</span>
                {integrations.defender.sentinelConfigured ? '✅ Active' : '❌ Inactive'}
              </div>
              <div>
                <span className="block font-semibold text-[var(--color-fg)]">Relay</span>
                {integrations.defender.relayConfigured ? '✅ Active' : '❌ Inactive'}
              </div>
            </div>
            {!integrations.defender.connected && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowSyncModal('defender')}
                  className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
                >
                  Setup Defender
                </button>
              </div>
            )}
            <div className="mt-2 text-[8px] text-[var(--color-muted)]">
              Auto-execute passed proposals, monitor for suspicious activity, and manage upgrades.
            </div>
          </div>

          {/* ── Delegate Registry ── */}
          <div className="rounded-lg border border-[var(--color-glass-border)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-glass-border)] text-sm">
                  📝
                </span>
                <div>
                  <div className="text-xs font-semibold text-[var(--color-fg)]">
                    Snapshot Delegate Registry
                  </div>
                  <IntegrationBadge
                    connected={integrations.delegateRegistry.connected}
                    label={
                      integrations.delegateRegistry.connected ? 'Registered' : 'Not Registered'
                    }
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal('delegate')}
                className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
              >
                {integrations.delegateRegistry.connected ? 'Sync Delegates' : 'Register'}
              </button>
            </div>
            <div className="text-[9px] text-[var(--color-muted)]">
              The Snapshot Delegate Registry allows token holders to delegate voting power without
              transferring tokens.
            </div>
            <div className="mt-2 text-[8px] text-[var(--color-muted)]">
              Registry contract: 0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446
            </div>
          </div>
        </div>

        {/* ── Integration Setup Modal ── */}
        {showSyncModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Integration Setup"
          >
            <div className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card-elevated)] p-6 shadow-xl">
              {/* Snapshot */}
              {showSyncModal === 'snapshot' && (
                <>
                  <div className="mb-2 text-2xl">🗳️</div>
                  <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">
                    Connect Snapshot Space
                  </h3>
                  <p className="mb-4 text-xs text-[var(--color-muted)]">
                    Enter your Snapshot space ENS or ID. Make sure your DAO deployer wallet is an
                    admin of the space.
                  </p>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)]">
                      Snapshot Space ID
                    </label>
                    <input
                      type="text"
                      value={snapshotSpaceInput}
                      onChange={(e) => setSnapshotSpaceInput(e.target.value)}
                      placeholder="degendao.eth"
                      className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm font-mono text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
                    />
                  </div>
                  <div className="rounded-lg bg-[var(--color-glass-border)] p-3 mb-4">
                    <p className="text-[9px] font-semibold text-[var(--color-fg)] mb-1">
                      Quick Setup
                    </p>
                    <ol className="list-decimal list-inside text-[9px] text-[var(--color-muted)] space-y-1">
                      <li>Go to snapshot.org/#/setup to create a space</li>
                      <li>Use the generated strategy JSON from the API</li>
                      <li>Set your DAO token as the voting power source</li>
                      <li>Add your wallet as a space admin</li>
                    </ol>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSyncModal(null)}
                      className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIntegrations((prev) => ({
                          ...prev,
                          snapshot: {
                            ...prev.snapshot,
                            connected: true,
                            spaceId: snapshotSpaceInput,
                            url: `https://snapshot.org/#/${snapshotSpaceInput}`,
                          },
                        }));
                        setShowSyncModal(null);
                      }}
                      className="flex-1 rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 active:scale-95"
                    >
                      Connect Space
                    </button>
                  </div>
                </>
              )}

              {/* Tally */}
              {showSyncModal === 'tally' && (
                <>
                  <div className="mb-2 text-2xl">📊</div>
                  <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">
                    Register on Tally
                  </h3>
                  <p className="mb-4 text-xs text-[var(--color-muted)]">
                    Enter your DegenFeedGovernor contract address. We&apos;ll check compatibility
                    with Tally&apos;s expected interface.
                  </p>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)]">
                      Governor Address
                    </label>
                    <input
                      type="text"
                      value={governorAddressInput}
                      onChange={(e) => setGovernorAddressInput(e.target.value)}
                      placeholder="0x..."
                      className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm font-mono text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
                    />
                  </div>
                  <div className="rounded-lg bg-[var(--color-glass-border)] p-3 mb-4">
                    <p className="text-[9px] font-semibold text-[var(--color-fg)] mb-1">
                      Compatibility Checklist
                    </p>
                    <ul className="text-[9px] text-[var(--color-muted)] space-y-1">
                      <li>✅ Implements OZ Governor interface</li>
                      <li>✅ Emits ProposalCreated event</li>
                      <li>✅ Emits VoteCast event</li>
                      <li>✅ Contract verified on block explorer</li>
                    </ul>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSyncModal(null)}
                      className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIntegrations((prev) => ({
                          ...prev,
                          tally: {
                            ...prev.tally,
                            connected: true,
                            governorAddress: governorAddressInput,
                            url: `https://tally.xyz/gov/${governorAddressInput}`,
                            verified: true,
                          },
                        }));
                        setShowSyncModal(null);
                      }}
                      className="flex-1 rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 active:scale-95"
                    >
                      Check &amp; Register
                    </button>
                  </div>
                </>
              )}

              {/* Realms */}
              {showSyncModal === 'realms' && (
                <>
                  <div className="mb-2 text-2xl">🌐</div>
                  <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">
                    Connect Realms Realm
                  </h3>
                  <p className="mb-4 text-xs text-[var(--color-muted)]">
                    Enter your Realm ID (Solana pubkey) to pair with your DegenFeed Solana DAO.
                  </p>
                  <div className="mb-4">
                    <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)]">
                      Realm ID
                    </label>
                    <input
                      type="text"
                      value={realmIdInput}
                      onChange={(e) => setRealmIdInput(e.target.value)}
                      placeholder="Realm public key..."
                      className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm font-mono text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
                    />
                  </div>
                  <div className="rounded-lg bg-[var(--color-glass-border)] p-3 mb-4">
                    <p className="text-[9px] font-semibold text-[var(--color-fg)] mb-1">
                      SPL Governance Setup
                    </p>
                    <ol className="list-decimal list-inside text-[9px] text-[var(--color-muted)] space-y-1">
                      <li>Visit realms.today/dao/create</li>
                      <li>Use your SPL token as community mint</li>
                      <li>Configure voting parameters</li>
                      <li>Note the realm ID and link it here</li>
                    </ol>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSyncModal(null)}
                      className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIntegrations((prev) => ({
                          ...prev,
                          realms: {
                            ...prev.realms,
                            connected: true,
                            realmId: realmIdInput,
                            url: `https://realms.today/dao/${realmIdInput}`,
                          },
                        }));
                        setShowSyncModal(null);
                      }}
                      className="flex-1 rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 active:scale-95"
                    >
                      Link Realm
                    </button>
                  </div>
                </>
              )}

              {/* Defender */}
              {showSyncModal === 'defender' && (
                <>
                  <div className="mb-2 text-2xl">🛡️</div>
                  <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">
                    Setup OpenZeppelin Defender
                  </h3>
                  <p className="mb-4 text-xs text-[var(--color-muted)]">
                    Configure Autotasks, Sentinels, and Relays for your DAO.
                  </p>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] p-2.5">
                      <div>
                        <div className="text-[10px] font-semibold text-[var(--color-fg)]">
                          🤖 Proposal Executor
                        </div>
                        <div className="text-[8px] text-[var(--color-muted)]">
                          Auto-executes passed proposals
                        </div>
                      </div>
                      <span className="text-[8px] text-amber-400">Needs setup</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] p-2.5">
                      <div>
                        <div className="text-[10px] font-semibold text-[var(--color-fg)]">
                          👁️ Proposal Monitor
                        </div>
                        <div className="text-[8px] text-[var(--color-muted)]">
                          Detects suspicious proposals
                        </div>
                      </div>
                      <span className="text-[8px] text-amber-400">Needs setup</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] p-2.5">
                      <div>
                        <div className="text-[10px] font-semibold text-[var(--color-fg)]">
                          ⛽ Gas Relay
                        </div>
                        <div className="text-[8px] text-[var(--color-muted)]">
                          Gas-optimized tx submission
                        </div>
                      </div>
                      <span className="text-[8px] text-amber-400">Needs setup</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[var(--color-glass-border)] p-3 mb-4">
                    <p className="text-[9px] font-semibold text-[var(--color-fg)] mb-1">
                      Setup Instructions
                    </p>
                    <ol className="list-decimal list-inside text-[9px] text-[var(--color-muted)] space-y-1">
                      <li>Go to defender.openzeppelin.com</li>
                      <li>Create a Relayer on your network</li>
                      <li>Create the Proposal Executor Autotask</li>
                      <li>Create a Sentinel monitoring your Governor</li>
                      <li>Sync the IDs below using the API</li>
                    </ol>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSyncModal(null)}
                      className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIntegrations((prev) => ({
                          ...prev,
                          defender: { ...prev.defender, connected: true },
                        }));
                        setShowSyncModal(null);
                      }}
                      className="flex-1 rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 active:scale-95"
                    >
                      Enable Defender
                    </button>
                  </div>
                </>
              )}

              {/* Delegate Registry */}
              {showSyncModal === 'delegate' && (
                <>
                  <div className="mb-2 text-2xl">📝</div>
                  <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">
                    Snapshot Delegate Registry
                  </h3>
                  <p className="mb-4 text-xs text-[var(--color-muted)]">
                    Register your DAO with the Snapshot Delegate Registry so token holders can
                    delegate voting power without transferring tokens.
                  </p>
                  <div className="rounded-lg bg-[var(--color-glass-border)] p-3 mb-4">
                    <p className="text-[9px] text-[var(--color-muted)] leading-relaxed">
                      The Delegate Registry at{' '}
                      <code className="text-degen-400 font-mono text-[8px]">
                        0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446
                      </code>{' '}
                      enables off-chain delegation tracking. Your DAO token holders can delegate to
                      any address, and Snapshot will use this for voting power calculation.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSyncModal(null)}
                      className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIntegrations((prev) => ({
                          ...prev,
                          delegateRegistry: {
                            ...prev.delegateRegistry,
                            connected: true,
                            registered: true,
                          },
                        }));
                        setShowSyncModal(null);
                      }}
                      className="flex-1 rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 active:scale-95"
                    >
                      Register on Delegate Registry
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </SettingsSection>
    );
  };

  // ─── Danger Zone ─────────────────────────────────────────────────

  const DangerSection = () => (
    <SettingsSection
      title="Danger Zone"
      description="Irreversible actions that affect the entire DAO."
      danger
    >
      <div className="space-y-3">
        {/* Pause DAO */}
        <div className="flex items-center justify-between rounded-lg border border-red-500/10 p-3">
          <div>
            <div className="text-xs font-semibold text-[var(--color-fg)]">Pause DAO</div>
            <p className="text-[9px] text-[var(--color-muted)]">
              Temporarily pause all proposals and voting
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDangerConfirm('pause')}
            className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            Pause
          </button>
        </div>

        {/* Transfer Ownership */}
        <div className="flex items-center justify-between rounded-lg border border-red-500/10 p-3">
          <div>
            <div className="text-xs font-semibold text-[var(--color-fg)]">Transfer Ownership</div>
            <p className="text-[9px] text-[var(--color-muted)]">
              Transfer DAO ownership to another address
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDangerConfirm('transfer')}
            className="rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Transfer
          </button>
        </div>

        {/* Emergency Shutdown */}
        <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 p-3">
          <div>
            <div className="text-xs font-semibold text-red-400">Emergency Shutdown</div>
            <p className="text-[9px] text-[var(--color-muted)]">
              Irreversibly shutdown the DAO and return all treasury funds
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDangerConfirm('shutdown')}
            className="rounded-lg bg-red-500 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-red-600 transition-colors"
          >
            Shutdown
          </button>
        </div>
      </div>
    </SettingsSection>
  );

  // ─── Danger Confirm Modal ────────────────────────────────────────

  const DangerConfirmModal = () => {
    if (!showDangerConfirm) return null;

    const DANGER_ACTIONS: Record<
      string,
      { title: string; description: string; confirmText: string; isSevere: boolean }
    > = {
      pause: {
        title: 'Pause DAO',
        description:
          'This will pause all proposals and voting. Active proposals will be frozen. You can resume later.',
        confirmText: 'Type "PAUSE" to confirm',
        isSevere: false,
      },
      transfer: {
        title: 'Transfer Ownership',
        description:
          'This will transfer DAO ownership to another address. This action cannot be undone.',
        confirmText: 'Type the new owner address to confirm',
        isSevere: true,
      },
      shutdown: {
        title: 'Emergency Shutdown',
        description:
          'This will irreversibly shutdown the DAO. All treasury funds will be returned to members proportionally. THIS CANNOT BE UNDONE.',
        confirmText: 'Type "SHUTDOWN" to confirm',
        isSevere: true,
      },
    };

    const d = DANGER_ACTIONS[showDangerConfirm];
    if (!d) return null;
    const [confirmInput, setConfirmInput] = useState('');

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={d.title}
      >
        <div className="mx-4 w-full max-w-md rounded-2xl border border-red-500/30 bg-[var(--color-card-elevated)] p-6 shadow-xl">
          <div className="mb-2 text-3xl">⚠️</div>
          <h3 className="mb-2 text-base font-bold text-red-400">{d.title}</h3>
          <p className="mb-4 text-xs text-[var(--color-muted)] leading-relaxed">{d.description}</p>

          <div className="mb-4">
            <label
              htmlFor="danger-confirm"
              className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)]"
            >
              {d.confirmText}
            </label>
            <input
              id="danger-confirm"
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={d.confirmText}
              className="w-full rounded-xl border border-red-500/30 bg-[var(--color-bg-tertiary)] px-4 py-2.5 text-sm font-mono text-[var(--color-fg)] outline-none focus:border-red-500 transition-colors"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowDangerConfirm(null)}
              className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                confirmInput !==
                (d.isSevere
                  ? showDangerConfirm === 'shutdown'
                    ? 'SHUTDOWN'
                    : showDangerConfirm === 'transfer'
                      ? '0x'
                      : 'PAUSE'
                  : 'PAUSE')
              }
              onClick={() => {
                alert(`✅ ${d.title} action submitted (mock).`);
                setShowDangerConfirm(null);
              }}
              className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              Confirm {d.title}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 animate-page-enter">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href={`/dao/${params.id}`} className="hover:text-degen-400 transition-colors">
          DAO
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
        <span className="text-[var(--color-fg)]">Settings</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-[28px] font-black text-[var(--color-fg)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            DAO Settings
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Manage your DAO&apos;s configuration, governance, and team.
          </p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-sm font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 active:scale-95"
        >
          Save Changes
        </button>
      </div>

      <div className="space-y-6">
        <ProfileSection />
        <SocialSection />
        <GovernanceSection />
        <TreasurySection />
        <AppearanceSection />
        <IntegrationsSection />
        <DangerSection />
      </div>

      {/* Danger Confirm Modal */}
      {showDangerConfirm && <DangerConfirmModal />}

      {/* Bottom Save */}
      <div className="mt-8 flex items-center justify-between border-t border-[var(--color-glass-border)] pt-6">
        <p className="text-[10px] text-[var(--color-muted)]">
          Changes are saved locally. Click save to persist all changes.
        </p>
        <button
          type="button"
          className="rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 px-6 py-2.5 text-sm font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 active:scale-95"
        >
          Save All Changes
        </button>
      </div>
    </div>
  );
}
