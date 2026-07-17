'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TipPostContext } from '../hooks/useTip';
import { useTip } from '../hooks/useTip';
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
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [_invoice, setInvoice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Resolve tipping methods on open
  useEffect(() => {
    if (open) {
      setInvoice(null);
      resolveMethods(recipientProtocol, recipientAuthorId, postContext).then((methods) => {
        const recommended = methods.find((m) => m.available && m.recommended);
        const firstAvailable = methods.find((m) => m.available);
        setSelectedMethod(recommended?.method ?? firstAvailable?.method ?? null);
      });
    }
  }, [open, recipientProtocol, recipientAuthorId, postContext, resolveMethods]);

  const handleClose = useCallback(() => {
    setInvoice(null);
    onClose();
  }, [onClose]);

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

  const handleSend = useCallback(async () => {
    if (!selectedMethod || !amount) return;

    try {
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
          } catch (e: any) {
            if (e.code === 4902) {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{ chainId: '0x2105', chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }],
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
        return;
      }

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
        return;
      }

      if (selectedMethod === 'lightning_zap') {
        setTipStatus('creating');
        const result = await fetchLightningInvoice(recipientAuthorId, amount, 'Tip from DegenFeed');
        if (!result) return;
        setInvoice(result.invoice);
        setTipStatus('sent', result.invoice);
        return;
      }

      // Lens Collect
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

        // Ensure the wallet is on the correct chain for this tip
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
          // User rejected chain switch or chain not added — proceed anyway
          // and let eth_sendTransaction surface the real error.
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
        return;
      }

      // Fallback: Frame / other methods
      const intent = await createTip(
        recipientAuthorId,
        recipientProtocol,
        selectedMethod,
        amount,
        publicationId,
      );
      if (!intent) return;
      setTipStatus('sent', intent.actionUrl || 'ok');
    } catch (err) {
      setTipStatus('failed', undefined, err instanceof Error ? err.message : String(err));
    }
  }, [
    selectedMethod,
    amount,
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
  ]);

  const quickAmounts =
    selectedMethod === 'lightning_zap'
      ? ['1000', '5000', '10000', '50000', '100000']
      : ['0.001', '0.005', '0.01', '0.05', '0.1'];

  if (!open) return null;

  const availableMethods = state.methods.filter((m) => m.available);
  const selected = state.methods.find((m) => m.method === selectedMethod);

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
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">Tip {recipientDisplayName}</h2>
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
              <p className="mb-2 text-[var(--color-muted)]">No tipping methods available for this creator</p>
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
                          : 'border-[var(--color-border)] bg-[var(--color-card)]/50 hover:border-[var(--color-border)]'
                      }`}
                    >
                      <span className="text-lg">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-[var(--color-fg)]">{m.label}</div>
                          {m.recommended && (
                            <span className="shrink-0 rounded-full bg-degen-500/20 px-2 py-0.5 text-[10px] font-medium text-degen-400">
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--color-muted)] truncate">{m.description}</div>
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
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/50 px-4 py-3 text-lg font-mono text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
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
                          : ''}
                  </span>
                </div>
                <div className="flex gap-2">
                  {quickAmounts.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAmount(a)}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors border ${
                        amount === a
                          ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                          : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border)]'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {selectedMethod === 'ethereum' && !account && (
                <div className="mb-4 rounded-lg border border-yellow-900/50 bg-yellow-900/10 p-3">
                  <p className="text-xs text-yellow-400">
                    Connect your Ethereum wallet (MetaMask, Rabby, Rainbow) to send this tip.
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

              <button
                type="button"
                disabled={
                  !selectedMethod || ['creating', 'signing', 'sending'].includes(state.status)
                }
                onClick={handleSend}
                className="btn-primary w-full text-sm disabled:opacity-50"
              >
                {state.status === 'signing'
                  ? 'Sign in wallet...'
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
                          onClick={() => navigator.clipboard.writeText(state.txHash || '')}
                          className="shrink-0 rounded-lg bg-[var(--color-card)] px-2 py-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                          type="button"
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
                      <p className="mb-1 text-xs text-green-400">Tip sent successfully!</p>
                      <a
                        href={
                          selectedMethod === 'ethereum'
                            ? `https://etherscan.io/tx/${state.txHash}`
                            : selectedMethod === 'base'
                            ? `https://basescan.org/tx/${state.txHash}`
                            : selectedMethod === 'solana'
                              ? `https://solscan.io/tx/${state.txHash}`
                              : selectedMethod === 'lens_collect'
                                ? `https://polygonscan.com/tx/${state.txHash}`
                                : '#'
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-degen-500 hover:text-degen-400 break-all"
                      >
                        View transaction
                      </a>
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
    </dialog>
  );
}
