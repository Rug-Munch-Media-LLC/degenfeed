'use client';

/**
 * /profile/data — Data Ownership & Portability Page
 *
 * Shows users exactly what data DegenFeed stores, lets them download it,
 * export portable credentials, and delete their account.
 */

import { ErrorBoundary } from '@degenfeed/ui';
import { DataSection, SectionSkeleton } from './components';
import { DATA_CATEGORIES, HOSTED_INSTANCES } from './constants';
import { useDataPage } from './data-operations';

export default function DataPage() {
  const {
    primaryIdentity,
    displayName,
    hasIdentities,
    exportState,
    credExportState,
    deleteState,
    dataStats,
    loadingStats,
    setDeleteState,
    handleExportAll,
    handleExportCredentials,
    handleDeleteAccount,
    handleExportCategory,
  } = useDataPage();

  const isExporting = exportState.status === 'collecting' || exportState.status === 'downloading';
  const isCredExporting =
    credExportState.status === 'preparing' || credExportState.status === 'downloading';

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-24 sm:pb-6">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/30 via-purple-500/20 to-fuchsia-500/30">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-degen-400"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-fg)]">Your Data</h1>
              <p className="text-sm text-[var(--color-muted)]">
                You own it. DegenFeed hosts it. You control it.
              </p>
            </div>
          </div>

          {/* Ownership Banner */}
          <div className="rounded-2xl border border-degen-500/20 bg-gradient-to-r from-degen-500/[0.05] via-purple-500/[0.03] to-transparent px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-degen-500/10">
                <span className="text-lg">🔐</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-fg)]">
                  You own your data. Always.
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
                  DegenFeed is built on the principle of data sovereignty. Your posts, follows,
                  bookmarks, and preferences belong to <strong>you</strong> — not us. We host this
                  data to provide the service, but you can export it at any time, take it to another
                  app, or delete it all. No lock-in, no fine print.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Data Summary */}
        <DataSection
          title="What DegenFeed Stores"
          subtitle={`${primaryIdentity ? displayName : 'You'} have data across ${hasIdentities ? 'your connected accounts' : 'your account'}`}
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        >
          {loadingStats ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-16 skeleton rounded-xl" />
              ))}
            </div>
          ) : dataStats ? (
            <div className="grid grid-cols-3 gap-2">
              {DATA_CATEGORIES.map((cat) => {
                const count = dataStats[cat.key] ?? 0;
                return (
                  <div
                    key={cat.key}
                    className="flex flex-col items-center rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2.5"
                  >
                    <span className="text-lg font-bold tabular-nums text-[var(--color-fg)]">
                      {count}
                    </span>
                    <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] text-center">
                      {cat.label.length > 12 ? `${cat.label.slice(0, 12)}…` : cat.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-muted)] text-center py-2">
              Unable to load data summary
            </p>
          )}
        </DataSection>

        {/* Export Section */}
        <div className="mb-6 space-y-4">
          <DataSection
            title="Export Your Data"
            subtitle="Download everything or pick specific categories"
            icon="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
          >
            <div className="mb-4">
              <button
                type="button"
                onClick={handleExportAll}
                disabled={isExporting}
                className="w-full rounded-xl bg-gradient-to-r from-degen-500 to-purple-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-degen-500/20 hover:shadow-degen-500/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {exportState.status === 'collecting' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />{' '}
                    Collecting your data…
                  </span>
                ) : exportState.status === 'downloading' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />{' '}
                    Downloading…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Download All My Data (JSON)
                  </span>
                )}
              </button>
              {exportState.status === 'error' && (
                <p className="mt-2 text-xs text-red-400">{exportState.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--color-muted)] mb-2">
                Download individual categories:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {DATA_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleExportCategory(cat.key)}
                    disabled={isExporting}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3.5 py-2.5 text-left text-xs text-[var(--color-fg)] hover:border-degen-500/30 hover:bg-degen-500/5 transition-all disabled:opacity-50"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 text-degen-400"
                      aria-hidden="true"
                    >
                      <path d={cat.icon} />
                    </svg>
                    <span className="truncate">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </DataSection>
        </div>

        {/* Portable Credentials */}
        <div className="mb-6 space-y-4">
          <DataSection
            title="Portable Credentials"
            subtitle="Your accounts work anywhere — download credentials for use on other apps"
            icon="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
          >
            <div className="rounded-xl border border-degen-500/20 bg-degen-500/[0.03] px-4 py-3 mb-4">
              <div className="flex items-start gap-2.5">
                <span className="text-lg shrink-0">🔑</span>
                <div>
                  <p className="text-sm font-medium text-[var(--color-fg)]">
                    Your accounts on DegenFeed-hosted instances are fully portable
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)] leading-relaxed">
                    Use these credentials on any compatible app — Mastodon clients, Nostr apps,
                    Bluesky clients, and more. No lock-in, ever.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportCredentials}
              disabled={isCredExporting}
              className="w-full rounded-xl border-2 border-degen-500/30 bg-degen-500/10 px-5 py-3 text-sm font-bold text-degen-400 hover:bg-degen-500/20 hover:border-degen-500/50 transition-all disabled:opacity-50"
            >
              {credExportState.status === 'preparing' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-400 border-t-transparent" />{' '}
                  Preparing credentials…
                </span>
              ) : credExportState.status === 'downloading' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-degen-400 border-t-transparent" />{' '}
                  Downloading…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Download Portable Credentials
                </span>
              )}
            </button>
            {credExportState.status === 'error' && (
              <p className="mt-2 text-xs text-red-400">{credExportState.message}</p>
            )}
          </DataSection>
        </div>

        {/* Login to Other Platforms */}
        <div className="mb-6">
          <DataSection
            title="Login to Other Platforms"
            subtitle="Use your DegenFeed-instance credentials on any compatible app"
            icon="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          >
            <p className="text-xs text-[var(--color-muted)] mb-4 leading-relaxed">
              DegenFeed hosts decentralized social instances. Your account on each instance works
              with any app that supports that protocol.
            </p>
            <div className="space-y-3">
              {HOSTED_INSTANCES.map((instance) => (
                <div
                  key={instance.platform}
                  className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-4 hover:border-[var(--color-glass-border)]/80 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
                      style={{ backgroundColor: `${instance.color}15`, color: instance.color }}
                    >
                      {instance.platform.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[var(--color-fg)]">
                          {instance.platform}
                        </h3>
                        <a
                          href={instance.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-xs text-degen-400 hover:underline"
                        >
                          {instance.url.replace('https://', '')}
                        </a>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                        {instance.description}
                      </p>
                      <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
                        <span className="font-medium text-[var(--color-fg)]">Compatible apps:</span>{' '}
                        {instance.compatible}
                      </p>
                    </div>
                    <a
                      href={instance.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg bg-[var(--color-glass-border)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] hover:bg-degen-500/20 hover:text-degen-400 transition-colors"
                    >
                      Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </DataSection>
        </div>

        {/* Data Privacy FAQ */}
        <div className="mb-6">
          <DataSection
            title="Data Privacy FAQ"
            subtitle="What we collect, what we don't, and how you stay in control"
            icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
          >
            <div className="space-y-4">
              {[
                {
                  q: 'What data does DegenFeed collect?',
                  a: 'DegenFeed stores only the data you explicitly create: your linked identities (protocol accounts), posts and content you publish, follows, bookmarks, muted users and words, blocked users, and preferences. This data is stored locally in your browser and synced to our servers to provide the service.',
                },
                {
                  q: 'What data does DegenFeed NOT collect?',
                  a: 'We do not collect your browsing history, sell your data to advertisers, track you across websites, store your private keys in plaintext, or access your connected protocol accounts beyond what you explicitly authorize.',
                },
                {
                  q: 'How do I export my data?',
                  a: 'Click the "Download All My Data" button above. You\'ll receive a JSON file containing all your DegenFeed data.',
                },
                {
                  q: 'How do I delete my data?',
                  a: 'Click the "Delete Account" button below. This removes all your data from DegenFeed\'s servers and clears your local storage.',
                },
                {
                  q: 'Can I use my DegenFeed credentials on other apps?',
                  a: 'Absolutely. Your accounts on DegenFeed-hosted instances are standard Mastodon, Lemmy, and PeerTube accounts respectively.',
                },
                {
                  q: 'How are my private keys stored?',
                  a: 'Private keys (like Nostr nsec) are encrypted at rest using AES-256-GCM with a key derived from your passphrase via Argon2id.',
                },
              ].map((faq) => (
                <div
                  key={faq.q}
                  className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3"
                >
                  <h4 className="text-sm font-semibold text-[var(--color-fg)] mb-1">{faq.q}</h4>
                  <p className="text-xs text-[var(--color-muted)] leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </DataSection>
        </div>

        {/* Danger Zone */}
        <div className="mb-6">
          <DataSection
            title="Danger Zone"
            subtitle="Irreversible actions — proceed with caution"
            icon="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          >
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-red-400"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-red-400">Delete Account</h4>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)] leading-relaxed">
                    Permanently remove all your data from DegenFeed. This deletes your identities,
                    bookmarks, follows, preferences, and all stored data.
                  </p>

                  {deleteState.status === 'confirming' ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-red-400">
                        Are you absolutely sure? This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleDeleteAccount}
                          disabled={(deleteState.status as string) === 'deleting'}
                          className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                        >
                          {(deleteState.status as string) === 'deleting' ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />{' '}
                              Deleting…
                            </span>
                          ) : (
                            'Yes, delete everything'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteState({ status: 'idle' })}
                          className="flex-1 rounded-lg bg-[var(--color-overlay)] px-4 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : deleteState.status === 'done' ? (
                    <div className="mt-3 rounded-lg bg-degen-500/10 px-4 py-3">
                      <p className="text-xs font-medium text-degen-400">
                        ✓ Account deleted. Redirecting…
                      </p>
                    </div>
                  ) : deleteState.status === 'error' ? (
                    <div className="mt-3">
                      <p className="text-xs text-red-400">{deleteState.message}</p>
                      <button
                        type="button"
                        onClick={() => setDeleteState({ status: 'idle' })}
                        className="mt-2 rounded-lg bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteState({ status: 'confirming' })}
                      className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      Delete my account
                    </button>
                  )}
                </div>
              </div>
            </div>
          </DataSection>
        </div>

        {/* Footer */}
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-degen-500/10 px-4 py-2">
            <span className="text-sm">🔐</span>
            <span className="text-xs font-medium text-degen-400">
              You own your data. Always have, always will.
            </span>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
