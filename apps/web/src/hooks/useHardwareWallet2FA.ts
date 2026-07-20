'use client';

/**
 * @degenfeed/web — Hardware Wallet 2FA hook
 *
 * Manages the challenge-response flow for hardware wallet 2FA:
 *   1. Fetch a challenge from the server
 *   2. Sign it with the connected wallet (EVM: personal_sign, Solana: signMessage)
 *   3. Send the signature back for verification
 *
 * Dependencies:
 *   - useWeb3() for EVM wallets (signMessage via EIP-1193 personal_sign)
 *   - useSolana() for Solana wallets (signMessage via ed25519)
 */

import { useCallback, useState } from 'react';
import type { Hw2FAStatus } from '../lib/hw-wallet-2fa';

interface UseHardwareWallet2FAOptions {
  /** Callback when 2FA verification succeeds */
  onVerified?: () => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
}

interface SignWithEthereumFn {
  (message: string): Promise<string>;
}

interface SignWithSolanaFn {
  (message: string): Promise<string>;
}

export function useHardwareWallet2FA(opts?: UseHardwareWallet2FAOptions) {
  const [challenge, setChallenge] = useState<string | null>(null);
  const [nonce, setNonce] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Hw2FAStatus | null>(null);
  const [step, setStep] = useState<'idle' | 'challenge' | 'signing' | 'verifying' | 'done'>('idle');

  /**
   * Fetch the current hardware wallet 2FA status.
   * Returns status or null on error.
   */
  const fetchStatus = useCallback(async (): Promise<Hw2FAStatus | null> => {
    try {
      const res = await fetch('/api/auth/hw-wallet/status', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Hw2FAStatus;
      setStatus(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  /**
   * Start the challenge flow: fetch a challenge from the server.
   */
  const startChallenge = useCallback(async (): Promise<string | null> => {
    setLoading(true);
    setError(null);
    setStep('challenge');

    try {
      const res = await fetch('/api/auth/hw-wallet/challenge', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errData?.error ?? 'Failed to generate challenge');
      }

      const data = (await res.json()) as {
        challenge: string;
        nonce: string;
        expiresIn: number;
      };

      setChallenge(data.challenge);
      setNonce(data.nonce);
      return data.challenge;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start challenge';
      setError(msg);
      opts?.onError?.(msg);
      setStep('idle');
      return null;
    } finally {
      setLoading(false);
    }
  }, [opts]);

  /**
   * Submit the signed challenge for verification.
   * The signature must be hex-encoded (0x-prefixed for EVM, bare hex for Solana).
   */
  const submitSignature = useCallback(
    async (signature: string): Promise<boolean> => {
      if (!nonce) {
        const msg = 'No active challenge. Start a new challenge first.';
        setError(msg);
        opts?.onError?.(msg);
        return false;
      }

      setStep('verifying');
      setError(null);

      try {
        const res = await fetch('/api/auth/hw-wallet/verify', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ signature, nonce }),
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errData?.error ?? 'Signature verification failed');
        }

        const data = (await res.json()) as { verified: boolean };
        if (data.verified) {
          setStep('done');
          opts?.onVerified?.();
          await fetchStatus();
          return true;
        }

        throw new Error('Verification failed');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Verification failed';
        setError(msg);
        opts?.onError?.(msg);
        setStep('challenge');
        return false;
      }
    },
    [nonce, opts, fetchStatus],
  );

  /**
   * Full flow: sign with an EVM wallet via personal_sign.
   *
   * @param signMessage - The signMessage function from useWeb3()
   */
  const signAndVerifyWithEthereum = useCallback(
    async (signMessage: SignWithEthereumFn): Promise<boolean> => {
      if (!challenge) {
        const c = await startChallenge();
        if (!c) return false;
        setStep('signing');
        try {
          const signature = await signMessage(c);
          return submitSignature(signature);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'User rejected signing';
          setError(msg);
          opts?.onError?.(msg);
          setStep('challenge');
          return false;
        }
      }

      setStep('signing');
      try {
        const signature = await signMessage(challenge);
        return submitSignature(signature);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'User rejected signing';
        setError(msg);
        opts?.onError?.(msg);
        setStep('challenge');
        return false;
      }
    },
    [challenge, startChallenge, submitSignature, opts],
  );

  /**
   * Full flow: sign with a Solana wallet via signMessage.
   *
   * @param signMessageFn - A function that takes a string and returns the hex signature
   */
  const signAndVerifyWithSolana = useCallback(
    async (signMessageFn: SignWithSolanaFn): Promise<boolean> => {
      if (!challenge) {
        const c = await startChallenge();
        if (!c) return false;
        setStep('signing');
        try {
          const signature = await signMessageFn(c);
          return submitSignature(signature);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'User rejected signing';
          setError(msg);
          opts?.onError?.(msg);
          setStep('challenge');
          return false;
        }
      }

      setStep('signing');
      try {
        const signature = await signMessageFn(challenge);
        return submitSignature(signature);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'User rejected signing';
        setError(msg);
        opts?.onError?.(msg);
        setStep('challenge');
        return false;
      }
    },
    [challenge, startChallenge, submitSignature, opts],
  );

  /**
   * Toggle hardware wallet 2FA on/off.
   * Enabling requires a recent verification (completed the challenge flow).
   */
  const toggle2FA = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/auth/hw-wallet/toggle', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled }),
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errData?.error ?? 'Failed to toggle 2FA');
        }

        await fetchStatus();
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to toggle 2FA';
        setError(msg);
        opts?.onError?.(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [opts, fetchStatus],
  );

  /**
   * Reset the flow state (after completion or cancellation).
   */
  const reset = useCallback(() => {
    setChallenge(null);
    setNonce(null);
    setError(null);
    setStep('idle');
  }, []);

  return {
    /** Current challenge message to sign */
    challenge,
    /** Current step in the flow */
    step,
    /** Whether an async operation is in progress */
    loading,
    /** Current error message, if any */
    error,
    /** Current 2FA status from the server */
    status,
    /** Fetch the current 2FA status */
    fetchStatus,
    /** Start a new challenge (returns the message to sign) */
    startChallenge,
    /** Submit a raw signature for verification */
    submitSignature,
    /** Full flow: sign with EVM wallet and verify automatically */
    signAndVerifyWithEthereum,
    /** Full flow: sign with Solana wallet and verify automatically */
    signAndVerifyWithSolana,
    /** Enable or disable 2FA */
    toggle2FA,
    /** Reset the flow state */
    reset,
  };
}
