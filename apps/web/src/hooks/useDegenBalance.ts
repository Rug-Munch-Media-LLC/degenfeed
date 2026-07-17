'use client';

import { useEffect, useState } from 'react';

/**
 * Fetches the estimated $DEGEN token balance for a connected wallet.
 * Silently returns null when the wallet is not connected or the
 * balance endpoint is unavailable (hasn't been built yet).
 */
export function useDegenBalance(walletAddress?: string) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) {
      setBalance(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/user/degen-balance?address=${encodeURIComponent(walletAddress)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ balance: number }>) : null))
      .then((data) => {
        if (!cancelled && data) {
          setBalance(data.balance);
        }
      })
      .catch(() => {
        // endpoint not available yet
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  return { balance, loading };
}
