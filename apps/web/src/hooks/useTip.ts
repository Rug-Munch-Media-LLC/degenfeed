"use client";

import { useState, useCallback } from 'react';

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
  actionUrl?: string;
}

export interface TipIntent {
  method: string;
  intent: {
    to: string;
    amount: string;
    chain?: string;
    note?: string;
    actionUrl?: string;
    zapEndpoint?: string;
  };
  instructions?: string;
  actionUrl?: string;
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
  const [state, setState] = useState<TipState>(INITIAL);

  const reset = useCallback(() => setState(INITIAL), []);

  /** Resolve available tipping methods for a recipient. */
  const resolveMethods = useCallback(async (protocol: string, authorId: string) => {
    setState(s => ({ ...s, status: 'resolving' }));
    try {
      const res = await fetch(`/api/tip/resolve?protocol=${encodeURIComponent(protocol)}&authorId=${encodeURIComponent(authorId)}`);
      const data = await res.json();
      const methods: TipMethod[] = data.methods || [];

      setState(s => ({
        ...s,
        methods,
        selectedMethod: methods.find(m => m.available)?.method || null,
        status: 'idle',
      }));

      return methods;
    } catch (err) {
      setState(s => ({ ...s, status: 'failed', error: String(err) }));
      return [];
    }
  }, []);

  /** Create a tip intent on the server. The caller must handle signing. */
  const createTip = useCallback(async (
    recipient: string,
    recipientProtocol: string,
    method: string,
    amount: string,
  ): Promise<TipIntent | null> => {
    setState(s => ({ ...s, status: 'creating', selectedMethod: method, amount }));

    try {
      const res = await fetch('/api/tip/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ recipient, recipientProtocol, method, amount }),
      });
      const intent: TipIntent = await res.json();
      if (!res.ok) throw new Error((intent as any).error || 'Failed to create tip');
      setState(s => ({ ...s, status: 'idle' }));
      return intent;
    } catch (err: any) {
      setState(s => ({ ...s, status: 'failed', error: err.message || String(err) }));
      return null;
    }
  }, []);

  /**
   * Fetch a Lightning zap invoice for a Nostr recipient.
   * Amount is expected in BTC (e.g. 0.00001).
   */
  const fetchLightningInvoice = useCallback(async (pubkey: string, amount: string, comment?: string) => {
    try {
      const params = new URLSearchParams({ pubkey, amount, comment: comment || 'Tip from DegenFeed' });
      const res = await fetch('/api/tip/lightning/invoice?' + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get invoice');
      return data as { invoice: string; amount: number; expiresAt: number };
    } catch (err: any) {
      setState(s => ({ ...s, status: 'failed', error: err.message || String(err) }));
      return null;
    }
  }, []);

  const setTipStatus = useCallback((status: TipState['status'], txHash?: string, error?: string) => {
    setState(s => ({ ...s, status, txHash, error }));
  }, []);

  return { state, reset, resolveMethods, createTip, fetchLightningInvoice, setTipStatus };
}
