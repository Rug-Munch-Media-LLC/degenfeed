'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useWeb3 } from '../../components/Web3Provider';

export const dynamic = 'force-dynamic';

interface ResolvedIdentity {
  protocol: string;
  displayName?: string;
  handle?: string;
  avatarUrl?: string;
  address?: string;
  color: string;
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

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ProfilePage() {
  const { signedInProtocols, walletAddress, ready, openSignIn } = useAuth();
  const { account: wagmiAddress, isConnected } = useWeb3();
  const [identities, setIdentities] = useState<ResolvedIdentity[]>([]);
  const hasSignedIn = Object.values(signedInProtocols).some(Boolean) || isConnected;

  // Resolve identities from all sources
  useEffect(() => {
    const resolved: ResolvedIdentity[] = [];

    // From localStorage
    try {
      const stored = localStorage.getItem('degenfeed_identities');
      if (stored) {
        const storedIds: Array<{
          protocol: string;
          displayName?: string;
          handle?: string;
          avatarUrl?: string;
        }> = JSON.parse(stored);
        for (const id of storedIds) {
          resolved.push({
            protocol: id.protocol,
            displayName: id.displayName,
            handle: id.handle,
            avatarUrl: id.avatarUrl,
            color: PROTOCOL_COLORS[id.protocol] || '#666',
          });
        }
      }
    } catch {
      /* ignore */
    }

    // Wallet address
    const addr = walletAddress || wagmiAddress;
    if (addr) {
      resolved.push({
        protocol: 'ethereum',
        displayName: 'Ethereum Wallet',
        handle: shortenAddress(addr),
        address: addr,
        color: PROTOCOL_COLORS.ethereum ?? '#627eea',
      });
    }

    // Deduplicate
    const seen = new Set<string>();
    const unique = resolved.filter((r) => {
      const key = `${r.protocol}:${r.address || r.handle || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setIdentities(unique);
  }, [walletAddress, wagmiAddress]);

  if (!ready) {
    return <div className="mx-auto max-w-2xl px-4 py-20 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-3xl">
          {identities.length > 0
            ? (identities[0]?.displayName ?? '?').charAt(0).toUpperCase()
            : '?'}
        </div>
        <h1 className="text-2xl font-bold text-white">
          {identities.length > 0 ? (identities[0]?.displayName ?? 'Unnamed') : 'DegenFeed User'}
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
          {/* Connected Identities */}
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-500">
              Connected Identities
            </h2>
            <div className="space-y-2">
              {identities.map((id) => (
                <div
                  key={`${id.protocol}-${id.handle || id.address || id.displayName || Math.random()}`}
                  className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                    style={{ backgroundColor: `${id.color}22`, color: id.color }}
                  >
                    {id.avatarUrl ? (
                      <img
                        src={id.avatarUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
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
                </div>
              ))}
            </div>
          </div>

          {/* Cross-Platform Tipping Section */}
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-widest text-gray-500">
              Receive Tips
            </h2>
            <div className="space-y-3">
              {/* QR Code for primary wallet */}
              {(() => {
                const tipAddr = identities.find((i) => i.address)?.address;
                if (!tipAddr || typeof window === 'undefined') return null;
                const tipUrl = tipAddr.startsWith('0x')
                  ? `ethereum:${tipAddr}`
                  : `solana:${tipAddr}`;
                return (
                  <div className="flex flex-col items-center rounded-xl border border-degen-500/20 bg-degen-500/5 p-4">
                    <h3 className="mb-2 text-xs font-semibold text-degen-400">Scan to Tip</h3>
                    <div className="mb-2 rounded-xl bg-white p-3">
                      <QRCodeSVG value={tipUrl} size={140} />
                    </div>
                    <p className="text-[10px] text-gray-500 text-center">
                      Scan with any wallet app to send crypto
                    </p>
                  </div>
                );
              })()}
              {/* Wallet addresses (if linked) */}
              {identities.filter((i) => i.address).length > 0 && (
                <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-4">
                  <h3 className="mb-2 text-xs font-semibold text-degen-400">Direct Crypto</h3>
                  <p className="mb-3 text-xs text-gray-400">
                    Anyone can send you tips on these chains — no DegenFeed account needed.
                  </p>
                  {identities
                    .filter((i) => i.address)
                    .map((id) => (
                      <div
                        key={`${id.protocol}-${id.address}`}
                        className="mb-2 flex items-center justify-between rounded-lg bg-gray-900/50 px-3 py-2"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="hidden sm:block rounded-lg bg-white p-1">
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

              {/* Platform-specific tipping */}
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">⚡</span>
                  <h3 className="text-xs font-semibold text-yellow-400">Platform Tipping</h3>
                </div>
                <div className="space-y-2">
                  {identities.map((id) => (
                    <div
                      key={`${id.protocol}-${id.handle || id.address || id.displayName || Math.random()}`}
                      className="flex items-center justify-between rounded-lg bg-gray-900/50 px-3 py-2"
                    >
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

              {/* Instructions */}
              <div className="rounded-lg bg-gray-900/30 p-3">
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

          {/* Display Order Note */}
          <div className="card border-degen-500/20 bg-degen-500/5 py-6 text-center">
            <p className="mb-2 text-sm text-degen-400">
              Your profile is automatically assembled from all connected accounts.
            </p>
            <p className="text-xs text-gray-500">
              The first connected account becomes your primary display name and avatar.
              Drag-and-drop reordering coming soon.
            </p>
          </div>
        </>
      )}

      <div className="mt-6 text-center">
        <a href="/home" className="text-sm text-gray-600 hover:text-white transition-colors">
          &larr; Back to feed
        </a>
      </div>
    </div>
  );
}
