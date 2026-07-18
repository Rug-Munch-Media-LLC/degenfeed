'use client';

import type { StoredIdentity } from '@degenfeed/types';
import { useCallback } from 'react';
import { signBridgeReplyNote } from '../lib/nostr';

/**
 * Hook providing cross-protocol reply functionality.
 * Extracted from AuthProvider to reduce monolith size.
 *
 * Handles signing for Nostr (client-side) and Farcaster (client-side),
 * then forwards to the /api/cross-reply server endpoint for Mastodon/Bluesky/Lens.
 */
export function useCrossReply(
  identities: StoredIdentity[],
  walletAddress: string | undefined,
  primaryIdentity: StoredIdentity | undefined,
) {
  const crossReply = useCallback(
    async (
      parentPostUri: string,
      parentProtocol: string,
      replyProtocol: string,
      content: string,
    ): Promise<{ ok: boolean; nativeId?: string; error?: string }> => {
      const bridgeFooter = `\n\n_↻ Replied via DegenFeed cross-protocol bridge (${parentProtocol} → ${replyProtocol})_`;
      const parentNativeId = parentPostUri.startsWith('df://')
        ? parentPostUri.slice(5).split(':').slice(1).join(':') || parentPostUri.slice(5)
        : parentPostUri;

      const auth: Record<string, string> = {};
      let signedMessage: string | undefined;

      const identity = identities.find((i) => i.protocol === replyProtocol);

      if (replyProtocol === 'nostr') {
        const nostrIdent = identities.find((i) => i.protocol === 'nostr');
        if (!nostrIdent) return { ok: false, error: 'No Nostr identity linked' };
        const signed = await signBridgeReplyNote({
          text: `${content}${bridgeFooter}`,
          publicId: nostrIdent.publicId,
          parentProtocol,
          parentNativeId,
        });
        if (!signed.ok || !signed.eventJson) {
          return { ok: false, error: signed.error ?? 'Could not sign Nostr event' };
        }
        signedMessage = signed.eventJson;
      } else if (replyProtocol === 'farcaster') {
        const fcIdent = identities.find((i) => i.protocol === 'farcaster');
        if (!fcIdent) return { ok: false, error: 'No Farcaster identity linked' };
        let signerKeyHex: string | undefined;
        if (fcIdent.encryptedSecret && fcIdent.salt && fcIdent.iv) {
          try {
            const { decryptSecret } = await import('@degenfeed/auth');
            signerKeyHex = await decryptSecret(
              { ciphertext: fcIdent.encryptedSecret, salt: fcIdent.salt, iv: fcIdent.iv },
              fcIdent.publicId,
            );
          } catch {
            /* fall through to plaintext key */
          }
        }
        if (!signerKeyHex) signerKeyHex = fcIdent.keys?._secret as string | undefined;
        if (!signerKeyHex) {
          return { ok: false, error: 'Farcaster signer key not found — re-link in Settings' };
        }
        const fid = parseInt(fcIdent.publicId, 10);
        if (Number.isNaN(fid)) return { ok: false, error: 'Invalid Farcaster FID' };
        const { buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');
        const cast = buildFarcasterCastMessage({
          signerKeyHex,
          fid,
          text: `${content}${bridgeFooter}`,
        });
        if (!cast.ok || !cast.messageHex) {
          return { ok: false, error: cast.error ?? 'Could not sign Farcaster cast' };
        }
        signedMessage = cast.messageHex;
      } else if (replyProtocol === 'mastodon') {
        const token = identity?.keys?.accessToken ?? identity?.keys?.mastodon_token ?? '';
        if (!token) return { ok: false, error: 'Not signed into Mastodon' };
        auth.mastodon = token;
        auth.mastodon_instance = identity?.keys?.instanceUrl || 'https://social.degenfeed.xyz';
      } else if (replyProtocol === 'bluesky') {
        const jwt = identity?.keys?.accessJwt ?? '';
        const did = identity?.publicId ?? '';
        if (!jwt || !did) return { ok: false, error: 'Not signed into Bluesky' };
        auth.bluesky_jwt = jwt;
        auth.bluesky_did = did;
      } else if (replyProtocol === 'lens') {
        const token = identity?.keys?.accessToken ?? '';
        if (!token) return { ok: false, error: 'Not signed into Lens' };
        auth.lens = token;
        auth.accessToken = token;
      }

      try {
        const res = await fetch('/api/cross-reply', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            parentPostUri,
            parentProtocol,
            replyProtocol,
            content,
            walletAddress: walletAddress || primaryIdentity?.publicId || 'unlinked',
            auth,
            signedMessage,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; nativeId?: string; error?: string };
        if (!res.ok) return { ok: false, error: data.error ?? `Bridge error (${res.status})` };
        return { ok: data.ok ?? false, nativeId: data.nativeId, error: data.error };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
      }
    },
    [identities, walletAddress, primaryIdentity],
  );

  return crossReply;
}
