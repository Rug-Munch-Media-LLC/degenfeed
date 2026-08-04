'use client';

/**
 * @degenfeed/web — useUnifiedInteraction
 *
 * Client hook for the unified cross-protocol interaction endpoint
 * (`POST /api/interaction`). Replaces the old per-protocol engagement
 * handlers (Nostr kind 7/6/1, Farcaster ReactionAdd/CastAdd, Mastodon
 * favourite/reblog/status, Bluesky like/repost/post, Lens like/mirror/
 * comment, Lemmy like/comment) with one backend that performs the native
 * protocol action and returns a native reference.
 *
 * Exposes `{ like, boost, reply, tip, isLoading, error }` plus a raw
 * `interact` for advanced actions (unlike / unboost).
 */

import { useCallback, useState } from 'react';

export type UnifiedAction = 'like' | 'unlike' | 'boost' | 'unboost' | 'reply' | 'tip';

export interface UnifiedInteractionTarget {
  authorId?: string;
  publicationId?: string;
}

export interface UnifiedInteractionOptions {
  /** Reply text or tip memo. */
  content?: string;
  /** Protocol author / publication refs for the target post. */
  target?: UnifiedInteractionTarget;
  /** Tip amount in USD (tips only). */
  amountUsd?: number;
  /** Tip currency: eth | sol | usdc | bonk | btc | ... */
  currency?: string;
  /** Per-protocol auth tokens (mastodon access token, bluesky JWT, lens token…). */
  auth?: Record<string, string>;
  /** Pre-signed Nostr event JSON / Farcaster message hex. */
  signedMessage?: string;
  /** Sender wallet address for ledger attribution (tips). */
  walletAddress?: string;
}

export interface UnifiedNativeReference {
  protocol: string;
  action: UnifiedAction;
  /** Protocol-native id — event id, status id, at:// uri, tx hash, etc. */
  nativeId: string;
  /** Canonical URL on the native protocol, when known */
  url?: string;
}

export interface UnifiedInteractionResult {
  ok: boolean;
  nativeReference?: UnifiedNativeReference;
  activityId?: string;
  error?: string;
}

export interface UseUnifiedInteractionReturn {
  like: (
    protocol: string,
    postId: string,
    opts?: UnifiedInteractionOptions,
  ) => Promise<UnifiedInteractionResult>;
  boost: (
    protocol: string,
    postId: string,
    opts?: UnifiedInteractionOptions,
  ) => Promise<UnifiedInteractionResult>;
  reply: (
    protocol: string,
    postId: string,
    content: string,
    opts?: UnifiedInteractionOptions,
  ) => Promise<UnifiedInteractionResult>;
  tip: (
    protocol: string,
    postId: string,
    amountUsd: number,
    opts?: UnifiedInteractionOptions,
  ) => Promise<UnifiedInteractionResult>;
  /** Raw dispatcher for any allowed action (like / unlike / boost / unboost / reply / tip). */
  interact: (
    action: UnifiedAction,
    protocol: string,
    postId: string,
    opts?: UnifiedInteractionOptions,
  ) => Promise<UnifiedInteractionResult>;
  isLoading: boolean;
  error: string | null;
  /** Native reference from the last successful interaction (null until one completes). */
  lastResult: UnifiedInteractionResult | null;
  reset: () => void;
}

export function useUnifiedInteraction(): UseUnifiedInteractionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<UnifiedInteractionResult | null>(null);

  const interact = useCallback(
    async (
      action: UnifiedAction,
      protocol: string,
      postId: string,
      opts: UnifiedInteractionOptions = {},
    ): Promise<UnifiedInteractionResult> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/interaction', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action,
            protocol,
            postId,
            content: opts.content,
            target: opts.target,
            amountUsd: opts.amountUsd,
            currency: opts.currency,
            auth: opts.auth,
            signedMessage: opts.signedMessage,
            walletAddress: opts.walletAddress,
          }),
        });
        const data = (await res.json()) as UnifiedInteractionResult;
        setLastResult(data);
        if (!data.ok) setError(data.error ?? `Interaction failed (${action} on ${protocol})`);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error';
        setError(message);
        return { ok: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const like = useCallback(
    (protocol: string, postId: string, opts?: UnifiedInteractionOptions) =>
      interact('like', protocol, postId, opts),
    [interact],
  );

  const boost = useCallback(
    (protocol: string, postId: string, opts?: UnifiedInteractionOptions) =>
      interact('boost', protocol, postId, opts),
    [interact],
  );

  const reply = useCallback(
    (protocol: string, postId: string, content: string, opts?: UnifiedInteractionOptions) =>
      interact('reply', protocol, postId, { ...opts, content }),
    [interact],
  );

  const tip = useCallback(
    (protocol: string, postId: string, amountUsd: number, opts?: UnifiedInteractionOptions) =>
      interact('tip', protocol, postId, { ...opts, amountUsd }),
    [interact],
  );

  const reset = useCallback(() => {
    setError(null);
    setLastResult(null);
  }, []);

  return { like, boost, reply, tip, interact, isLoading, error, lastResult, reset };
}
