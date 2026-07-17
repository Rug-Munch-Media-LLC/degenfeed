import { memo, useState } from 'react';

export type { ReactNode } from 'react';

export interface ProtocolOption {
  id: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  method: 'oauth' | 'key' | 'extension' | 'password' | 'wallet';
  authUrl?: string;
}

export interface WalletOption {
  id: string;
  label: string;
  icon: string;
  color: string;
  detected: boolean;
}

export interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onSignIn: (protocol: string, credentials?: Record<string, string>) => void;
  walletAddress?: string;
  walletSigningIn?: boolean;
  /** List of detected browser wallets. When omitted, falls back to basic Ethereum/Solana buttons. */
  availableWallets?: WalletOption[];
}

const PROTOCOLS: ProtocolOption[] = [
  {
    id: 'nostr',
    label: 'Nostr',
    color: '#8e30eb',
    icon: '☰',
    description: 'npub/nsec key or browser extension',
    method: 'key',
  },
  {
    id: 'farcaster',
    label: 'Farcaster',
    color: '#8a63d2',
    icon: '◈',
    description: 'FID + signer key (or Warpcast)',
    method: 'key',
  },
  {
    id: 'lens',
    label: 'Lens',
    color: '#abfe2c',
    icon: '◎',
    description: 'Connect wallet (MetaMask, Rainbow)',
    method: 'extension',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    color: '#1185fe',
    icon: '☁',
    description: 'Handle + app password',
    method: 'password',
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    color: '#6364ff',
    icon: '🐘',
    description: 'Any Mastodon/GotoSocial server',
    method: 'oauth',
    authUrl: '/api/auth/gotosocial/authorize',
  },
  {
    id: 'ethereum',
    label: 'Ethereum',
    color: '#627eea',
    icon: '◆',
    description: 'Sign in with Ethereum wallet',
    method: 'wallet',
  },
  {
    id: 'solana',
    label: 'Solana',
    color: '#9945ff',
    icon: '◎',
    description: 'Sign in with Solana wallet',
    method: 'wallet',
  },
];

function NostrForm({
  onSignIn,
  onBack,
}: {
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<'choice' | 'nsec' | 'extension'>('choice');
  const [nsec, setNsec] = useState('');
  const [error, setError] = useState('');

  if (mode === 'choice') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setMode('nsec')}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-left hover:border-gray-600"
        >
          <span className="text-lg">🔑</span>
          <div>
            <div className="text-sm font-semibold text-[var(--color-fg)]">Paste nsec / NIP-07</div>
            <div className="text-xs text-gray-500">
              Enter your secret key or use a browser extension
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode('extension')}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-left hover:border-gray-600"
        >
          <span className="text-lg">🧩</span>
          <div>
            <div className="text-sm font-semibold text-[var(--color-fg)]">Use browser extension</div>
            <div className="text-xs text-gray-500">Alby, nos2x, or any NIP-07 signer</div>
          </div>
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-300"
        >
          ← Back
        </button>
      </div>
    );
  }

  if (mode === 'extension') {
    const hasNip07 =
      typeof window !== 'undefined' && !!(window as unknown as { nostr?: unknown }).nostr;
    if (hasNip07) {
      onSignIn({ method: 'extension' });
      return null;
    }
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-400">
          No NIP-07 extension detected. Install{' '}
          <a
            href="https://getalby.com"
            target="_blank"
            rel="noopener"
            className="text-degen-400 underline"
          >
            Alby
          </a>{' '}
          or{' '}
          <a
            href="https://github.com/fiatjaf/nos2x"
            target="_blank"
            rel="noopener"
            className="text-degen-400 underline"
          >
            nos2x
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => setMode('choice')}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-300"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-400">nsec (secret key)</span>
        <input
          type="password"
          value={nsec}
          onChange={(e) => {
            setNsec(e.target.value);
            setError('');
          }}
          placeholder="nsec1..."
          className="input w-full font-mono text-xs"
        />
      </label>
      <p className="text-[10px] text-gray-600">
        Stored encrypted in your browser. Never sent to any server in plaintext.
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('choice')}
          className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-xs text-gray-400 hover:text-[var(--color-fg)]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            if (!nsec.trim()) {
              setError('Please enter your nsec');
              return;
            }
            if (!nsec.startsWith('nsec1') && nsec.length !== 64) {
              setError('Invalid nsec format');
              return;
            }
            onSignIn({ nsec: nsec.trim(), method: 'nsec' });
          }}
          className="btn-primary flex-1"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}

function FarcasterForm({
  onSignIn,
  onBack,
}: {
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<'choice' | 'form'>('choice');
  const [fid, setFid] = useState('');
  const [username, setUsername] = useState('');
  const [signerKey, setSignerKey] = useState('');
  const [error, setError] = useState('');

  if (mode === 'choice') {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setMode('form')}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-left hover:border-gray-600"
        >
          <span className="text-lg">🔐</span>
          <div>
            <div className="text-sm font-semibold text-[var(--color-fg)]">Enter FID + signer key</div>
            <div className="text-xs text-gray-500">For self-custody Farcaster signers</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSignIn({ method: 'warpcast' })}
          className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-left hover:border-gray-600"
        >
          <span className="text-lg">🔗</span>
          <div>
            <div className="text-sm font-semibold text-[var(--color-fg)]">Sign in with Warpcast</div>
            <div className="text-xs text-gray-500">Use your Warpcast account via OAuth</div>
          </div>
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs text-gray-500 hover:text-gray-300"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-400">Username</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="alice"
          className="input w-full"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-400">FID (numeric)</span>
        <input
          type="text"
          value={fid}
          onChange={(e) => setFid(e.target.value)}
          placeholder="12345"
          className="input w-full"
          inputMode="numeric"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-400">
          Signer private key (hex)
        </span>
        <input
          type="password"
          value={signerKey}
          onChange={(e) => setSignerKey(e.target.value)}
          placeholder="0x... or hex"
          className="input w-full font-mono text-xs"
        />
      </label>
      <p className="text-[10px] text-gray-600">
        Signer key is used to sign casts. Stored encrypted in your browser.
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('choice')}
          className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-xs text-gray-400 hover:text-[var(--color-fg)]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            if (!username.trim() || !fid.trim() || !signerKey.trim()) {
              setError('All fields required');
              return;
            }
            onSignIn({ username: username.trim(), fid: fid.trim(), signerKey: signerKey.trim() });
          }}
          className="btn-primary flex-1"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}

function BlueskyForm({
  onSignIn,
  onBack,
}: {
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-400">Handle</span>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="alice.bsky.social"
          className="input w-full"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-400">App Password</span>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
            placeholder="xxxx-xxxx-xxxx-xxxx"
            className="input w-full font-mono text-xs pr-16"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <a
          href="https://bsky.app/settings/app-passwords"
          target="_blank"
          rel="noopener"
          className="text-[10px] text-degen-400 hover:underline"
        >
          Create one at bsky.app/settings/app-passwords →
        </a>
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-xs text-gray-400 hover:text-[var(--color-fg)]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            if (!handle.trim() || !appPassword.trim()) {
              setError('All fields required');
              return;
            }
            onSignIn({ handle: handle.trim(), appPassword: appPassword.trim() });
          }}
          className="btn-primary flex-1"
        >
          Sign in
        </button>
      </div>
    </div>
  );
}

function LensForm({
  onSignIn,
  onBack,
}: {
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [hasWallet, setHasWallet] = useState(false);

  if (typeof window !== 'undefined') {
    setTimeout(() => setHasWallet(!!(window as unknown as { ethereum?: unknown }).ethereum), 0);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400">
        Lens uses your Ethereum wallet to sign in. Make sure MetaMask, Rainbow, or another EVM
        wallet is installed.
      </p>
      <button
        type="button"
        onClick={() => onSignIn({ method: 'wallet' })}
        className="btn-primary w-full"
      >
        {hasWallet ? 'Sign in with wallet' : 'Connect wallet'}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-gray-500 hover:text-gray-300"
      >
        ← Back
      </button>
    </div>
  );
}

function MastodonForm({
  onSignIn,
  onBack,
}: {
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [instance, setInstance] = useState('https://social.degenfeed.xyz');
  const [accessToken, setAccessToken] = useState('');
  const [error, _setError] = useState('');

  const handleMastodonOAuth = async () => {
    try {
      const res = await fetch('/api/auth/gotosocial/authorize', { credentials: 'include' });
      if (!res.ok) throw new Error('Authorization not available');
      const data = (await res.json()) as { authorizeUrl: string };
      window.location.href = data.authorizeUrl;
    } catch {
      window.location.href = `${instance}/oauth/authorize?client_id=degenfeed&response_type=code&scope=read+write+follow+push&redirect_uri=${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`;
    }
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-400">Instance URL</span>
        <input
          type="url"
          value={instance}
          onChange={(e) => setInstance(e.target.value)}
          placeholder="https://mastodon.social"
          className="input w-full"
        />
      </label>
      <div className="text-center text-xs text-gray-600">— or —</div>
      <button
        type="button"
        onClick={handleMastodonOAuth}
        className="btn-secondary flex w-full items-center justify-center text-xs"
      >
        OAuth with {instance.replace(/^https?:\/\//, '')}
      </button>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-400">Or paste access token</span>
        <input
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="paste from /settings/applications"
          className="input w-full font-mono text-xs"
        />
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-xs text-gray-400 hover:text-[var(--color-fg)]"
        >
          Back
        </button>
        {accessToken && (
          <button
            type="button"
            onClick={() => onSignIn({ instance: instance.trim(), accessToken: accessToken.trim() })}
            className="btn-primary flex-1"
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}

function ProtocolForm({
  protocol,
  onSignIn,
  onBack,
}: {
  protocol: ProtocolOption;
  onSignIn: (creds: Record<string, string>) => void;
  onBack: () => void;
}) {
  const props = { onSignIn, onBack };
  switch (protocol.id) {
    case 'nostr':
      return <NostrForm {...props} />;
    case 'farcaster':
      return <FarcasterForm {...props} />;
    case 'lens':
      return <LensForm {...props} />;
    case 'bluesky':
      return <BlueskyForm {...props} />;
    case 'mastodon':
      return <MastodonForm {...props} />;
    default:
      return <p className="text-sm text-gray-500">Unknown protocol</p>;
  }
}

function WalletSection({
  onSignIn,
  walletAddress,
  walletSigningIn,
  availableWallets,
}: {
  onSignIn: (p: string) => void;
  walletAddress?: string;
  walletSigningIn?: boolean;
  availableWallets?: WalletOption[];
}) {
  const hasDetection = availableWallets && availableWallets.length > 0;
  const detectedWallets = hasDetection
    ? availableWallets.filter((w) => w.detected && w.id !== 'walletconnect')
    : [];

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-widest text-gray-500">Web3 Wallets</h3>

      {/* Connected wallet display */}
      {walletAddress ? (
        <div className="rounded-xl border border-degen-500/30 bg-degen-500/10 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Connected Wallet</div>
          <div className="text-sm font-mono text-degen-400 break-all">{walletAddress}</div>
        </div>
      ) : null}

      {/* Detected wallet list */}
      {hasDetection && detectedWallets.length > 0 ? (
        <div className="space-y-1.5">
          {availableWallets.map((w) => {
            if (w.id === 'walletconnect') return null; // rendered separately below
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => onSignIn('ethereum')}
                disabled={walletSigningIn}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all ${
                  w.detected
                    ? 'border-[var(--color-border)] bg-[var(--color-muted)] hover:border-gray-500'
                    : 'border-[var(--color-border)]/50 bg-[var(--color-muted)] opacity-50'
                }`}
              >
                <span className="text-lg">{w.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--color-fg)]">{w.label}</div>
                  {w.detected ? (
                    <div className="text-[10px] text-green-500">● Detected</div>
                  ) : (
                    <div className="text-[10px] text-gray-600">Not detected</div>
                  )}
                </div>
                {w.detected && (
                  <span className="text-xs text-gray-500 group-hover:text-gray-300">Connect →</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* Fallback: simple Ethereum / Solana buttons (backward compatible) */
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSignIn('ethereum')}
            disabled={walletSigningIn}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#627eea]/30 bg-[#627eea]/10 px-4 py-3 text-sm font-semibold text-[#627eea] transition-all hover:bg-[#627eea]/20 disabled:opacity-50"
            type="button"
          >
            <span className="text-lg">◆</span>
            {walletSigningIn ? 'Signing...' : 'Ethereum'}
          </button>
          <button
            onClick={() => onSignIn('solana')}
            disabled={walletSigningIn}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#9945ff]/30 bg-[#9945ff]/10 px-4 py-3 text-sm font-semibold text-[#9945ff] transition-all hover:bg-[#9945ff]/20 disabled:opacity-50"
            type="button"
          >
            <span className="text-lg">◎</span>
            {walletSigningIn ? 'Signing...' : 'Solana'}
          </button>
        </div>
      )}

      {/* WalletConnect QR placeholder */}
      <button
        type="button"
        onClick={() => onSignIn('ethereum')}
        disabled={walletSigningIn}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[#3b99fc]/40 bg-[#3b99fc]/5 px-4 py-2.5 text-left transition-all hover:border-[#3b99fc]/60 hover:bg-[#3b99fc]/10"
      >
        <span className="text-lg">🔗</span>
        <div className="flex-1">
          <div className="text-sm font-medium text-[#3b99fc]">WalletConnect</div>
          <div className="text-xs text-gray-500">
            Scan QR with your mobile wallet
            <span className="ml-1.5 rounded bg-[#3b99fc]/20 px-1.5 py-0.5 text-[10px] text-[#3b99fc]">
              Coming soon
            </span>
          </div>
        </div>
      </button>

      <p className="text-center text-xs text-gray-600">
        {walletAddress
          ? 'Signed in. You can also link social protocols below.'
          : 'No emails, no passwords. Sign in with your wallet.'}
      </p>
    </div>
  );
}

export const SignInModal = memo(function SignInModal({
  open,
  onClose,
  onSignIn,
  walletAddress,
  walletSigningIn,
  availableWallets,
}: SignInModalProps) {
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolOption | null>(null);

  if (!open) return null;

  const handleProtocolClick = (protocol: ProtocolOption) => {
    if (protocol.method === 'wallet') {
      onSignIn(protocol.id);
      return;
    }
    setSelectedProtocol(protocol);
  };

  const handleBack = () => setSelectedProtocol(null);

  return (
    <section
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => {
        setSelectedProtocol(null);
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setSelectedProtocol(null);
          onClose();
        }
      }}
      aria-modal="true"
      aria-label="Sign in to DegenFeed"
      role="dialog"
    >
      <div
        className="mx-4 w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-fg)]">
              {selectedProtocol ? `Sign in with ${selectedProtocol.label}` : 'Sign In'}
            </h2>
            <p className="text-sm text-gray-500">
              {selectedProtocol
                ? selectedProtocol.description
                : 'Sign in with your wallet to post, tip, and cross-post across the open social graph.'}
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedProtocol(null);
              onClose();
            }}
            className="rounded-lg p-2 text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Close"
            type="button"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              role="img"
              aria-label="Close icon"
            >
              <title>Close</title>
              <path
                d="M15 5L5 15M5 5l10 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {selectedProtocol ? (
          <ProtocolForm
            protocol={selectedProtocol}
            onSignIn={(creds) => onSignIn(selectedProtocol.id, creds)}
            onBack={handleBack}
          />
        ) : (
          <>
            <div className="mb-6">
              <WalletSection
                onSignIn={(p) => onSignIn(p)}
                walletAddress={walletAddress}
                walletSigningIn={walletSigningIn}
                availableWallets={availableWallets}
              />
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--color-border)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[var(--color-card)] px-3 text-xs text-gray-600">
                  or link a social protocol
                </span>
              </div>
            </div>

            <div className="mb-6 space-y-2">
              {PROTOCOLS.filter((p) => p.method !== 'wallet').map((proto) => (
                <button
                  key={proto.id}
                  onClick={() => handleProtocolClick(proto)}
                  className="flex w-full items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-left transition-all hover:border-gray-600 hover:bg-[var(--color-muted)] group"
                  type="button"
                >
                  <span className="text-2xl" style={{ color: proto.color }}>
                    {proto.icon}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[var(--color-fg)] group-hover:text-degen-400 transition-colors">
                      {proto.label}
                    </div>
                    <div className="text-xs text-gray-500">{proto.description}</div>
                  </div>
                  <span className="text-xs text-gray-600">→</span>
                </button>
              ))}
            </div>

            <a
              href="/api/auth/gotosocial/register"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-degen-500/30 bg-degen-500/10 px-4 py-3 text-sm font-semibold text-degen-400 transition-all hover:bg-degen-500/20 hover:border-degen-500/50"
            >
              <span>✦</span>
              Create free @degenfeed.xyz account
              <span className="text-xs text-degen-600">(30 seconds)</span>
            </a>
            <p className="mt-2 text-center text-xs text-gray-600">
              Powered by GotoSocial. No email required.
            </p>
          </>
        )}

        {!selectedProtocol && (
          <p className="mt-6 text-center text-xs text-gray-600">
            No account needed to browse.{' '}
            <a href="/home" className="text-degen-500 hover:underline">
              Start reading now
            </a>
          </p>
        )}
      </div>
    </section>
  );
});
