'use client';

/**
 * @degenfeed/web — TipButton
 *
 * Universal tip button that works everywhere:
 *   - Embedded in every post card
 *   - Embedded in every video player
 *   - Embedded in live stream overlays
 *   - Embedded in chat messages
 *   - Works in profile pages
 *   - Works in DAO pages
 *
 * Tip flow:
 *   1. Click tip button → opens tip modal
 *   2. Select amount (presets: $1, $5, $10, $25, $50 or sats)
 *   3. Select chain/token (auto-selected based on smart routing)
 *   4. Add optional message
 *   5. Confirm → wallet signature → tip sent
 *   6. Confetti/animation on success
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TipMethod } from '../../hooks/useTip';
import { useTip } from '../../hooks/useTip';
import { useAnnouncer } from '../ScreenReaderAnnouncer';
import { useSolana } from '../SolanaProvider';
import { useWeb3 } from '../Web3Provider';

// ─── Types ──────────────────────────────────────────────────────────────

export interface TipButtonContext {
  /** Protocol the content is from */
  protocol: string;
  /** Author/user identifier on that protocol */
  authorId: string;
  /** Display name for the recipient */
  authorDisplayName: string;
  /** Protocol-specific publication/post ID */
  publicationId?: string;
  /** URL of the content being tipped (for share/social) */
  contentUrl?: string;
  /** Pre-configured methods from the parent component */
  preconfiguredMethods?: TipMethod[];
  /** Variant of the button to render */
  variant?: 'post' | 'video' | 'live' | 'chat' | 'profile' | 'dao' | 'mini';
  /** Callback when tip is sent */
  onTipSent?: (result: { amount: string; method: string; txHash?: string }) => void;
  /** Extra CSS classes */
  className?: string;
}

interface SmartChainOption {
  chain: string;
  rank: number;
  reason: string;
  route: {
    chain: string;
    currency: string;
    tokens: string[];
    avgFeeUsd: number;
    speed: string;
  };
}

type TipStep = 'select-amount' | 'select-chain' | 'add-message' | 'confirm' | 'sending' | 'sent';

// ─── Quick Amount Presets ───────────────────────────────────────────────

interface QuickAmount {
  label: string;
  cryptoLabel: string;
  value: string; // Raw amount in smallest unit
  usdEquivalent: number;
}

const FIAT_PRESETS: QuickAmount[] = [
  { label: '$1', cryptoLabel: '0.0005 ETH', value: '1', usdEquivalent: 1 },
  { label: '$5', cryptoLabel: '0.0025 ETH', value: '5', usdEquivalent: 5 },
  { label: '$10', cryptoLabel: '0.005 ETH', value: '10', usdEquivalent: 10 },
  { label: '$25', cryptoLabel: '0.013 ETH', value: '25', usdEquivalent: 25 },
  { label: '$50', cryptoLabel: '0.026 ETH', value: '50', usdEquivalent: 50 },
];

const SATS_PRESETS: QuickAmount[] = [
  { label: '1K sats', cryptoLabel: '1,000 sats', value: '1000', usdEquivalent: 0.6 },
  { label: '5K sats', cryptoLabel: '5,000 sats', value: '5000', usdEquivalent: 3 },
  { label: '10K sats', cryptoLabel: '10,000 sats', value: '10000', usdEquivalent: 6 },
  { label: '50K sats', cryptoLabel: '50,000 sats', value: '50000', usdEquivalent: 30 },
  { label: '100K sats', cryptoLabel: '100,000 sats', value: '100000', usdEquivalent: 60 },
];

const PROTOCOL_EMOJIS: Record<string, string> = {
  nostr: '⚡',
  farcaster: '◈',
  lens: '◎',
  bluesky: '☁️',
  mastodon: '🐘',
  peertube: '🎬',
  owncast: '📡',
  reddit: '🤖',
  github: '🐙',
  telegram: '✈️',
  degenfeed: '🔄',
};

const PROTOCOL_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  nostr: { bg: 'bg-purple-900/20', text: 'text-purple-400', border: 'border-purple-900/50' },
  farcaster: { bg: 'bg-indigo-900/20', text: 'text-indigo-400', border: 'border-indigo-900/50' },
  lens: { bg: 'bg-green-900/20', text: 'text-green-400', border: 'border-green-900/50' },
  bluesky: { bg: 'bg-sky-900/20', text: 'text-sky-400', border: 'border-sky-900/50' },
  mastodon: { bg: 'bg-blue-900/20', text: 'text-blue-400', border: 'border-blue-900/50' },
};

const CHAIN_ICONS: Record<string, string> = {
  lightning: '⚡',
  ethereum: '⟠',
  base: '🔵',
  solana: '◎',
  polygon: '⬡',
  optimism: '🔴',
  arbitrum: '🔶',
};

// ─── Component ─────────────────────────────────────────────────────────

export function TipButton({
  protocol,
  authorId,
  authorDisplayName,
  publicationId,
  contentUrl,
  preconfiguredMethods,
  variant = 'post',
  onTipSent,
  className = '',
}: TipButtonContext) {
  const { state, resolveMethods, createTip, fetchLightningInvoice, setTipStatus } = useTip();
  const { account: evmAccount, connect: connectEvm, provider } = useWeb3();
  const { account: solAccount, connect: connectSol, signAndSendTransaction } = useSolana();
  const { announce } = useAnnouncer();

  // ── UI State ─────────────────────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<TipStep>('select-amount');
  const [selectedAmount, setSelectedAmount] = useState('');
  const [selectedChain, setSelectedChain] = useState('');
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [tipMessage, setTipMessage] = useState('');
  const [smartChains, setSmartChains] = useState<SmartChainOption[]>([]);
  const [txHash, setTxHash] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [showTooltip, setShowTooltip] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [_isOnchain, setIsOnchain] = useState(false);
  const [chainLoading, setChainLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confettiTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Fee estimates ────────────────────────────────────────────────────
  const feeEstimate = useMemo(() => {
    if (!selectedChain) return '—';
    const fees: Record<string, string> = {
      lightning: '< $0.001',
      ethereum: '~$0.50-5.00',
      base: '< $0.01',
      solana: '< $0.01',
      polygon: '~$0.01-0.05',
      optimism: '~$0.01-0.05',
      arbitrum: '~$0.01-0.05',
    };
    return fees[selectedChain] ?? '—';
  }, [selectedChain]);

  // ── Determine if Lightning (sats) or Fiat ────────────────────────────
  const isLightning = selectedChain === 'lightning';
  const presets = isLightning ? SATS_PRESETS : FIAT_PRESETS;

  // ── Amount USD value ─────────────────────────────────────────────────
  const amountUsd = useMemo(() => {
    const preset = presets.find((p) => p.value === selectedAmount);
    if (preset) return preset.usdEquivalent;
    if (isLightning) return Number.parseFloat(selectedAmount) * 0.0006; // rough sats→USD
    return Number.parseFloat(selectedAmount) || 0;
  }, [selectedAmount, presets, isLightning]);

  // ── Open modal & fetch smart chain options ───────────────────────────
  const openTip = useCallback(async () => {
    setIsOpen(true);
    setStep('select-amount');
    setError(undefined);
    setTxHash(undefined);
    setShowConfetti(false);
    setTipMessage('');

    // Fetch smart chain recommendations
    setChainLoading(true);
    try {
      const res = await fetch(
        `/api/tip/smart-chain?senderChains=lightning,solana,base,ethereum&recipientHasEvm=true&recipientHasSolana=true&recipientHasLightning=true&amountUsd=10`,
        { credentials: 'include' },
      );
      const data = (await res.json()) as { chains?: SmartChainOption[] };
      if (data.chains && data.chains.length > 0) {
        setSmartChains(data.chains);
        setSelectedChain(data.chains[0].chain);
      } else {
        setSelectedChain('base');
      }
    } catch {
      setSelectedChain('base');
    } finally {
      setChainLoading(false);
    }

    // Resolve tip methods from server too
    await resolveMethods(protocol, authorId);
  }, [protocol, authorId, resolveMethods]);

  const closeTip = useCallback(() => {
    setIsOpen(false);
    setStep('select-amount');
    setError(undefined);
    setTxHash(undefined);
    setTipMessage('');
    setShowConfetti(false);
  }, []);

  // ── Confetti cleanup ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    };
  }, []);

  // ── Handle tip send ──────────────────────────────────────────────────
  const handleSendTip = useCallback(async () => {
    if (!selectedAmount || !selectedChain) return;
    setStep('sending');
    setError(undefined);

    try {
      // 1. Lightning: generate invoice
      if (selectedChain === 'lightning') {
        setTipStatus('creating');
        const result = await fetchLightningInvoice(
          authorId,
          selectedAmount,
          tipMessage || `Tip for ${authorDisplayName}`,
        );
        if (!result) throw new Error('Failed to generate Lightning invoice');
        setTxHash(result.invoice);
        setStep('sent');
        setShowConfetti(true);
        announce(`Lightning tip sent to ${authorDisplayName}`, 'polite');
        onTipSent?.({ amount: selectedAmount, method: 'lightning_zap', txHash: result.invoice });
        return;
      }

      // 2. Solana
      if (selectedChain === 'solana') {
        let solAccountAddr = solAccount;
        if (!solAccountAddr) solAccountAddr = await connectSol();
        if (!solAccountAddr) throw new Error('Please connect your Solana wallet');

        const intent = await createTip(authorId, protocol, 'solana', selectedAmount, publicationId);
        if (!intent) throw new Error('Failed to create tip intent');

        setTipStatus('signing');
        const amountInSol = isLightning
          ? Number.parseFloat(selectedAmount) * 0.0006
          : Number.parseFloat(selectedAmount) / 170; // rough USD→SOL
        const result = await signAndSendTransaction(intent.intent.to, amountInSol);
        setTxHash(result.signature);
        setStep('sent');
        setShowConfetti(true);
        announce(`${selectedAmount} SOL tip sent to ${authorDisplayName}`, 'polite');
        onTipSent?.({ amount: selectedAmount, method: 'solana', txHash: result.signature });
        return;
      }

      // 3. EVM (Ethereum, Base, Polygon, etc.)
      if (
        selectedChain === 'ethereum' ||
        selectedChain === 'base' ||
        selectedChain === 'polygon' ||
        selectedChain === 'optimism' ||
        selectedChain === 'arbitrum'
      ) {
        let evmAddr = evmAccount;
        if (!evmAddr) evmAddr = await connectEvm();
        if (!evmAddr) throw new Error('Please connect your Ethereum wallet');

        const methodName =
          selectedChain === 'base'
            ? 'base'
            : selectedChain === 'polygon'
              ? 'ethereum'
              : selectedChain === 'optimism'
                ? 'ethereum'
                : selectedChain === 'arbitrum'
                  ? 'ethereum'
                  : 'ethereum';

        const intent = await createTip(
          authorId,
          protocol,
          methodName,
          selectedAmount,
          publicationId,
        );
        if (!intent) throw new Error('Failed to create tip intent');

        // Switch chain in wallet
        const chainIdMap: Record<string, string> = {
          ethereum: '0x1',
          base: '0x2105',
          polygon: '0x89',
          optimism: '0xa',
          arbitrum: '0xa4b1',
        };
        const targetChainId = chainIdMap[selectedChain];
        if (targetChainId && typeof window !== 'undefined' && window.ethereum) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: targetChainId }],
            });
          } catch (switchErr: unknown) {
            const se = switchErr as { code?: number };
            if (se.code === 4902) {
              const chainParams: Record<
                string,
                { chainName: string; rpc: string; explorer: string; currency: string }
              > = {
                base: {
                  chainName: 'Base',
                  rpc: 'https://mainnet.base.org',
                  explorer: 'https://basescan.org',
                  currency: 'ETH',
                },
                polygon: {
                  chainName: 'Polygon',
                  rpc: 'https://polygon-rpc.com',
                  explorer: 'https://polygonscan.com',
                  currency: 'MATIC',
                },
                optimism: {
                  chainName: 'Optimism',
                  rpc: 'https://mainnet.optimism.io',
                  explorer: 'https://optimistic.etherscan.io',
                  currency: 'ETH',
                },
                arbitrum: {
                  chainName: 'Arbitrum One',
                  rpc: 'https://arb1.arbitrum.io/rpc',
                  explorer: 'https://arbiscan.io',
                  currency: 'ETH',
                },
              };
              const cp = chainParams[selectedChain];
              if (cp) {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [
                    {
                      chainId: targetChainId,
                      chainName: cp.chainName,
                      nativeCurrency: { name: cp.currency, symbol: cp.currency, decimals: 18 },
                      rpcUrls: [cp.rpc],
                      blockExplorerUrls: [cp.explorer],
                    },
                  ],
                });
              }
            }
          }
        }

        setTipStatus('signing');
        const valueWei = BigInt(Math.floor(amountUsd * 1e16)); // rough ETH amount
        const valueHex = `0x${valueWei.toString(16)}`;
        if (!window.ethereum) throw new Error('No Ethereum wallet detected');
        const hash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{ to: intent.intent.to, value: valueHex }],
        });
        setTxHash(hash as string);
        setStep('sent');
        setShowConfetti(true);
        announce(`${selectedAmount} ${selectedToken} tip sent to ${authorDisplayName}`, 'polite');
        onTipSent?.({ amount: selectedAmount, method: selectedChain, txHash: hash as string });
        return;
      }

      // 4. Fallback (server-routed tip)
      const intent = await createTip(
        authorId,
        protocol,
        selectedChain,
        selectedAmount,
        publicationId,
      );
      if (!intent) throw new Error('Failed to create tip');
      setTxHash(intent.actionUrl ?? 'ok');
      setStep('sent');
      setShowConfetti(true);
      announce(`Tip sent to ${authorDisplayName}`, 'polite');
      onTipSent?.({ amount: selectedAmount, method: selectedChain });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('confirm');
    }
  }, [
    selectedAmount,
    selectedChain,
    selectedToken,
    tipMessage,
    amountUsd,
    authorId,
    authorDisplayName,
    protocol,
    publicationId,
    solAccount,
    evmAccount,
    connectEvm,
    connectSol,
    signAndSendTransaction,
    createTip,
    fetchLightningInvoice,
    setTipStatus,
    onTipSent,
    announce,
    isLightning,
  ]);

  // ── Block explorer link builder ──────────────────────────────────────
  const explorerUrl = useMemo(() => {
    if (!txHash) return '#';
    const explorers: Record<string, string> = {
      lightning: '#',
      ethereum: 'https://etherscan.io/tx/',
      base: 'https://basescan.org/tx/',
      solana: 'https://solscan.io/tx/',
      polygon: 'https://polygonscan.com/tx/',
      optimism: 'https://optimistic.etherscan.io/tx/',
      arbitrum: 'https://arbiscan.io/tx/',
    };
    const base = explorers[selectedChain];
    return base && base !== '#' ? `${base}${txHash}` : '#';
  }, [txHash, selectedChain]);

  // ── Render button variant ────────────────────────────────────────────

  // Mini variant — icon only, for tight spaces
  if (variant === 'mini') {
    return (
      <>
        <button
          type="button"
          onClick={openTip}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`relative rounded-lg p-1.5 text-[var(--color-muted)] transition-colors hover:bg-degen-500/10 hover:text-degen-400 ${className}`}
          aria-label={`Tip ${authorDisplayName}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
            <path d="M8.5 8.5v.01" />
            <path d="M16 15a4 4 0 0 0-8 0" />
          </svg>
          {showTooltip && (
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-card)] px-2 py-1 text-[9px] text-[var(--color-muted)] opacity-100 shadow-lg transition-opacity">
              Tip {authorDisplayName}
            </span>
          )}
        </button>

        {/* Modal */}
        {isOpen && renderModal()}
      </>
    );
  }

  // Chat variant — inline in chat messages
  if (variant === 'chat') {
    return (
      <>
        <button
          type="button"
          onClick={openTip}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:bg-degen-500/10 hover:text-degen-400 ${className}`}
          aria-label={`Tip ${authorDisplayName}`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
          </svg>
          Tip
        </button>

        {isOpen && renderModal()}
      </>
    );
  }

  // Live/Stream variant — overlay style
  if (variant === 'live') {
    return (
      <>
        <button
          type="button"
          onClick={openTip}
          className={`inline-flex items-center gap-2 rounded-full bg-degen-500/20 px-4 py-2 text-sm font-semibold text-degen-400 backdrop-blur-sm transition-all hover:bg-degen-500/30 hover:scale-105 ${className}`}
          aria-label={`Send tip to ${authorDisplayName}`}
        >
          <span aria-hidden="true">⚡</span>
          <span>Tip Stream</span>
        </button>

        {isOpen && renderModal(true)}
      </>
    );
  }

  // Profile/DAO variant — larger, more prominent
  if (variant === 'profile' || variant === 'dao') {
    return (
      <>
        <button
          type="button"
          onClick={openTip}
          className={`btn-primary inline-flex items-center gap-2 text-sm ${className}`}
          aria-label={`Tip ${authorDisplayName}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
          </svg>
          {variant === 'profile' ? 'Send Tip' : 'Tip DAO'}
        </button>

        {isOpen && renderModal()}
      </>
    );
  }

  // Default (post/video) variant
  return (
    <>
      <button
        type="button"
        onClick={openTip}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-degen-500/10 hover:text-degen-400 ${className}`}
        aria-label={`Tip ${authorDisplayName}`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
          <path d="M8.5 8.5v.01" />
          <path d="M16 15a4 4 0 0 0-8 0" />
        </svg>
        <span>Tip</span>
      </button>

      {isOpen && renderModal()}
    </>
  );

  // ════════════════════════════════════════════════════════════
  // Modal Render
  // ════════════════════════════════════════════════════════════
  function renderModal(isLive = false) {
    const hasProtocol = PROTOCOL_EMOJIS[protocol];

    return (
      <dialog
        ref={dialogRef}
        open
        className="fixed inset-0 z-50 m-0 flex items-center justify-center bg-[var(--color-glass-bg)] p-0 backdrop-blur-sm"
        onClick={closeTip}
        onKeyDown={(e) => {
          if (e.key === 'Escape') closeTip();
        }}
        aria-modal="true"
        aria-label={`Tip ${authorDisplayName}`}
      >
        <section
          className={`w-full ${isLive ? 'max-w-md' : 'max-w-sm'} rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="document"
          tabIndex={-1}
        >
          {/* ── Header ───────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              {hasProtocol && (
                <span className="text-sm" title={protocol}>
                  {PROTOCOL_EMOJIS[protocol]}
                </span>
              )}
              <h2 className="text-sm font-semibold text-[var(--color-fg)]">
                {step === 'sent' ? '✓ Tip Sent!' : `Tip ${authorDisplayName}`}
              </h2>
              {hasProtocol && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase ${PROTOCOL_BADGES[protocol]?.bg ?? 'bg-gray-900/20'} ${PROTOCOL_BADGES[protocol]?.text ?? 'text-gray-400'} ${PROTOCOL_BADGES[protocol]?.border ?? 'border-gray-900/50'} border`}
                >
                  {protocol}
                </span>
              )}
            </div>
            <button
              onClick={closeTip}
              className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-fg)] transition-colors"
              type="button"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M12 4L4 12M4 4l8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="px-4 py-4">
            {/* ── Step: Select Amount ─────────────────────────────── */}
            {step === 'select-amount' && (
              <>
                {/* Chain selector (smart-recommended first) */}
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
                    Chain
                  </label>
                  {chainLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
                      <span className="text-xs text-[var(--color-muted)]">
                        Finding best chain...
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {smartChains.slice(0, 4).map((sc) => (
                        <button
                          key={sc.chain}
                          type="button"
                          onClick={() => {
                            setSelectedChain(sc.chain);
                            setIsOnchain(sc.chain !== 'lightning');
                          }}
                          className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition-all ${
                            selectedChain === sc.chain
                              ? 'border-degen-500 bg-degen-500/10'
                              : 'border-[var(--color-border)] hover:border-degen-500/30'
                          }`}
                        >
                          <span className="text-lg">{CHAIN_ICONS[sc.chain] ?? '⛓️'}</span>
                          <span className="text-[10px] font-medium text-[var(--color-fg)] capitalize">
                            {sc.chain}
                          </span>
                          {sc.rank === 1 && (
                            <span className="rounded-full bg-degen-500/20 px-1.5 py-0.5 text-[8px] font-medium text-degen-400">
                              Best
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedChain && (
                    <p className="mt-1.5 text-[10px] text-[var(--color-muted)]">
                      Fee: {feeEstimate} • {isLightning ? 'Instant' : 'Fast'} settlement
                    </p>
                  )}
                </div>

                {/* Amount presets */}
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
                    Amount {isLightning ? '(sats)' : '(USD)'}
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {presets.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => {
                          setSelectedAmount(p.value);
                        }}
                        className={`rounded-xl border px-2 py-2.5 text-center transition-all ${
                          selectedAmount === p.value
                            ? 'border-degen-500 bg-degen-500/10'
                            : 'border-[var(--color-border)] hover:border-degen-500/30'
                        }`}
                        aria-label={`${p.label}`}
                      >
                        <div className="text-xs font-semibold text-[var(--color-fg)]">
                          {p.label}
                        </div>
                        <div className="text-[9px] text-[var(--color-muted)]">
                          {!isLightning ? p.cryptoLabel : `~$${p.usdEquivalent.toFixed(2)}`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom amount input */}
                <div className="mb-4">
                  <label
                    htmlFor="tip-custom-amount"
                    className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]"
                  >
                    Or custom
                  </label>
                  <div className="relative">
                    <input
                      id="tip-custom-amount"
                      type="text"
                      value={selectedAmount}
                      onChange={(e) => {
                        setSelectedAmount(e.target.value);
                        // Deselect preset if custom typed
                      }}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm font-mono text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
                      placeholder={isLightning ? '50000' : '25'}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)]">
                      {isLightning ? 'sats' : '$'}
                    </span>
                  </div>
                </div>

                {/* Token selector (for non-Lightning) */}
                {!isLightning && selectedChain && (
                  <div className="mb-4">
                    <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
                      Token
                    </label>
                    <div className="flex gap-2">
                      {['USDC', 'ETH', 'SOL', 'DAI']
                        .filter((t) => {
                          // Show only tokens relevant to the selected chain
                          const chainTokens: Record<string, string[]> = {
                            ethereum: ['ETH', 'USDC', 'USDT', 'DAI'],
                            base: ['ETH', 'USDC'],
                            solana: ['SOL', 'USDC'],
                            polygon: ['MATIC', 'USDC'],
                            optimism: ['ETH', 'USDC'],
                            arbitrum: ['ETH', 'USDC'],
                          };
                          return chainTokens[selectedChain]?.includes(t) ?? true;
                        })
                        .map((token) => (
                          <button
                            key={token}
                            type="button"
                            onClick={() => setSelectedToken(token)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              selectedToken === token
                                ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-degen-500/30'
                            }`}
                          >
                            {token}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* USD equivalent hint */}
                {amountUsd > 0 && (
                  <p className="mb-3 text-center text-[10px] text-[var(--color-muted)]">
                    ≈ ${amountUsd.toFixed(2)} USD
                  </p>
                )}

                {/* Next button */}
                <button
                  type="button"
                  disabled={!selectedAmount || Number.parseFloat(selectedAmount) <= 0}
                  onClick={() => setStep('add-message')}
                  className="btn-primary w-full text-sm disabled:opacity-50"
                >
                  Continue
                </button>
              </>
            )}

            {/* ── Step: Add Message ──────────────────────────────────── */}
            {step === 'add-message' && (
              <>
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-degen-500/10 px-3 py-2">
                  <span className="text-lg">{CHAIN_ICONS[selectedChain] ?? '⛓️'}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--color-fg)]">
                      {selectedAmount} {isLightning ? 'sats' : selectedToken}
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)]">
                      via {selectedChain} • {feeEstimate} fee
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('select-amount')}
                    className="text-[10px] text-degen-500 hover:text-degen-400"
                  >
                    Change
                  </button>
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="tip-msg"
                    className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]"
                  >
                    Message <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    id="tip-msg"
                    value={tipMessage}
                    onChange={(e) => setTipMessage(e.target.value.slice(0, 140))}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-fg)] outline-none resize-none transition-colors focus:border-degen-500"
                    rows={2}
                    placeholder={`Say something to ${authorDisplayName}…`}
                    aria-label="Tip message"
                  />
                  <span className="mt-1 block text-right text-[10px] text-[var(--color-muted)]">
                    {tipMessage.length}/140
                  </span>
                </div>

                {/* Protocol-specific tip note */}
                {protocol === 'nostr' && (
                  <div className="mb-4 rounded-lg bg-purple-900/10 border border-purple-900/50 p-3">
                    <p className="text-xs text-purple-400">
                      ⚡ This tip will be sent as a NIP-57 Lightning Zap on Nostr
                    </p>
                  </div>
                )}
                {protocol === 'farcaster' && (
                  <div className="mb-4 rounded-lg bg-indigo-900/10 border border-indigo-900/50 p-3">
                    <p className="text-xs text-indigo-400">
                      ◈ This tip will be sent via Farcaster Frame
                    </p>
                  </div>
                )}
                {protocol === 'lens' && (
                  <div className="mb-4 rounded-lg bg-green-900/10 border border-green-900/50 p-3">
                    <p className="text-xs text-green-400">
                      ◎ This tip uses Lens Protocol collect/open action
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('select-amount')}
                    className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-card)] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('confirm')}
                    className="btn-primary flex-1 text-sm"
                  >
                    Review Tip
                  </button>
                </div>
              </>
            )}

            {/* ── Step: Confirm ──────────────────────────────────────── */}
            {step === 'confirm' && (
              <>
                <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
                      Tip Summary
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep('add-message')}
                      className="text-[10px] text-degen-500 hover:text-degen-400"
                    >
                      Edit
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-muted)]">Recipient</span>
                      <span className="font-medium text-[var(--color-fg)]">
                        {authorDisplayName}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-muted)]">Amount</span>
                      <span className="font-medium text-[var(--color-fg)]">
                        {selectedAmount} {isLightning ? 'sats' : selectedToken}
                        <span className="ml-1 text-[10px] text-[var(--color-muted)]">
                          (≈ ${amountUsd.toFixed(2)})
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-muted)]">Chain</span>
                      <span className="inline-flex items-center gap-1 font-medium text-[var(--color-fg)]">
                        {CHAIN_ICONS[selectedChain] ?? ''} {selectedChain}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-muted)]">Fee</span>
                      <span className="text-[var(--color-muted)]">{feeEstimate}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-muted)]">Protocol</span>
                      <span className="inline-flex items-center gap-1 font-medium text-[var(--color-fg)]">
                        {PROTOCOL_EMOJIS[protocol] ?? ''} {protocol}
                      </span>
                    </div>
                    {tipMessage && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[var(--color-muted)]">Message</span>
                        <span className="max-w-[180px] truncate text-right text-[var(--color-fg)]">
                          &ldquo;{tipMessage}&rdquo;
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Wallet connect prompt */}
                {selectedChain !== 'lightning' && !evmAccount && !solAccount && (
                  <div className="mb-4 rounded-lg border border-yellow-900/50 bg-yellow-900/10 p-3">
                    <p className="text-xs text-yellow-400">
                      Connect your wallet to complete this tip. You'll be prompted to sign a
                      transaction.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="mb-4 rounded-lg border border-red-900/50 bg-red-900/10 p-3">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('add-message')}
                    className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-card)] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSendTip}
                    disabled={state.status === 'signing' || state.status === 'creating'}
                    className="btn-primary flex-1 text-sm disabled:opacity-50"
                  >
                    {state.status === 'signing' || state.status === 'creating' ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Sending...
                      </span>
                    ) : (
                      `Send ${selectedAmount} ${isLightning ? 'sats' : selectedToken}`
                    )}
                  </button>
                </div>
              </>
            )}

            {/* ── Step: Sending ──────────────────────────────────────── */}
            {step === 'sending' && (
              <div className="py-8 text-center">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-degen-500/20">
                  <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
                </div>
                <p className="text-sm font-medium text-[var(--color-fg)]">Sending your tip...</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  {selectedChain === 'lightning'
                    ? 'Generating Lightning invoice'
                    : selectedChain === 'solana'
                      ? 'Confirm in your Solana wallet'
                      : 'Confirm in your wallet'}
                </p>
              </div>
            )}

            {/* ── Step: Sent (Success) ────────────────────────────────── */}
            {step === 'sent' && (
              <>
                {showConfetti && (
                  <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <span
                        key={i}
                        className="absolute text-xl"
                        style={{
                          animation: `tip-confetti ${0.8 + Math.random() * 0.6}s ease-out forwards`,
                          animationDelay: `${i * 0.04}s`,
                          left: `${20 + Math.random() * 60}%`,
                          top: '40%',
                        }}
                        aria-hidden="true"
                      >
                        {['⚡', '✨', '💎', '🔥', '⭐', '💚', '🎯', '💫', '🚀', '❤️'][i % 10]}
                      </span>
                    ))}
                  </div>
                )}

                <div className="py-6 text-center">
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-900/30">
                    <span className="text-2xl">{CHAIN_ICONS[selectedChain] ?? '✅'}</span>
                  </div>
                  <p className="mb-1 text-lg font-bold text-[var(--color-fg)]">Tip sent!</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {selectedAmount} {isLightning ? 'sats' : selectedToken} to {authorDisplayName}
                  </p>
                  {protocol && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      via {protocol} on {selectedChain}
                    </p>
                  )}

                  {txHash && explorerUrl !== '#' && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-degen-500 hover:text-degen-400"
                    >
                      View on block explorer
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M7 17L17 7M7 7h10v10" />
                      </svg>
                    </a>
                  )}

                  {contentUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const shareText = `Just tipped ${authorDisplayName} ${selectedAmount} ${isLightning ? 'sats' : selectedToken} on ${protocol}! 🎉`;
                        const shareUrl = contentUrl;
                        void navigator
                          .share?.({ title: 'Tip on DegenFeed', text: shareText, url: shareUrl })
                          .catch(() => navigator.clipboard.writeText(shareUrl));
                      }}
                      className="mt-3 w-full rounded-xl border border-degen-500/30 px-4 py-2 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/10"
                    >
                      Share this tip
                    </button>
                  )}
                </div>

                <button type="button" onClick={closeTip} className="btn-primary w-full text-sm">
                  Done
                </button>
              </>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────────────────── */}
          <div className="border-t border-[var(--color-border)] px-4 py-3">
            <p className="text-center text-[10px] text-[var(--color-muted)]">
              Powered by DegenFeed • {protocol} on {selectedChain} • No platform fees
            </p>
          </div>
        </section>

        <style>{`
          @keyframes tip-confetti {
            0% { transform: translateY(0) scale(0.3) rotate(0deg); opacity: 1; }
            40% { transform: translateY(-40px) scale(1.2) rotate(180deg); opacity: 1; }
            100% { transform: translateY(80px) scale(0.4) rotate(360deg); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            * { animation-duration: 0.01ms !important; }
          }
        `}</style>
      </dialog>
    );
  }
}
