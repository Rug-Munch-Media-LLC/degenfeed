'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useSolana } from '../../../components/SolanaProvider';
import { useWeb3 } from '../../../components/Web3Provider';
import { formatBenefit, type TierInfo, useSubscription } from '../../../hooks/useSubscription';

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

type SubscribeState =
  | { step: 'select' }
  | { step: 'connect_wallet'; tier: TierInfo }
  | { step: 'method_select'; tier: TierInfo }
  | { step: 'signing'; tier: TierInfo; method: string }
  | { step: 'confirming'; tier: TierInfo }
  | { step: 'success'; tier: TierInfo; expiresAt: number }
  | { step: 'error'; tier: TierInfo; error: string };

const METHOD_OPTIONS = [
  {
    value: 'ethereum',
    label: 'Ethereum',
    icon: '◆',
    description: 'Pay with ETH via MetaMask or any EVM wallet',
  },
  {
    value: 'solana',
    label: 'Solana',
    icon: '◎',
    description: 'Pay with SOL via Phantom, Solflare, or Backpack',
  },
  {
    value: 'lightning_zap',
    label: 'Lightning',
    icon: '⚡',
    description: 'Pay via Bitcoin Lightning — fast, near-zero fees',
  },
];

const DEFAULT_TIERS: TierInfo[] = [
  { id: 'supporter', name: 'Supporter', price: 5, benefits: ['badge', 'early_access'] },
  {
    id: 'member',
    name: 'Member',
    price: 15,
    benefits: ['badge', 'early_access', 'exclusive_content', 'discord'],
  },
  {
    id: 'patron',
    name: 'Patron',
    price: 50,
    benefits: ['badge', 'early_access', 'exclusive_content', 'discord', '1on1', 'voting'],
  },
];

export default function SubscribePage() {
  const params = useParams();
  const creator = (Array.isArray(params.creator) ? params.creator[0] : params.creator) ?? '';

  const { walletAddress } = useAuth();
  const { account: evmAccount, isConnected: evmConnected, connect: connectWallet } = useWeb3();
  const {
    account: solanaAccount,
    isConnected: solanaConnected,
    connect: connectSolana,
    signAndSendTransaction,
  } = useSolana();
  const { getCreatorTiers, subscribeToCreator, confirmSubscription } = useSubscription();

  const [tiers, setTiers] = useState<TierInfo[]>(DEFAULT_TIERS);
  const [loading, setLoading] = useState(true);
  const [subscribeState, setSubscribeState] = useState<SubscribeState>({ step: 'select' });

  const connectedWallet = evmConnected
    ? evmAccount
    : solanaConnected
      ? solanaAccount
      : walletAddress;
  const chain = evmConnected ? 'ethereum' : solanaConnected ? 'solana' : 'ethereum';

  useEffect(() => {
    let cancelled = false;
    getCreatorTiers(creator)
      .then((result) => {
        if (!cancelled) {
          if (result.tiers.length > 0) {
            setTiers(result.tiers);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [creator, getCreatorTiers]);

  const handleSelectTier = useCallback(
    (tier: TierInfo) => {
      if (!connectedWallet) {
        setSubscribeState({ step: 'connect_wallet', tier });
        return;
      }
      setSubscribeState({ step: 'method_select', tier });
    },
    [connectedWallet],
  );

  const handleConnectWallet = useCallback(async () => {
    try {
      if (window.ethereum) {
        await connectWallet();
      } else if (window.phantom?.solana ?? window.solflare ?? window.backpack?.solana) {
        await connectSolana();
      } else {
        throw new Error('No wallet detected. Install MetaMask or Phantom.');
      }
      setSubscribeState({ step: 'select' });
    } catch (err) {
      setSubscribeState({
        step: 'error',
        tier: tiers[0] ?? DEFAULT_TIERS[0] ?? { id: '', name: '', price: 0, benefits: [] },
        error: err instanceof Error ? err.message : 'Wallet connection failed',
      });
    }
  }, [connectWallet, connectSolana, tiers]);

  const handleSign = useCallback(
    async (tier: TierInfo, method: string) => {
      setSubscribeState({ step: 'signing', tier, method });

      try {
        // Step 1: Create pending subscription
        const subResult = await subscribeToCreator(creator, chain, tier.id, tier.price, method);

        if (!subResult.success) {
          throw new Error(subResult.error ?? 'Failed to create pending subscription');
        }

        // Step 2: Execute payment via wallet
        let txHash: string | undefined;

        if (method === 'ethereum') {
          let ethAccount = evmAccount;
          if (!ethAccount) ethAccount = await connectWallet();
          if (!ethAccount) throw new Error('No Ethereum wallet connected');

          const valueHex = `0x${BigInt(Math.floor(tier.price * 1e18)).toString(16)}`;
          if (!window.ethereum) throw new Error('No Ethereum wallet detected');

          txHash = (await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{ to: creator, value: valueHex }],
          })) as string;
        } else if (method === 'solana') {
          let solAccount = solanaAccount;
          if (!solAccount) solAccount = await connectSolana();
          if (!solAccount) throw new Error('No Solana wallet connected');

          const { signature } = await signAndSendTransaction(creator, tier.price);
          txHash = signature;
        } else {
          // Lightning / other methods: just create the intent
          txHash = `ln_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }

        if (!txHash) throw new Error('Transaction failed');

        setSubscribeState({ step: 'confirming', tier });

        // Step 3: Confirm subscription
        const confirmResult = await confirmSubscription(creator, txHash, subResult.nonce);

        if (!confirmResult.success) {
          throw new Error(confirmResult.error ?? 'Confirmation failed');
        }

        setSubscribeState({
          step: 'success',
          tier,
          expiresAt: confirmResult.expiryDate ?? Date.now() + 30 * 24 * 60 * 60 * 1000,
        });
      } catch (err) {
        setSubscribeState({
          step: 'error',
          tier,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [
      creator,
      chain,
      evmAccount,
      solanaAccount,
      connectWallet,
      connectSolana,
      signAndSendTransaction,
      subscribeToCreator,
      confirmSubscription,
    ],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 animate-pulse">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-16 w-16 skeleton rounded-full" />
          <div className="mx-auto mb-2 h-7 w-64 skeleton rounded-lg" />
          <div className="mx-auto h-4 w-48 skeleton rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <div className="h-5 w-24 skeleton rounded mb-3" />
              <div className="h-8 w-20 skeleton rounded mb-4" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-4 w-full skeleton rounded" />
                ))}
              </div>
              <div className="mt-6 h-10 w-full skeleton rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-muted)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-fg)] transition-colors"
        >
          ← Back to profile
        </Link>
      </div>

      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/30 via-purple-500/30 to-fuchsia-500/30 text-2xl font-bold text-[var(--color-fg)] shadow-[0_0_30px_rgba(34,197,94,0.2)]">
          {creator.slice(0, 2).toUpperCase()}
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">
          Subscribe to {shortenAddress(creator)}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Support this creator and unlock exclusive content
        </p>
        {walletAddress && (
          <p className="mt-2 text-xs text-[var(--color-muted)]">Connected: {shortenAddress(walletAddress)}</p>
        )}
      </div>

      {subscribeState.step === 'connect_wallet' && (
        <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
          <p className="mb-3 text-sm text-yellow-400">Connect your wallet to subscribe</p>
          <button onClick={handleConnectWallet} className="btn-primary text-sm" type="button">
            Connect Wallet
          </button>
        </div>
      )}

      {(subscribeState.step === 'select' || subscribeState.step === 'connect_wallet') && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-widest text-[var(--color-muted)]">
            Choose a Tier
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6"
              >
                <h3 className="text-lg font-bold text-[var(--color-fg)]">{tier.name}</h3>
                <p className="mt-2 text-3xl font-bold text-[var(--color-fg)]">
                  ${tier.price}
                  <span className="text-sm text-[var(--color-muted)]">/mo</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2">
                  {tier.benefits.map((b) => (
                    <li
                      key={String(b)}
                      className="flex items-center gap-2 text-sm text-[var(--color-muted)]"
                    >
                      <span className="shrink-0 text-degen-400">✓</span>
                      {formatBenefit(String(b))}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSelectTier(tier)}
                  className="btn-primary mt-6 w-full"
                  type="button"
                >
                  Subscribe ${tier.price}/mo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {subscribeState.step === 'method_select' && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-widest text-[var(--color-muted)]">
            Payment Method
          </h2>
          <div className="rounded-2xl border border-degen-500/20 bg-degen-500/5 p-4">
            <p className="mb-3 text-sm text-degen-400">
              Subscribe to <strong>{subscribeState.tier.name}</strong> — $
              {subscribeState.tier.price}/mo
            </p>
            <div className="space-y-2">
              {METHOD_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => handleSign(subscribeState.tier, m.value)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-left transition-all hover:border-degen-500/50"
                  type="button"
                >
                  <span className="text-lg">{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[var(--color-fg)]">{m.label}</div>
                    <div className="text-xs text-[var(--color-muted)]">{m.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setSubscribeState({ step: 'select' })}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-muted)] transition-colors"
            type="button"
          >
            ← Choose a different tier
          </button>
        </div>
      )}

      {subscribeState.step === 'signing' && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-12 text-center">
          <div className="mb-4 inline-block animate-spin text-3xl">⚡</div>
          <p className="text-sm text-[var(--color-muted)]">
            Sign the transaction in your wallet...
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Approve the payment in your connected wallet</p>
        </div>
      )}

      {subscribeState.step === 'confirming' && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] py-12 text-center">
          <div className="mb-4 inline-block animate-spin text-3xl">⏳</div>
          <p className="text-sm text-[var(--color-muted)]">Confirming subscription on-chain...</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Your subscription will be active once confirmed
          </p>
        </div>
      )}

      {subscribeState.step === 'success' && (
        <div className="rounded-2xl border border-degen-500/20 bg-degen-500/5 py-8 text-center">
          <div className="mb-3 text-4xl">🎉</div>
          <h2 className="text-xl font-bold text-[var(--color-fg)]">Subscription Active!</h2>
          <p className="mt-2 text-sm text-degen-400">
            You are now subscribed to the <strong>{subscribeState.tier.name}</strong> tier
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Expires: {new Date(subscribeState.expiresAt).toLocaleDateString()}
          </p>
          <Link href="/profile" className="btn-primary mt-6 inline-block text-sm">
            Go to Profile
          </Link>
        </div>
      )}

      {subscribeState.step === 'error' && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <div className="mb-3 text-3xl">⚠</div>
          <h2 className="text-lg font-bold text-red-400">Subscription Failed</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{subscribeState.error}</p>
          <button
            onClick={() => setSubscribeState({ step: 'select' })}
            className="btn-primary mt-4 text-sm"
            type="button"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
