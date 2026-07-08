'use client';

import type { StoredIdentity } from '@degenfeed/storage';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { IdentityLinker } from '../../components/IdentityLinker';
import { useWeb3 } from '../../components/Web3Provider';

export const dynamic = 'force-dynamic';

interface ResolvedIdentity {
  id: string;
  protocol: string;
  displayName?: string;
  handle?: string;
  avatarUrl?: string;
  address?: string;
  color: string;
  isPrimary: boolean;
}

const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  threads: '#888888',
  mastodon: '#6364ff',
  ethereum: '#627eea',
  solana: '#9945ff',
};

const PROTOCOL_ICONS: Record<string, string> = {
  nostr: '☰',
  farcaster: '◈',
  lens: '◎',
  bluesky: '☁',
  threads: '⊞',
  mastodon: '🐘',
  ethereum: '◆',
  solana: '◎',
};

const ALL_NETWORKS = [
  { id: 'mastodon', label: 'Mastodon / GotoSocial', desc: 'your @degenfeed.xyz handle' },
  { id: 'nostr', label: 'Nostr', desc: 'decentralized notes' },
  { id: 'bluesky', label: 'Bluesky', desc: 'AT Protocol' },
  { id: 'lens', label: 'Lens', desc: 'Lens Protocol' },
  { id: 'farcaster', label: 'Farcaster', desc: 'Farcaster Hub' },
  { id: 'threads', label: 'Threads', desc: 'Meta Threads' },
];

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function toResolved(identity: StoredIdentity): ResolvedIdentity {
  const isWallet = identity.protocol === 'ethereum' || identity.protocol === 'solana';
  return {
    id: identity.id,
    protocol: identity.protocol,
    displayName: identity.displayName,
    handle: identity.handle,
    avatarUrl: identity.avatarUrl,
    address: isWallet ? identity.publicId : undefined,
    color: PROTOCOL_COLORS[identity.protocol] ?? '#666',
    isPrimary: identity.isPrimary,
  };
}

export default function ProfilePage() {
  const {
    primaryIdentity,
    linkedIdentities,
    ready,
    openSignIn,
    setPrimaryIdentity: setPrimary,
    unlinkIdentity: unlink,
    linkGtsUrl,
    isWalletOnly,
  } = useAuth();
  const { isConnected } = useWeb3();

  const identities = useMemo(() => {
    const list: ResolvedIdentity[] = [];
    if (primaryIdentity) list.push(toResolved(primaryIdentity));
    for (const identity of linkedIdentities) list.push(toResolved(identity));
    return list;
  }, [primaryIdentity, linkedIdentities]);

  const hasSignedIn = identities.length > 0 || isConnected;

  const primaryIsWallet =
    primaryIdentity?.protocol === 'ethereum' || primaryIdentity?.protocol === 'solana';

  if (!ready) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center text-gray-500">
        <div className="mx-auto mb-4 h-2 w-32 animate-pulse rounded-full bg-gray-800" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="card mb-8 py-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/30 via-purple-500/30 to-fuchsia-500/30 text-3xl font-bold text-white shadow-[0_0_30px_rgba(34,197,94,0.2)]">
          {primaryIdentity?.displayName ? primaryIdentity.displayName.charAt(0).toUpperCase() : '?'}
        </div>
        <h1 className="text-2xl font-bold text-white">
          {primaryIdentity?.displayName ?? 'DegenFeed User'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {hasSignedIn
            ? `${identities.length} connection${identities.length !== 1 ? 's' : ''}`
            : 'No accounts connected'}
        </p>
      </div>

      {!hasSignedIn ? (
        <div className="card py-12 text-center">
          <div className="mb-4 text-4xl text-gray-600">?</div>
          <p className="mb-4 text-gray-500">Connect accounts to build your unified identity</p>
          <button onClick={openSignIn} className="btn-primary text-sm" type="button">
            Connect an account
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-500">
              Connected Identities
            </h2>
            <div className="space-y-2">
              {identities.map((id) => (
                <div key={id.id} className="card-hover flex items-center gap-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                    style={{ backgroundColor: `${id.color}22`, color: id.color }}
                  >
                    {id.avatarUrl ? (
                      <Image
                        src={id.avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      PROTOCOL_ICONS[id.protocol] || '?'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white truncate">
                        {id.displayName || id.protocol}
                      </span>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: `${id.color}22`, color: id.color }}
                      >
                        {id.protocol}
                      </span>
                      {id.isPrimary && (
                        <span className="shrink-0 rounded-full bg-degen-500/20 px-2 py-0.5 text-xs font-medium text-degen-400">
                          Primary
                        </span>
                      )}
                    </div>
                    {id.address ? (
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-gray-400 font-mono">
                          {shortenAddress(id.address)}
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(id.address ?? '')}
                          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                          type="button"
                        >
                          copy
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 truncate">{id.handle || ''}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {!id.isPrimary &&
                      (!primaryIsWallet ||
                        id.protocol === 'ethereum' ||
                        id.protocol === 'solana') && (
                        <>
                          <button
                            onClick={() => setPrimary(id.id)}
                            className="rounded-lg bg-gray-800 px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                            type="button"
                          >
                            Set primary
                          </button>
                          <button
                            onClick={() => unlink(id.id)}
                            className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                            type="button"
                          >
                            Unlink
                          </button>
                        </>
                      )}
                    {!id.isPrimary &&
                      primaryIsWallet &&
                      id.protocol !== 'ethereum' &&
                      id.protocol !== 'solana' && (
                        <button
                          onClick={() => unlink(id.id)}
                          className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                          type="button"
                        >
                          Unlink
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>

            {linkGtsUrl && !identities.some((i) => i.protocol === 'mastodon') && (
              <a
                href={linkGtsUrl}
                className="card-hover mt-3 flex w-full items-center justify-center gap-2 border-degen-500/30 bg-degen-500/10 px-4 py-3 text-sm font-semibold text-degen-400 hover:bg-degen-500/20"
              >
                <span>✦</span>
                Link @degenfeed.xyz account
              </a>
            )}

            {isWalletOnly && (
              <p className="mt-3 text-center text-xs text-gray-500">
                Your wallet is your primary identity. Link a social account to cross-post.
              </p>
            )}

            <div className="mt-4">
              <IdentityLinker onSignIn={openSignIn} />
            </div>

            {/* Cross-network posting status */}
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-500">
                Cross-Network Posting
              </h2>
              <div className="card space-y-2 p-4">
                {ALL_NETWORKS.map((n) => {
                  const linked = !!identities.find((i) => i.protocol === n.id);
                  return (
                    <div key={n.id} className="flex items-center gap-3">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${linked ? 'bg-degen-400 shadow-[0_0_4px_rgba(34,197,94,0.5)]' : 'bg-gray-700'}`}
                      />
                      <div className="flex-1">
                        <span
                          className={`text-sm ${linked ? 'font-medium text-white' : 'text-gray-500'}`}
                        >
                          {n.label}
                        </span>
                        <span className="ml-2 text-[10px] text-gray-600">{n.desc}</span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${linked ? 'bg-degen-500/15 text-degen-400' : 'bg-gray-800 text-gray-600'}`}
                      >
                        {linked ? 'Active' : 'Not linked'}
                      </span>
                    </div>
                  );
                })}
                {!identities.length && (
                  <p className="text-xs text-gray-500">
                    Link accounts to cross-post across all networks.
                  </p>
                )}
              </div>
            </div>

            {/* Mastodon profile card */}
            {(() => {
              const mastoId = identities.find((i) => i.protocol === 'mastodon');
              if (!mastoId) return null;
              return (
                <div className="mt-6">
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-500">
                    Mastodon Profile
                  </h2>
                  <div className="card border-degen-500/20 bg-gradient-to-br from-degen-500/5 to-transparent p-4">
                    <div className="flex items-center gap-4">
                      <Image
                        src={mastoId.avatarUrl || '/icon.svg'}
                        alt=""
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-xl object-cover"
                        unoptimized
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold text-white">
                          {mastoId.displayName || mastoId.handle}
                        </div>
                        {mastoId.handle && (
                          <div className="mt-0.5 text-xs font-mono text-degen-400">
                            @{mastoId.handle}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                      <a
                        href={`https://social.degenfeed.xyz/@${mastoId.handle}`}
                        target="_blank"
                        rel="noopener"
                        className="rounded-lg border border-white/10 px-3 py-1.5 transition-colors hover:border-degen-500/30 hover:text-white"
                      >
                        View Profile →
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(mastoId.handle || '')}
                        className="rounded-lg border border-white/10 px-3 py-1.5 transition-colors hover:border-degen-500/30 hover:text-white"
                      >
                        Copy Handle
                      </button>
                      {mastoId.handle && (
                        <button
                          onClick={() => unlink(mastoId.id)}
                          className="ml-auto rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-red-400 transition-colors hover:bg-red-500/20"
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="mb-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-500">
              Creator Tools
            </h2>
            <div className="card border-degen-500/20 bg-degen-500/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-degen-400">Tips Dashboard</div>
                  <div className="text-2xl font-bold text-white">$0.00</div>
                  <div className="text-[10px] text-gray-500">Estimated total tips received</div>
                </div>
                {(() => {
                  const tipAddr = identities.find((i) => i.address)?.address;
                  if (!tipAddr || typeof window === 'undefined') return null;
                  const tipUrl = tipAddr.startsWith('0x')
                    ? `ethereum:${tipAddr}`
                    : `solana:${tipAddr}`;
                  return (
                    <div className="rounded-lg bg-white p-1.5 shadow-sm">
                      <QRCodeSVG value={tipUrl} size={64} />
                    </div>
                  );
                })()}
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href="/profile/monetization"
                  className="rounded-lg bg-degen-500/20 px-3 py-1.5 text-xs font-medium text-degen-400 hover:bg-degen-500/30 transition-colors"
                >
                  Monetization settings
                </a>
                <a
                  href="/profile/monetization"
                  className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  Set up tipping
                </a>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-500">
              Receive Tips
            </h2>
            <div className="space-y-3">
              {(() => {
                const tipAddr = identities.find((i) => i.address)?.address;
                if (!tipAddr || typeof window === 'undefined') return null;
                const tipUrl = tipAddr.startsWith('0x')
                  ? `ethereum:${tipAddr}`
                  : `solana:${tipAddr}`;
                return (
                  <div className="card flex flex-col items-center border-degen-500/20 bg-degen-500/5 p-4">
                    <h3 className="mb-2 text-xs font-semibold text-degen-400">Scan to Tip</h3>
                    <div className="mb-2 rounded-xl bg-white p-3 shadow-lg">
                      <QRCodeSVG value={tipUrl} size={140} />
                    </div>
                    <p className="text-[10px] text-gray-500 text-center">
                      Scan with any wallet app to send crypto
                    </p>
                  </div>
                );
              })()}

              {identities.filter((i) => i.address).length > 0 && (
                <div className="card border-degen-500/20 bg-degen-500/5 p-4">
                  <h3 className="mb-2 text-xs font-semibold text-degen-400">Direct Crypto</h3>
                  <p className="mb-3 text-xs text-gray-400">
                    Anyone can send you tips on these chains — no DegenFeed account needed.
                  </p>
                  {identities
                    .filter((i) => i.address)
                    .map((id) => (
                      <div
                        key={`${id.protocol}-${id.address}`}
                        className="card-hover mb-2 flex items-center justify-between !bg-gray-900/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="hidden sm:block rounded-lg bg-white p-1 shadow-sm">
                            {typeof window !== 'undefined' && (
                              <QRCodeSVG
                                value={
                                  (id.address || '').startsWith('0x')
                                    ? `ethereum:${id.address}`
                                    : `solana:${id.address}`
                                }
                                size={40}
                              />
                            )}
                          </div>
                          <span style={{ color: id.color }}>{PROTOCOL_ICONS[id.protocol]}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white">
                              {id.protocol === 'ethereum' ? 'EVM Chain' : 'Solana'}
                            </div>
                            <code className="text-xs font-mono text-gray-400 truncate block">
                              {shortenAddress(id.address || '')}
                            </code>
                          </div>
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(id.address ?? '')}
                          className="shrink-0 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                          type="button"
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-500">
                      Ethereum
                    </span>
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-500">
                      Base
                    </span>
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-500">
                      Optimism
                    </span>
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-500">
                      Arbitrum
                    </span>
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-500">
                      Polygon
                    </span>
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-500">
                      Solana
                    </span>
                    <button
                      onClick={() => {
                        const addr = identities.find((i) => i.address)?.address;
                        if (addr) navigator.clipboard.writeText(addr);
                      }}
                      className="rounded-full bg-degen-500/20 px-2 py-0.5 text-[10px] text-degen-400 hover:bg-degen-500/30 transition-colors"
                      type="button"
                    >
                      Copy All
                    </button>
                  </div>
                </div>
              )}

              <div className="card border-yellow-500/20 bg-yellow-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <h3 className="text-xs font-semibold text-yellow-400">Platform Tipping</h3>
                </div>
                <div className="space-y-2">
                  {identities.map((id) => (
                    <div key={`tip-${id.id}`} className="card !bg-gray-900/40 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span style={{ color: id.color }}>{PROTOCOL_ICONS[id.protocol]}</span>
                        <div>
                          <div className="text-xs text-white">
                            {id.protocol === 'ethereum'
                              ? 'Ethereum Wallet'
                              : id.protocol.charAt(0).toUpperCase() + id.protocol.slice(1)}
                          </div>
                          <div className="text-[10px] text-gray-600">
                            {id.protocol === 'nostr'
                              ? 'Lightning Zaps available'
                              : id.protocol === 'lens'
                                ? 'Lens Collect available'
                                : id.protocol === 'farcaster'
                                  ? 'Farcaster Frames available'
                                  : id.protocol === 'ethereum' || id.protocol === 'solana'
                                    ? 'Direct crypto transfer'
                                    : 'Coming soon'}
                          </div>
                        </div>
                      </div>
                      {id.protocol === 'nostr' && (
                        <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] text-yellow-400">
                          ⚡ Zap
                        </span>
                      )}
                      {(id.protocol === 'ethereum' || id.protocol === 'solana') && id.address && (
                        <button
                          onClick={() => navigator.clipboard.writeText(id.address ?? '')}
                          className="rounded-lg bg-gray-800 px-2 py-1 text-[10px] text-gray-500 hover:text-white transition-colors"
                          type="button"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card !bg-gray-900/30 p-3">
                <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                  How it works
                </h4>
                <ul className="space-y-1 text-[10px] text-gray-500">
                  <li>• Tips are sent directly — DegenFeed never holds funds</li>
                  <li>• Each connected protocol enables its own tipping method</li>
                  <li>• Link more accounts to unlock more ways to receive tips</li>
                  <li>• Tippers use their own wallets — no platform account needed</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="card border-degen-500/20 bg-degen-500/5 py-6 text-center">
            <p className="mb-2 text-sm text-degen-400">
              Your profile is automatically assembled from all connected accounts.
            </p>
            <p className="text-xs text-gray-500">
              The primary identity is used for your display name and avatar. Use the buttons above
              to manage your identities.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
