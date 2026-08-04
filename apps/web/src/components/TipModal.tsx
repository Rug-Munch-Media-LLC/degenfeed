'use client';

import { TIP_CHAIN_CONFIG, tipOnChain } from '@degenfeed/web3';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TipPostContext } from '../hooks/useTip';
import { useTip } from '../hooks/useTip';
import { useAnnouncer } from './ScreenReaderAnnouncer';
import { useSolana } from './SolanaProvider';
import { useWeb3 } from './Web3Provider';

interface TipModalProps {
  open: boolean;
  onClose: () => void;
  recipientProtocol: string;
  recipientAuthorId: string;
  recipientDisplayName: string;
  publicationId?: string;
  postContext?: TipPostContext;
}

/** L2 chains supported for direct on-chain tipping. */
const ONCHAIN_CHAINS = ['base', 'optimism', 'arbitrum'] as const;

export function TipModal({
  open,
  onClose,
  recipientProtocol,
  recipientAuthorId,
  recipientDisplayName,
  publicationId,
  postContext,
}: TipModalProps) {
  const { state, resolveMethods, createTip, fetchLightningInvoice, setTipStatus } = useTip();
  const { account, connect: connectWallet } = useWeb3();
  const { account: solanaAccount, connect: connectSolana, signAndSendTransaction } = useSolana();
  const [amount, setAmount] = useState('0.001');
  const [tipMessage, setTipMessage] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [_invoice, setInvoice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  /** L2 chain for on-chain tipping (Base / Optimism / Arbitrum). */
  const [onchainChain, setOnchainChain] = useState<string>('base');
  /** True while a direct on-chain tx is pending confirmation. */
  const [onchainPending, setOnchainPending] = useState(false);

  // Resolve tipping methods on open + inject on-chain method client-side
  useEffect(() => {
    if (open) {
      setInvoice(null);
      setOnchainPending(false);
      resolveMethods(recipientProtocol, recipientAuthorId, postContext).then((methods) => {
        // Inject client-side "onchain_tip" method when the author has an EVM address
        const evmAddress = postContext?.author?.evmAddress;
        if (evmAddress) {
          const existingIdx = methods.findIndex((m) => m.method === 'onchain_tip');
          const onchainMethod = {
            method: 'onchain_tip',
            label: 'Direct on-chain (0% fee)',
            description:
              'ETH via DegenFeed contract on Base, Optimism, or Arbitrum — 0% fee, no intermediary',
            icon: '⛓️',
            available: true,
            address: evmAddress,
            chain: 'base',
            fee: '0% (L2 gas only)',
          };
          if (existingIdx >= 0) {
            methods[existingIdx] = { ...methods[existingIdx], ...onchainMethod };
          } else {
            methods.push(onchainMethod);
          }
          // Re-sort: keep existing ranking but put onchain near top
          methods.sort((a, b) => {
            const rank = (m: { method: string; rank?: number }) => {
              if (m.rank !== undefined) return m.rank;
              switch (m.method) {
                case 'lightning_zap':
                  return 1;
                case 'onchain_tip':
                  return 2;
                case 'ethereum':
                  return 3;
                case 'base':
                  return 3;
                case 'solana':
                  return 4;
                default:
                  return 99;
              }
            };
            return rank(a) - rank(b);
          });
        }
        // Invalidate the react state by using a fresh array reference
        // The hook's state.methods will be updated on next render
        const recommended =
          methods.find((m) => m.available && m.recommended) ?? methods.find((m) => m.available);
        // Re-select if current method is no longer available
        setSelectedMethod((prev) => {
          if (prev && methods.some((m) => m.method === prev && m.available)) return prev;
          return recommended?.method ?? null;
        });
      });
    }
  }, [open, recipientProtocol, recipientAuthorId, postContext, resolveMethods]);

  const handleClose = useCallback(() => {
    setInvoice(null);
    setOnchainPending(false);
    onClose();
  }, [onClose]);

  const { announce } = useAnnouncer();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const firstFocusable = dialog.querySelector<HTMLElement>(
      'input, button, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleTabTrap);
    return () => window.removeEventListener('keydown', handleTabTrap);
  }, [open, handleClose]);

  // == Fiat amount equivalents =============================================
  const fiatEquivalents: Record<string, string> = {
    '0.001': '≈ $1',
    '0.005': '≈ $5',
    '0.01': '≈ $10',
    '0.05': '≈ $50',
    '0.1': '≈ $100',
    '1000': '≈ $0.60',
    '5000': '≈ $3',
    '10000': '≈ $6',
    '50000': '≈ $30',
    '100000': '≈ $60',
  };

  const quickAmounts =
    selectedMethod === 'lightning_zap'
      ? ['1000', '5000', '10000', '50000', '100000']
      : ['0.001', '0.005', '0.01', '0.05', '0.1'];

  // == Confetti trigger for large tips =====================================
  const confettiAmount = useMemo(() => {
    const fiatValue = fiatEquivalents[amount];
    if (!fiatValue) return 0;
    const match = fiatValue.match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : 0;
  }, [amount, fiatEquivalents]);

  // == handleSend ======================================================

  const handleSend = useCallback(async () => {
    if (!selectedMethod || !amount) return;

    try {
      // == Direct on-chain tipping (bypasses backend) ==============
      if (selectedMethod === 'onchain_tip') {
        let ethAccount = account;
        if (!ethAccount) ethAccount = await connectWallet();
        if (!ethAccount) throw new Error('No Ethereum wallet connected');

        const recipientAddr = postContext?.author?.evmAddress;
        if (!recipientAddr) throw new Error('Recipient has no EVM address configured');

        setOnchainPending(true);
        setTipStatus('signing');

        const result = await tipOnChain({
          chain: onchainChain,
          recipient: recipientAddr as `0x${string}`,
          amount,
          message: `Tip from DegenFeed${recipientDisplayName ? ` for ${recipientDisplayName}` : ''}`,
        });

        setTipStatus('sent', result.txHash);
        setOnchainPending(false);
        if (confettiAmount >= 10) setShowConfetti(true);
        window.dispatchEvent(
          new CustomEvent('df-toast', { detail: { kind: 'success', message: '⚡ Tip sent!' } }),
        );
        announce(`Tip sent to ${recipientDisplayName}`, 'polite');
        return;
      }

      // == Ethereum / Base (backend-routed) ======================
      if (selectedMethod === 'ethereum' || selectedMethod === 'base') {
        let ethAccount = account;
        if (!ethAccount) ethAccount = await connectWallet();
        if (!ethAccount) throw new Error('No Ethereum wallet connected');

        const intent = await createTip(
          recipientAuthorId,
          recipientProtocol,
          selectedMethod,
          amount,
          publicationId,
        );
        if (!intent) return;

        // For Base chain, switch to chainId 8453
        if (selectedMethod === 'base' && window.ethereum) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x2105' }], // 8453 = Base
            });
          } catch (e: unknown) {
            const err = e as { code?: number };
            if (err.code === 4902) {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: '0x2105',
                    chainName: 'Base',
                    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                    rpcUrls: ['https://mainnet.base.org'],
                    blockExplorerUrls: ['https://basescan.org'],
                  },
                ],
              });
            }
          }
        }

        setTipStatus('signing');
        const valueHex = `0x${BigInt(Math.floor(Number.parseFloat(amount) * 1e18)).toString(16)}`;
        if (!window.ethereum) throw new Error('No Ethereum wallet detected');
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [{ to: intent.intent.to, value: valueHex }],
        });
        setTipStatus('sent', txHash as string);
        window.dispatchEvent(
          new CustomEvent('df-toast', { detail: { kind: 'success', message: '⚡ Tip sent!' } }),
        );
        if (confettiAmount >= 10) setShowConfetti(true);
        announce(`Tip sent to ${recipientDisplayName}`, 'polite');
        return;
      }

      // == Solana =================================================
      if (selectedMethod === 'solana') {
        let solAccount = solanaAccount;
        if (!solAccount) solAccount = await connectSolana();
        if (!solAccount) throw new Error('No Solana wallet connected');

        const intent = await createTip(
          recipientAuthorId,
          recipientProtocol,
          selectedMethod,
          amount,
          publicationId,
        );
        if (!intent) return;

        setTipStatus('signing');
        const { signature } = await signAndSendTransaction(
          intent.intent.to,
          Number.parseFloat(amount),
        );
        setTipStatus('sent', signature);
        window.dispatchEvent(
          new CustomEvent('df-toast', { detail: { kind: 'success', message: '⚡ Tip sent!' } }),
        );
        if (confettiAmount >= 10) setShowConfetti(true);
        announce(`Tip sent to ${recipientDisplayName}`, 'polite');
        return;
      }

      // == Lightning Zap ==========================================
      if (selectedMethod === 'lightning_zap') {
        setTipStatus('creating');
        const result = await fetchLightningInvoice(recipientAuthorId, amount, 'Tip from DegenFeed');
        if (!result) return;
        setInvoice(result.invoice);
        setTipStatus('sent', result.invoice);
        window.dispatchEvent(
          new CustomEvent('df-toast', { detail: { kind: 'success', message: '⚡ Tip sent!' } }),
        );
        announce(`Tip sent to ${recipientDisplayName}`, 'polite');
        return;
      }

      // == Lens Collect ===========================================
      if (selectedMethod === 'lens_collect') {
        const intent = await createTip(
          recipientAuthorId,
          recipientProtocol,
          selectedMethod,
          amount,
          publicationId,
        );
        if (!intent) return;

        setTipStatus('signing');
        const provider = window.ethereum;
        if (!provider) throw new Error('No Ethereum wallet detected');

        const requiredChainId = intent.intent.chainId ?? 137;
        const requiredChainHex = `0x${requiredChainId.toString(16)}`;
        try {
          const currentChain = await provider.request({ method: 'eth_chainId' });
          if (currentChain !== requiredChainHex) {
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: requiredChainHex }],
            });
          }
        } catch {
          // proceed anyway
        }

        const txHash = await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: account,
              to: intent.intent.to,
              data: intent.intent.data,
              value: intent.intent.value,
              chainId: `0x${(intent.intent.chainId ?? 137).toString(16)}`,
            },
          ],
        });
        setTipStatus('sent', txHash as string);
        window.dispatchEvent(
          new CustomEvent('df-toast', { detail: { kind: 'success', message: '⚡ Tip sent!' } }),
        );
        if (confettiAmount >= 10) setShowConfetti(true);
        announce(`Tip sent to ${recipientDisplayName}`, 'polite');
        return;
      }

      // == Fallback ===============================================
      const intent = await createTip(
        recipientAuthorId,
        recipientProtocol,
        selectedMethod,
        amount,
        publicationId,
      );
      if (!intent) return;
      setTipStatus('sent', intent.actionUrl || 'ok');
      window.dispatchEvent(
        new CustomEvent('df-toast', { detail: { kind: 'success', message: '⚡ Tip sent!' } }),
      );
      announce(`Tip sent to ${recipientDisplayName}`, 'polite');
    } catch (err) {
      setOnchainPending(false);
      setTipStatus('failed', undefined, err instanceof Error ? err.message : String(err));
    }
  }, [
    selectedMethod,
    amount,
    onchainChain,
    account,
    solanaAccount,
    connectWallet,
    connectSolana,
    signAndSendTransaction,
    createTip,
    fetchLightningInvoice,
    setTipStatus,
    recipientAuthorId,
    recipientProtocol,
    publicationId,
    postContext,
    recipientDisplayName,
    announce,
    confettiAmount,
  ]);

  if (!open) return null;

  const availableMethods = state.methods.filter((m) => m.available);
  const selected = state.methods.find((m) => m.method === selectedMethod);
  const isOnchain = selectedMethod === 'onchain_tip';
  const chainCfg = isOnchain && onchainChain ? TIP_CHAIN_CONFIG[onchainChain] : null;

  // Derive block explorer from chain config for the on-chain method
  const explorerUrlForMethod = (method: string, txHash: string): string => {
    switch (method) {
      case 'ethereum':
        return `https://etherscan.io/tx/${txHash}`;
      case 'base':
        return `https://basescan.org/tx/${txHash}`;
      case 'optimism':
        return `https://optimistic.etherscan.io/tx/${txHash}`;
      case 'arbitrum':
        return `https://arbiscan.io/tx/${txHash}`;
      case 'onchain_tip':
        return chainCfg ? `${chainCfg.explorer}/tx/${txHash}` : `https://basescan.org/tx/${txHash}`;
      case 'solana':
        return `https://solscan.io/tx/${txHash}`;
      case 'lens_collect':
        return `https://polygonscan.com/tx/${txHash}`;
      default:
        return '#';
    }
  };

  return (
    <dialog
      ref={dialogRef}
      open
      className="fixed inset-0 z-50 m-0 flex items-center justify-center bg-[var(--color-glass-bg)] p-0 backdrop-blur-sm open:m-0 open:p-0"
      onClick={handleClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleClose();
      }}
      aria-modal="true"
      aria-label={`Tip ${recipientDisplayName}`}
    >
      <section
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">
            Tip {recipientDisplayName}
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-fg)] transition-colors"
            type="button"
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-labelledby="closeTitle"
            >
              <title id="closeTitle">Close</title>
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
          {state.status === 'resolving' ? (
            <div className="py-8 text-center">
              <div className="mb-3 inline-block animate-spin text-2xl">⚡</div>
              <p className="text-sm text-[var(--color-muted)]">Loading tipping options...</p>
            </div>
          ) : state.methods.length === 0 || availableMethods.length === 0 ? (
            <div className="py-8 text-center">
              <p className="mb-2 text-[var(--color-muted)]">
                No tipping methods available for this creator
              </p>
              <p className="mb-4 text-xs text-[var(--color-muted)]">
                They may not have linked any wallets or payment accounts yet.
              </p>
              <a
                href="/profile/monetization"
                className="inline-block rounded-lg bg-degen-500/20 px-4 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/30 transition-colors"
              >
                Set up tipping
              </a>
            </div>
          ) : (
            <>
              {/* == Method selector =================================== */}
              <div className="mb-4">
                <label
                  htmlFor="tip-method"
                  className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]"
                >
                  Method
                </label>
                <div className="space-y-1.5">
                  {availableMethods.map((m) => (
                    <button
                      key={m.method}
                      type="button"
                      onClick={() => setSelectedMethod(m.method)}
                      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                        selectedMethod === m.method
                          ? 'border-degen-500 bg-degen-500/10'
                          : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border)]'
                      }`}
                    >
                      <span className="text-lg">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-[var(--color-fg)]">
                            {m.label}
                          </div>
                          {m.recommended && (
                            <span className="shrink-0 rounded-full bg-degen-500/20 px-2 py-0.5 text-[10px] font-medium text-degen-400">
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--color-muted)] truncate">
                          {m.description}
                        </div>
                      </div>
                      {m.fee && (
                        <span className="shrink-0 rounded-full bg-[var(--color-card)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">
                          Fee: {m.fee}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* == Amount ============================================ */}
              <div className="mb-4">
                <label
                  htmlFor="tip-amount"
                  className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]"
                >
                  Amount
                </label>
                <div className="relative mb-2">
                  <input
                    id="tip-amount"
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-lg font-mono text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
                    placeholder={selectedMethod === 'lightning_zap' ? '1000' : '0.001'}
                    aria-label="Tip amount"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--color-muted)]">
                    {selected?.method === 'lightning_zap'
                      ? 'sats'
                      : selected?.method === 'ethereum'
                        ? 'ETH'
                        : selected?.method === 'base'
                          ? 'ETH (Base)'
                          : selected?.method === 'solana'
                            ? 'SOL'
                            : isOnchain
                              ? `ETH (${chainCfg?.name ?? 'Base'})`
                              : ''}
                  </span>
                </div>
                <div className="flex gap-2">
                  {quickAmounts.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAmount(a)}
                      className={`group relative rounded-lg px-3 py-1 text-xs font-medium transition-colors border ${
                        amount === a
                          ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                          : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border)]'
                      }`}
                    >
                      <span className="font-mono">{a}</span>
                      {fiatEquivalents[a] && (
                        <span className="ml-1 text-[9px] opacity-60">{fiatEquivalents[a]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* == Tip message (optional) ============================ */}
              <div className="mb-4">
                <label
                  htmlFor="tip-message"
                  className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]"
                >
                  Message{' '}
                  <span className="font-normal normal-case text-[var(--color-muted)]">
                    (optional)
                  </span>
                </label>
                <div className="relative">
                  <textarea
                    id="tip-message"
                    value={tipMessage}
                    onChange={(e) => setTipMessage(e.target.value.slice(0, 140))}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-fg)] outline-none resize-none transition-colors focus:border-degen-500"
                    rows={2}
                    placeholder={`Say something to ${recipientDisplayName}…`}
                    aria-label="Tip message (optional)"
                  />
                  <span className="absolute bottom-2 right-3 text-[10px] text-[var(--color-muted)]">
                    {tipMessage.length}/140
                  </span>
                </div>
              </div>

              {/* == Fiat equivalent hint == */}
              {fiatEquivalents[amount] && (
                <p className="mb-3 text-[10px] text-[var(--color-muted)]">
                  {fiatEquivalents[amount]} USD equivalent at current rates
                </p>
              )}

              {/* == Confetti overlay == */}
              {showConfetti && (
                <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute text-lg"
                      style={{
                        animation: `tip-confetti ${1 + Math.random() * 0.6}s ease-out forwards`,
                        animationDelay: `${i * 0.03}s`,
                        left: `${25 + Math.random() * 50}%`,
                        top: '40%',
                      }}
                      aria-hidden="true"
                    >
                      {['✨', '⚡', '💎', '🔥', '⭐', '💚', '🎯', '💫'][i % 8]}
                    </span>
                  ))}
                </div>
              )}

              {/* == Chain selector (on-chain only) ==================== */}
              {isOnchain && (
                <div className="mb-4">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
                    Network
                  </span>
                  <div className="flex gap-2">
                    {ONCHAIN_CHAINS.map((chain) => {
                      const cfg = TIP_CHAIN_CONFIG[chain];
                      return (
                        <button
                          key={chain}
                          type="button"
                          onClick={() => setOnchainChain(chain)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-center text-xs font-medium transition-colors ${
                            onchainChain === chain
                              ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                              : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border)]'
                          }`}
                        >
                          {cfg?.name ?? chain}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-[var(--color-muted)]">
                    {chainCfg
                      ? `L2 gas only — typically $0.01-0.10 on ${chainCfg.name}`
                      : 'Select an L2 network'}
                  </p>
                </div>
              )}

              {/* == Wallet connect reminders =========================== */}
              {selectedMethod === 'ethereum' && !account && (
                <div className="mb-4 rounded-lg border border-yellow-900/50 bg-yellow-900/10 p-3">
                  <p className="text-xs text-yellow-400">
                    Connect your Ethereum wallet (MetaMask, Rabby, Rainbow) to send this tip.
                  </p>
                </div>
              )}
              {isOnchain && !account && (
                <div className="mb-4 rounded-lg border border-cyan-900/50 bg-cyan-900/10 p-3">
                  <p className="text-xs text-cyan-400">
                    Connect your wallet to send a direct on-chain tip. Only L2 gas fees apply — 0%
                    platform fee.
                  </p>
                </div>
              )}
              {selectedMethod === 'solana' && !solanaAccount && (
                <div className="mb-4 rounded-lg border border-purple-900/50 bg-purple-900/10 p-3">
                  <p className="text-xs text-purple-400">
                    Connect your Solana wallet (Phantom, Solflare, Backpack) to send this tip.
                  </p>
                </div>
              )}

              {/* == Solana Blink share ================================= */}
              {selectedMethod === 'solana' && (
                <button
                  type="button"
                  onClick={() => {
                    const recipient =
                      selected?.address ?? postContext?.author?.solanaAddress ?? recipientAuthorId;
                    const url = `https://app.degenfeed.xyz/api/blink/tip?recipient=${encodeURIComponent(recipient)}&amount=${encodeURIComponent(amount)}`;
                    void navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="mb-4 w-full rounded-lg border border-purple-900/50 bg-purple-900/10 px-3 py-2 text-xs font-medium text-purple-400 hover:bg-purple-900/20 transition-colors"
                >
                  {copied ? 'Blink URL copied!' : 'Share as Blink'}
                </button>
              )}

              {/* == Send button ======================================== */}
              <button
                type="button"
                disabled={
                  !selectedMethod ||
                  ['creating', 'signing', 'sending'].includes(state.status) ||
                  onchainPending
                }
                onClick={handleSend}
                className="btn-primary w-full text-sm disabled:opacity-50"
              >
                {onchainPending || state.status === 'signing'
                  ? onchainPending
                    ? `Confirm on ${chainCfg?.name ?? 'wallet'}...`
                    : 'Sign in wallet...'
                  : state.status === 'creating'
                    ? 'Preparing...'
                    : state.status === 'sending'
                      ? 'Sending...'
                      : state.status === 'sent'
                        ? '✓ Sent!'
                        : state.status === 'failed'
                          ? 'Failed - Try Again'
                          : 'Send Tip'}
              </button>

              {state.status === 'failed' && state.error && (
                <p className="mt-2 text-xs text-red-400 text-center">{state.error}</p>
              )}

              {/* == Success view ======================================= */}
              {state.status === 'sent' && state.txHash && (
                <div className="mt-3 rounded-lg bg-green-900/20 border border-green-900/50 p-3">
                  {selectedMethod === 'lightning_zap' ? (
                    <>
                      <p className="mb-2 text-xs text-green-400">Lightning Invoice Ready</p>
                      <div className="mb-2 flex justify-center">
                        {typeof window !== 'undefined' && (
                          <div className="rounded-xl bg-white p-2">
                            <QRCodeSVG value={`lightning:${state.txHash}`} size={160} />
                          </div>
                        )}
                      </div>
                      <p className="mb-2 text-center text-[10px] text-[var(--color-muted)]">
                        Scan with any Lightning wallet
                      </p>
                      <div className="flex gap-2">
                        <code className="flex-1 rounded bg-[var(--color-card)] px-2 py-1 text-[10px] text-[var(--color-muted)] font-mono truncate">
                          {state.txHash.slice(0, 40)}...
                        </code>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(state.txHash || '')}
                          className="shrink-0 rounded-lg bg-[var(--color-card)] px-2 py-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                        >
                          Copy Invoice
                        </button>
                      </div>
                      <a
                        href={`lightning:${state.txHash}`}
                        className="mt-2 block text-center text-xs text-degen-500 hover:text-degen-400"
                      >
                        Open in wallet
                      </a>
                    </>
                  ) : (
                    <>
                      <p className="mb-1 text-xs text-green-400">
                        {isOnchain
                          ? `Tip sent on ${chainCfg?.name ?? 'Base'}!`
                          : 'Tip sent successfully!'}
                      </p>
                      <div className="flex items-center gap-2">
                        <a
                          href={explorerUrlForMethod(selectedMethod ?? '', state.txHash)}
                          target="_blank"
                          className="flex-1 text-xs text-degen-500 hover:text-degen-400 break-all"
                          rel="noopener"
                        >
                          {isOnchain
                            ? `View on ${chainCfg?.explorer?.replace('https://', '') ?? 'block explorer'}`
                            : 'View transaction'}
                        </a>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(state.txHash || '')}
                          className="shrink-0 rounded-lg bg-[var(--color-card)] px-2 py-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                        >
                          Copy Tx
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <p className="text-center text-[10px] text-[var(--color-muted)]">
            Powered by DegenFeed • Cross-platform tipping • No platform fees
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
