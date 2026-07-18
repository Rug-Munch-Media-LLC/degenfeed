'use client';

import type { EngagementAction, StoredIdentity } from '@degenfeed/types';
import { useCallback } from 'react';
import { engageNostr } from '../lib/nostr';

/**
 * Hook providing an engage function that handles likes, reposts, replies
 * across all supported protocols. Extracted from AuthProvider to reduce
 * monolith size.
 *
 * Nostr and Farcaster sign client-side (never send private keys to server).
 * Mastodon, Bluesky, and Lens use stored access tokens via the /api/engage endpoint.
 */
export function useEngage(identities: StoredIdentity[]) {
  const engage = useCallback(
    async (
      action: EngagementAction,
      postId: string,
      protocol: string,
      opts: {
        content?: string;
        reaction?: string;
        target?: { authorId?: string; publicationId?: string };
      } = {},
    ): Promise<{ ok: boolean; error?: string }> => {
      // Nostr — sign and publish client-side (never send nsec to the server).
      if (protocol === 'nostr') {
        const nostrIdent = identities.find((i) => i.protocol === 'nostr');
        if (!nostrIdent) return { ok: false, error: 'No Nostr identity linked' };
        const nativeId = postId.startsWith('nostr:') ? postId.slice('nostr:'.length) : postId;
        const targetPubkey = opts.target?.authorId || '';
        if (
          action === 'like' ||
          action === 'unlike' ||
          action === 'repost' ||
          action === 'unrepost' ||
          action === 'reply'
        ) {
          return engageNostr({
            action: action === 'unlike' ? 'like' : action === 'unrepost' ? 'repost' : action,
            eventId: nativeId,
            pubkey: targetPubkey,
            content: opts.content,
            publicId: nostrIdent.publicId,
          });
        }
        return { ok: false, error: `${action} not supported on Nostr` };
      }

      // Build auth payload for server-side engagement.
      const identity = identities.find((i) => i.protocol === protocol);
      const auth: Record<string, string> = {};

      // Mastodon — access token + instance URL.
      if (protocol === 'mastodon') {
        const token = identity?.keys?.accessToken ?? identity?.keys?.mastodon_token ?? '';
        if (!token) return { ok: false, error: 'Not signed into Mastodon' };
        auth.mastodon = token;
        auth.mastodon_instance = identity?.keys?.instanceUrl || 'https://social.degenfeed.xyz';
      }
      // Bluesky — access JWT + DID.
      else if (protocol === 'bluesky') {
        const jwt = identity?.keys?.accessJwt ?? '';
        const did = identity?.publicId ?? '';
        if (!jwt || !did) return { ok: false, error: 'Not signed into Bluesky' };
        auth.bluesky = jwt;
      }
      // Lens — access token.
      else if (protocol === 'lens') {
        const token = identity?.keys?.accessToken ?? '';
        if (!token) return { ok: false, error: 'Not signed into Lens' };
        auth.lens = token;
        auth.accessToken = token;
        auth.lens_profileId = identity?.publicId ?? '';
      }
      // Farcaster — sign and publish client-side (never send signer key to the server).
      else if (protocol === 'farcaster') {
        const farcasterIdent = identities.find((i) => i.protocol === 'farcaster');
        if (!farcasterIdent) return { ok: false, error: 'No Farcaster identity linked' };

        let signerKeyHex = null;
        if (farcasterIdent.encryptedSecret && farcasterIdent.salt && farcasterIdent.iv) {
          try {
            const { decryptSecret } = await import('@degenfeed/auth');

            let passphrase: string | undefined = farcasterIdent.publicId;
            if (!passphrase) {
              passphrase = sessionStorage.getItem('degenfeed_farcaster_passphrase') ?? undefined;
              if (!passphrase) {
                passphrase = crypto.randomUUID();
                sessionStorage.setItem('degenfeed_farcaster_passphrase', passphrase);
              }
            }

            signerKeyHex = await decryptSecret(
              {
                ciphertext: farcasterIdent.encryptedSecret,
                salt: farcasterIdent.salt,
                iv: farcasterIdent.iv,
              },
              passphrase!,
            );
          } catch {
            return {
              ok: false,
              error:
                'Could not decrypt the stored Farcaster signer key. The encryption key may be corrupted or linked to a different session. Re-link your Farcaster account to generate a new signer key.',
            };
          }
        }
        if (!signerKeyHex) {
          signerKeyHex = farcasterIdent.keys?._secret as string | undefined;
        }
        if (!signerKeyHex) {
          return {
            ok: false,
            error:
              'Farcaster signer key not found. Sign in with a self-custody signer key via Settings.',
          };
        }

        const fid = parseInt(farcasterIdent.publicId, 10);
        if (Number.isNaN(fid)) return { ok: false, error: 'Invalid Farcaster FID' };

        const nativeId = postId.startsWith('farcaster:')
          ? postId.slice('farcaster:'.length)
          : postId.startsWith('fc:')
            ? postId.slice('fc:'.length)
            : postId;

        const targetFid = opts.target?.authorId ? parseInt(opts.target.authorId, 10) : 0;
        const castHashHex = nativeId;

        if (castHashHex.length < 40) {
          return { ok: false, error: 'Invalid Farcaster cast hash' };
        }

        if (action !== 'like' && action !== 'unlike' && action !== 'repost' && action !== 'reply') {
          return { ok: false, error: `${action} not supported on Farcaster` };
        }

        const { engageFarcaster } = await import('@degenfeed/farcaster-sdk');
        const result = await engageFarcaster({
          action: action,
          signerKeyHex,
          fid,
          targetFid,
          castHashHex,
          content: opts.content,
        });

        return result;
      }
      // Generic fallback — send accessToken as protocol key.
      else {
        if (identity?.keys?.accessToken) auth[protocol] = identity.keys.accessToken;
      }

      try {
        const res = await fetch('/api/engage', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action,
            postId,
            protocol,
            content: opts.content,
            reaction: opts.reaction,
            target: opts.target,
            auth,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        return { ok: data.ok ?? false, error: data.error };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
      }
    },
    [identities],
  );

  return engage;
}
