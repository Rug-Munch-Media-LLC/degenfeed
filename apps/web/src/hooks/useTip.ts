'use client';

import { useCallback, useState } from 'react';

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
  recommended?: boolean;
}

export interface TipIntent {
  method: string;
  intent: {
    to: string;
    amount: string;
    chain?: string;
    chainId?: number;
    data?: string;
    value?: string;
    from?: string;
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

export interface TipPostContext {
  protocol: string;
  authorId: string;
  author?: {
    evmAddress?: string;
    solanaAddress?: string;
    lightningAddress?: string;
    farcasterCustodyAddress?: string;
    lensProfile?: string;
    nostrPubkey?: string;
  };
  meta?: {
    hasCollectModule?: boolean;
    publicationId?: string;
  };
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
  const resolveMethods = useCallback(
    async (protocol: string, authorId: string, postContext?: TipPostContext) => {
      setState((s) => ({ ...s, status: 'resolving' }));
      try {
        const params = new URLSearchParams({
          protocol,
          authorId,
        });
        if (postContext) {
          params.set('postContext', JSON.stringify(postContext));
        }
        const res = await fetch(`/api/tip/resolve?${params.toString()}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as { methods?: TipMethod[] };
        const methods: TipMethod[] = data.methods || [];
        const recommended = methods.find((m) => m.available && m.recommended);
        const firstAvailable = methods.find((m) => m.available);

        setState((s) => ({
          ...s,
          methods,
          selectedMethod: recommended?.method ?? firstAvailable?.method ?? null,
          status: 'idle',
        }));

        return methods;
      } catch (err) {
        setState((s) => ({ ...s, status: 'failed', error: String(err) }));
        return [];
      }
    },
    [],
  );

  /** Create a tip intent on the server. The caller must handle signing. */
  const createTip = useCallback(
    async (
      recipient: string,
      recipientProtocol: string,
      method: string,
      amount: string,
      publicationId?: string,
    ): Promise<TipIntent | null> => {
      setState((s) => ({ ...s, status: 'creating', selectedMethod: method, amount }));

      try {
        const res = await fetch('/api/tip/create', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ recipient, recipientProtocol, method, amount, publicationId }),
        });
        const data = (await res.json()) as TipIntent & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create tip');
        }
        setState((s) => ({ ...s, status: 'idle' }));
        return data;
      } catch (err) {
        setState((s) => ({
          ...s,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        }));
        return null;
      }
    },
    [],
  );

  /**
   * Fetch a Lightning zap invoice for a Nostr recipient.
   * Amount is expected in BTC (e.g. 0.00001).
   */
  const fetchLightningInvoice = useCallback(
    async (pubkey: string, amount: string, comment?: string) => {
      try {
        const params = new URLSearchParams({
          pubkey,
          amount,
          comment: comment || 'Tip from DegenFeed',
        });
        const res = await fetch(`/api/tip/lightning/invoice?${params.toString()}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as {
          invoice?: string;
          amount?: number;
          expiresAt?: number;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Failed to get invoice');
        return data as { invoice: string; amount: number; expiresAt: number };
      } catch (err) {
        setState((s) => ({
          ...s,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        }));
        return null;
      }
    },
    [],
  );

  const setTipStatus = useCallback(
    (status: TipState['status'], txHash?: string, error?: string) => {
      setState((s) => ({ ...s, status, txHash, error }));
    },
    [],
  );

  return { state, reset, resolveMethods, createTip, fetchLightningInvoice, setTipStatus };
}
