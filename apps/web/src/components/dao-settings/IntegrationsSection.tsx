'use client';

import { useState } from 'react';
import { SettingsSection } from './SettingsSection';

function IntegrationBadge({ connected, label }: { connected: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
        connected ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-amber-400'}`} />
      {label}
    </span>
  );
}

export function IntegrationsSection() {
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

  const [showModal, setShowModal] = useState<string | null>(null);
  const [snapshotSpaceInput, setSnapshotSpaceInput] = useState('');
  const [governorAddressInput, setGovernorAddressInput] = useState('');
  const [realmIdInput, setRealmIdInput] = useState('');

  return (
    <SettingsSection
      title="External Integrations"
      description="Connect your DAO with the broader DAO ecosystem — Snapshot, Tally, Realms, and OpenZeppelin Defender."
    >
      <div className="space-y-4">
        {/* Snapshot */}
        <div className="rounded-lg border border-[var(--color-glass-border)] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-glass-border)] text-sm">
                🗳️
              </span>
              <div>
                <div className="text-xs font-semibold text-[var(--color-fg)]">Snapshot.org</div>
                <IntegrationBadge
                  connected={integrations.snapshot.connected}
                  label={integrations.snapshot.connected ? 'Connected' : 'Not Configured'}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowModal('snapshot')}
              className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
            >
              Connect
            </button>
          </div>
          <div className="text-[8px] text-[var(--color-muted)]">
            Snapshot enables off-chain voting using your DegenFeed token balance.
          </div>
        </div>

        {/* Tally */}
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
            <button
              type="button"
              onClick={() => setShowModal('tally')}
              className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
            >
              Connect
            </button>
          </div>
          <div className="text-[8px] text-[var(--color-muted)]">
            Tally provides a governance UI for on-chain DAOs.
          </div>
        </div>

        {/* Realms */}
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
            <button
              type="button"
              onClick={() => setShowModal('realms')}
              className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
            >
              Connect
            </button>
          </div>
          <div className="text-[8px] text-[var(--color-muted)]">
            For Solana DAOs. Manage your DAO via Realms.
          </div>
        </div>

        {/* OpenZeppelin Defender */}
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
            <button
              type="button"
              onClick={() => setShowModal('defender')}
              className="rounded-lg bg-degen-500/10 px-2.5 py-1.5 text-[9px] font-semibold text-degen-400 hover:bg-degen-500/20 transition-colors"
            >
              Setup
            </button>
          </div>
          <div className="text-[8px] text-[var(--color-muted)]">
            Auto-execute passed proposals, monitor for suspicious activity.
          </div>
        </div>
      </div>

      {/* Setup Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-4 w-full max-w-md rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card-elevated)] p-6 shadow-xl">
            {showModal === 'snapshot' && (
              <>
                <div className="mb-2 text-2xl">🗳️</div>
                <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">
                  Connect Snapshot Space
                </h3>
                <p className="mb-4 text-xs text-[var(--color-muted)]">
                  Enter your Snapshot space ENS or ID.
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
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(null)}
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
                        },
                      }));
                      setShowModal(null);
                    }}
                    className="flex-1 rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 active:scale-95"
                  >
                    Connect Space
                  </button>
                </div>
              </>
            )}
            {showModal === 'tally' && (
              <>
                <div className="mb-2 text-2xl">📊</div>
                <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">
                  Register on Tally
                </h3>
                <p className="mb-4 text-xs text-[var(--color-muted)]">
                  Enter your DegenFeedGovernor contract address.
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
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(null)}
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
                        },
                      }));
                      setShowModal(null);
                    }}
                    className="flex-1 rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 active:scale-95"
                  >
                    Check & Register
                  </button>
                </div>
              </>
            )}
            {showModal === 'realms' && (
              <>
                <div className="mb-2 text-2xl">🌐</div>
                <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">
                  Connect Realms Realm
                </h3>
                <p className="mb-4 text-xs text-[var(--color-muted)]">
                  Enter your Realm ID (Solana pubkey).
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
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(null)}
                    className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIntegrations((prev) => ({
                        ...prev,
                        realms: { ...prev.realms, connected: true, realmId: realmIdInput },
                      }));
                      setShowModal(null);
                    }}
                    className="flex-1 rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 active:scale-95"
                  >
                    Link Realm
                  </button>
                </div>
              </>
            )}
            {showModal === 'defender' && (
              <>
                <div className="mb-2 text-2xl">🛡️</div>
                <h3 className="mb-2 text-base font-bold text-[var(--color-fg)]">
                  Setup OpenZeppelin Defender
                </h3>
                <p className="mb-4 text-xs text-[var(--color-muted)]">
                  Configure Autotasks, Sentinels, and Relays for your DAO.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(null)}
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
                      setShowModal(null);
                    }}
                    className="flex-1 rounded-xl bg-degen-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-degen-400 active:scale-95"
                  >
                    Enable Defender
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
