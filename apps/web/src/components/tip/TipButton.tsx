'use client';

/**
 * @degenfeed/web — TipButton
 *
 * Thin trigger component that delegates the tip modal to TipModal.
 * Supports multiple variants: mini, chat, live, profile/dao, post/video (default).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TipMethod } from '../../hooks/useTip';
import { useAnnouncer } from '../ScreenReaderAnnouncer';
import { useSolana } from '../SolanaProvider';
import { useWeb3 } from '../Web3Provider';
import TipModal from './TipModal';
import type { SmartChainOption, TipStep } from './useTip';
import { FIAT_PRESETS, SATS_PRESETS, useTip } from './useTip';

export interface TipButtonContext {
  protocol: string;
  authorId: string;
  authorDisplayName: string;
  publicationId?: string;
  contentUrl?: string;
  preconfiguredMethods?: TipMethod[];
  variant?: 'post' | 'video' | 'live' | 'chat' | 'profile' | 'dao' | 'mini';
  onTipSent?: (result: { amount: string; method: string; txHash?: string }) => void;
  className?: string;
}

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
  const {account: evmAccount, connect: connectEvm} = useWeb3();  const { account: solAccount, connect: connectSol, signAndSendTransaction } = useSolana();
  const { announce } = useAnnouncer();

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
  const confettiTimer = useRef<ReturnType<typeof setTimeout>>();

  const feeEstimate = useMemo(() => {
    if (!selectedChain) return '\u2014';
    const fees: Record<string, string> = {
      lightning: '< $0.001',
      ethereum: '~$0.50-5.00',
      base: '< $0.01',
      solana: '< $0.01',
      polygon: '~$0.01-0.05',
      optimism: '~$0.01-0.05',
      arbitrum: '~$0.01-0.05',
    };
    return fees[selectedChain] ?? '\u2014';
  }, [selectedChain]);

  const isLightning = selectedChain === 'lightning';
  const presets = isLightning ? SATS_PRESETS : FIAT_PRESETS;

  const amountUsd = useMemo(() => {
    const preset = presets.find((p) => p.value === selectedAmount);
    if (preset) return preset.usdEquivalent;
    if (isLightning) return Number.parseFloat(selectedAmount) * 0.0006;
    return Number.parseFloat(selectedAmount) || 0;
  }, [selectedAmount, presets, isLightning]);

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

  const openTip = useCallback(async () => {
    setIsOpen(true);
    setStep('select-amount');
    setError(undefined);
    setTxHash(undefined);
    setShowConfetti(false);
    setTipMessage('');

    setChainLoading(true);
    try {
      const res = await fetch(
        '/api/tip/smart-chain?senderChains=lightning,solana,base,ethereum&recipientHasEvm=true&recipientHasSolana=true&recipientHasLightning=true&amountUsd=10',
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

    if (preconfiguredMethods) {
      // Use pre-configured methods
    } else {
      await resolveMethods(protocol, authorId);
    }
  }, [protocol, authorId, resolveMethods, preconfiguredMethods]);

  const closeTip = useCallback(() => {
    setIsOpen(false);
    setStep('select-amount');
    setError(undefined);
    setTxHash(undefined);
    setTipMessage('');
    setShowConfetti(false);
  }, []);

  useEffect(() => {
    return () => {
      if (confettiTimer.current) clearTimeout(confettiTimer.current);
    };
  }, []);

  const handleSendTip = useCallback(async () => {
    if (!selectedAmount || !selectedChain) return;
    setStep('sending');
    setError(undefined);

    try {
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

      if (selectedChain === 'solana') {
        let solAccountAddr = solAccount;
        if (!solAccountAddr) solAccountAddr = await connectSol();
        if (!solAccountAddr) throw new Error('Please connect your Solana wallet');

        const intent = await createTip(authorId, protocol, 'solana', selectedAmount, publicationId);
        if (!intent) throw new Error('Failed to create tip intent');

        setTipStatus('signing');
        const amountInSol = isLightning
          ? Number.parseFloat(selectedAmount) * 0.0006
          : Number.parseFloat(selectedAmount) / 170;
        const result = await signAndSendTransaction(intent.intent.to, amountInSol);
        setTxHash(result.signature);
        setStep('sent');
        setShowConfetti(true);
        announce(`${selectedAmount} SOL tip sent to ${authorDisplayName}`, 'polite');
        onTipSent?.({ amount: selectedAmount, method: 'solana', txHash: result.signature });
        return;
      }

      if (['ethereum', 'base', 'polygon', 'optimism', 'arbitrum'].includes(selectedChain)) {
        let evmAddr = evmAccount;
        if (!evmAddr) evmAddr = await connectEvm();
        if (!evmAddr) throw new Error('Please connect your Ethereum wallet');

        const methodName = selectedChain === 'base' ? 'base' : 'ethereum';
        const intent = await createTip(
          authorId,
          protocol,
          methodName,
          selectedAmount,
          publicationId,
        );
        if (!intent) throw new Error('Failed to create tip intent');

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
        const valueWei = BigInt(Math.floor(amountUsd * 1e16));
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

  const handleShareTip = useCallback(() => {
    const shareText = `Just tipped ${authorDisplayName} ${selectedAmount} ${isLightning ? 'sats' : selectedToken} on ${protocol}! 🎉`;
    const shareUrl = contentUrl;
    void navigator
      .share?.({ title: 'Tip on DegenFeed', text: shareText, url: shareUrl })
      .catch(() => navigator.clipboard.writeText(shareUrl ?? ''));
  }, [authorDisplayName, selectedAmount, isLightning, selectedToken, protocol, contentUrl]);

  const modal = (
    <TipModal
      open={isOpen}
      step={step}
      authorDisplayName={authorDisplayName}
      protocol={protocol}
      smartChains={smartChains}
      selectedChain={selectedChain}
      onSelectChain={(chain) => {
        setSelectedChain(chain);
        setIsOnchain(chain !== 'lightning');
      }}
      chainLoading={chainLoading}
      selectedAmount={selectedAmount}
      onSelectAmount={setSelectedAmount}
      isLightning={isLightning}
      selectedToken={selectedToken}
      onSelectToken={setSelectedToken}
      amountUsd={amountUsd}
      tipMessage={tipMessage}
      onMessageChange={setTipMessage}
      feeEstimate={feeEstimate}
      hasEvm={!!evmAccount}
      hasSol={!!solAccount}
      sending={state.status === 'signing' || state.status === 'creating'}
      error={error}
      txHash={txHash}
      explorerUrl={explorerUrl}
      contentUrl={contentUrl}
      showConfetti={showConfetti}
      onContinue={() => setStep(step === 'select-amount' ? 'add-message' : 'confirm')}
      onBack={() =>
        setStep(
          step === 'add-message'
            ? 'select-amount'
            : step === 'confirm'
              ? 'add-message'
              : 'select-amount',
        )
      }
      onSend={handleSendTip}
      onClose={closeTip}
      onShareTip={handleShareTip}
    />
  );

  // Mini variant
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
        {modal}
      </>
    );
  }

  // Chat variant
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
        {modal}
      </>
    );
  }

  // Live variant
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
        {modal}
      </>
    );
  }

  // Profile/DAO variant
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
        {modal}
      </>
    );
  }

  // Default (post/video)
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
      {modal}
    </>
  );
}
