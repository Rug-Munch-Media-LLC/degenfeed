"use client";

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTip, type TipMethod } from '../hooks/useTip';
import { useWeb3 } from './Web3Provider';
import { useSolana } from './SolanaProvider';

interface TipModalProps {
  open: boolean;
  onClose: () => void;
  recipientProtocol: string;
  recipientAuthorId: string;
  recipientDisplayName: string;
  publicationId?: string;
}

export function TipModal({ open, onClose, recipientProtocol, recipientAuthorId, recipientDisplayName, publicationId }: TipModalProps) {
  const { state, resolveMethods, createTip, fetchLightningInvoice, setTipStatus } = useTip();
  const { account, connect: connectWallet } = useWeb3();
  const { account: solanaAccount, connect: connectSolana, signAndSendTransaction } = useSolana();
  const [amount, setAmount] = useState('0.001');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<string | null>(null);

  // Resolve tipping methods on open
  useEffect(() => {
    if (open) {
      setInvoice(null);
      resolveMethods(recipientProtocol, recipientAuthorId).then(methods => {
        const firstAvailable = methods.find(m => m.available);
        if (firstAvailable) setSelectedMethod(firstAvailable.method);
      });
    }
  }, [open, recipientProtocol, recipientAuthorId, resolveMethods]);

  const handleClose = useCallback(() => {
    setInvoice(null);
    onClose();
  }, [onClose]);

  const handleSend = useCallback(async () => {
    if (!selectedMethod || !amount) return;

    try {
      if (selectedMethod === 'ethereum') {
        let ethAccount = account;
        if (!ethAccount) ethAccount = await connectWallet();
        if (!ethAccount) throw new Error('No Ethereum wallet connected');

        const intent = await createTip(recipientAuthorId, recipientProtocol, selectedMethod, amount, publicationId);
        if (!intent) return;

        setTipStatus('signing');
        const valueHex = '0x' + (BigInt(Math.floor(parseFloat(amount) * 1e18))).toString(16);
        const txHash = await (window as any).ethereum.request({
          method: 'eth_sendTransaction',
          params: [{ to: intent.intent.to, value: valueHex }],
        });
        setTipStatus('sent', txHash);
        return;
      }

      if (selectedMethod === 'solana') {
        let solAccount = solanaAccount;
        if (!solAccount) solAccount = await connectSolana();
        if (!solAccount) throw new Error('No Solana wallet connected');

        const intent = await createTip(recipientAuthorId, recipientProtocol, selectedMethod, amount, publicationId);
        if (!intent) return;

        setTipStatus('signing');
        const { signature } = await signAndSendTransaction(intent.intent.to, parseFloat(amount));
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
        const intent = await createTip(recipientAuthorId, recipientProtocol, selectedMethod, amount, publicationId);
        if (!intent) return;

        setTipStatus('signing');
        const provider = (window as any).ethereum;
        if (!provider) throw new Error('No Ethereum wallet detected');

        const txHash = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: account,
            to: intent.intent.to,
            data: intent.intent.data,
            value: intent.intent.value,
            chainId: '0x' + (intent.intent.chainId ?? 137).toString(16),
          }],
        });
        setTipStatus('sent', txHash);
        return;
      }

      // Fallback: Frame / other methods
      const intent = await createTip(recipientAuthorId, recipientProtocol, selectedMethod, amount, publicationId);
      if (!intent) return;
      setTipStatus('sent', intent.actionUrl || 'ok');

    } catch (err: any) {
      setTipStatus('failed', undefined, err.message || String(err));
    }
  }, [selectedMethod, amount, account, solanaAccount, connectWallet, connectSolana, signAndSendTransaction, createTip, fetchLightningInvoice, setTipStatus, recipientAuthorId, recipientProtocol]);

  const quickAmounts = selectedMethod === 'lightning_zap'
    ? ['1000', '5000', '10000', '50000', '100000']
    : ['0.001', '0.005', '0.01', '0.05', '0.1'];

  if (!open) return null;

  const availableMethods = state.methods.filter(m => m.available);
  const selected = state.methods.find(m => m.method === selectedMethod);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={"Tip " + recipientDisplayName}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Tip {recipientDisplayName}</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            type="button"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4">
          {state.status === 'resolving' ? (
            <div className="py-8 text-center">
              <div className="mb-3 inline-block animate-spin text-2xl">⚡</div>
              <p className="text-sm text-gray-500">Loading tipping options...</p>
            </div>
          ) : state.methods.length === 0 ? (
            <div className="py-8 text-center">
              <p className="mb-2 text-gray-500">No tipping methods available for this creator</p>
              <p className="text-xs text-gray-600">They may not have linked any wallets or payment accounts yet.</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-gray-500">Method</label>
                <div className="space-y-1.5">
                  {availableMethods.map(m => (
                    <button
                      key={m.method}
                      type="button"
                      onClick={() => setSelectedMethod(m.method)}
                      className={
                        'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ' +
                        (selectedMethod === m.method
                          ? 'border-degen-500 bg-degen-500/10'
                          : 'border-gray-800 bg-gray-900/50 hover:border-gray-700')
                      }
                    >
                      <span className="text-lg">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">{m.label}</div>
                        <div className="text-xs text-gray-500 truncate">{m.description}</div>
                      </div>
                      {m.fee && (
                        <span className="shrink-0 rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">
                          Fee: {m.fee}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-gray-500">Amount</label>
                <div className="relative mb-2">
                  <input
                    type="text"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 text-lg font-mono text-white outline-none focus:border-degen-500 transition-colors"
                    placeholder={selectedMethod === 'lightning_zap' ? '1000' : '0.001'}
                    aria-label="Tip amount"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    {selected?.method === 'lightning_zap' ? 'sats' :
                     selected?.method === 'ethereum' ? 'ETH' :
                     selected?.method === 'solana' ? 'SOL' : ''}
                  </span>
                </div>
                <div className="flex gap-2">
                  {quickAmounts.map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAmount(a)}
                      className={
                        'rounded-lg px-3 py-1 text-xs font-medium transition-colors border ' +
                        (amount === a ? 'border-degen-500 bg-degen-500/20 text-degen-400' : 'border-gray-800 text-gray-500 hover:border-gray-700')
                      }
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {selectedMethod === 'ethereum' && !account && (
                <div className="mb-4 rounded-lg border border-yellow-900/50 bg-yellow-900/10 p-3">
                  <p className="text-xs text-yellow-400">Connect your Ethereum wallet (MetaMask, Rabby, Rainbow) to send this tip.</p>
                </div>
              )}
              {selectedMethod === 'solana' && !solanaAccount && (
                <div className="mb-4 rounded-lg border border-purple-900/50 bg-purple-900/10 p-3">
                  <p className="text-xs text-purple-400">Connect your Solana wallet (Phantom, Solflare, Backpack) to send this tip.</p>
                </div>
              )}

              <button
                type="button"
                disabled={!selectedMethod || ['creating', 'signing', 'sending'].includes(state.status)}
                onClick={handleSend}
                className="btn-primary w-full text-sm disabled:opacity-50"
              >
                {state.status === 'signing' ? 'Sign in wallet...' :
                 state.status === 'creating' ? 'Preparing...' :
                 state.status === 'sending' ? 'Sending...' :
                 state.status === 'sent' ? '✓ Sent!' :
                 state.status === 'failed' ? 'Failed - Try Again' :
                 'Send Tip'}
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
                        {typeof window !== "undefined" && (
                          <div className="rounded-xl bg-white p-2">
                            <QRCodeSVG value={"lightning:" + state.txHash} size={160} />
                          </div>
                        )}
                      </div>
                      <p className="mb-2 text-center text-[10px] text-gray-500">Scan with any Lightning wallet</p>
                      <div className="flex gap-2">
                        <code className="flex-1 rounded bg-gray-900 px-2 py-1 text-[10px] text-gray-400 font-mono truncate">
                          {state.txHash.slice(0, 40)}...
                        </code>
                        <button
                          onClick={() => navigator.clipboard.writeText(state.txHash || "")}
                          className="shrink-0 rounded-lg bg-gray-800 px-2 py-1 text-[10px] text-gray-400 hover:text-white transition-colors"
                          type="button"
                        >
                          Copy Invoice
                        </button>
                      </div>
                      <a
                        href={"lightning:" + state.txHash}
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

        <div className="border-t border-gray-800 px-4 py-3">
          <p className="text-center text-[10px] text-gray-600">Powered by DegenFeed • Cross-platform tipping • No platform fees</p>
        </div>
      </div>
    </div>
  );
}
