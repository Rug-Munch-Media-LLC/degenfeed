"use client";

import { useState, useCallback, useEffect } from 'react';
import { useWeb3 } from '../components/Web3Provider';
import { useAuth } from '../components/AuthProvider';

export interface TipMethod {
  method: string;
  label: string;
  description: string;
  icon: string;
  available: boolean;
  address?: string;
  chain?: string;
  minAmount?: number;
  fee?: string;
}

export interface TipState {
  methods: TipMethod[];
  selectedMethod: string | null;
  amount: string;
  status: 'idle' | 'resolving' | 'creating' | 'signing' | 'sending' | 'sent' | 'failed';
  error?: string;
  txHash?: string;
}

const INITIAL: TipState = {
  methods: [],
  selectedMethod: null,
  amount: '0.001',
  status: 'idle',
};

export function useTip() {
  const { account, isConnected, signMessage, connect } = useWeb3();
  const { walletAddress } = useAuth();
  const [state, setState] = useState<TipState>(INITIAL);

  const reset = useCallback(() => setState(INITIAL), []);

  // Resolve tipping methods for a given recipient
  const resolveMethods = useCallback(async (protocol: string, authorId: string) => {
    setState(s => ({ ...s, status: 'resolving' }));
    try {
      const res = await fetch(`/api/tip/resolve?protocol=${encodeURIComponent(protocol)}&authorId=${encodeURIComponent(authorId)}`);
      const data = await res.json();
      const methods: TipMethod[] = data.methods || [];

      // If tipper has a wallet, all crypto methods are available
      // If not, only methods that don't need a wallet (like external links)
      const tipperHasWallet = !!account || !!walletAddress;

      const enriched = methods.map(m => ({
        ...m,
        available: m.available && (
          m.method === 'lightning_zap' || // LNURL works with any wallet
          m.method === 'lens_collect' ||
          tipperHasWallet // crypto methods need a wallet
        ),
      }));

      setState(s => ({
        ...s,
        methods: enriched,
        selectedMethod: enriched.find(m => m.available)?.method || null,
        status: 'idle',
      }));

      return enriched;
    } catch (err) {
      setState(s => ({ ...s, status: 'failed', error: String(err) }));
      return [];
    }
  }, [account, walletAddress]);

  // Create + execute a tip
  const sendTip = useCallback(async (
    recipient: string,
    recipientProtocol: string,
    method: string,
    amount: string,
  ) => {
    setState(s => ({ ...s, status: 'creating', selectedMethod: method, amount }));

    try {
      const res = await fetch('/api/tip/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipient, recipientProtocol, method, amount, sender: account }),
      });
      const intent = await res.json();
      if (!res.ok) throw new Error(intent.error || 'Failed to create tip');

      // Handle different tip methods
      if (method === 'ethereum' && account) {
        setState(s => ({ ...s, status: 'signing' }));

        // Ensure wallet is connected
        if (!isConnected) {
          await connect();
        }

        // Send native ETH via MetaMask
        const provider = (window as any).ethereum;
        if (!provider) throw new Error('No Ethereum wallet detected');

        const tx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            to: intent.intent.to,
            value: '0x' + (BigInt(Math.floor(parseFloat(amount) * 1e18))).toString(16),
          }],
        });

        setState(s => ({ ...s, status: 'sent', txHash: tx }));
        return tx;
      }

      if (method === 'solana' && account) {
        setState(s => ({ ...s, status: 'signing' }));
        // Solana: use window.solana or phantom adapter
        const solana = (window as any).solana || (window as any).phantom?.solana;
        if (!solana) throw new Error('No Solana wallet detected');
        if (!solana.isConnected) await solana.connect();

        const lamports = Math.floor(parseFloat(amount) * 1e9);
        const instruction = {
          keys: [{ pubkey: solana.publicKey, isSigner: true, isWritable: true }],
          programId: '11111111111111111111111111111111', // System program
          data: Buffer.from([2, 0, 0, 0, ...new Uint8Array(new BigUint64Array([BigInt(lamports)]).buffer)]),
        };

        const tx = await solana.signAndSendTransaction({
          to: intent.intent.to,
          amount: lamports,
        });

        setState(s => ({ ...s, status: 'sent', txHash: tx.signature }));
        return tx.signature;
      }

      if (method === 'lightning_zap') {
        // Lightning: open LNURL-pay link or show invoice
        setState(s => ({ ...s, status: 'sent' }));
        return intent.intent;
      }

      setState(s => ({ ...s, status: 'sent' }));
      return intent;

    } catch (err: any) {
      setState(s => ({ ...s, status: 'failed', error: err.message || String(err) }));
      throw err;
    }
  }, [account, isConnected, connect]);

  return { state, reset, resolveMethods, sendTip };
}
