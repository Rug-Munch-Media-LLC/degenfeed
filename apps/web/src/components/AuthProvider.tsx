'use client';

import { buildIdentityRecord } from '@degenfeed/auth';
import {
  clearAllSessions,
  deleteIdentity,
  getAllIdentities,
  getPrimaryIdentity,
  type StoredIdentity,
  saveIdentity,
  setPrimaryIdentity as setPrimaryIdentityInDb,
} from '@degenfeed/storage';
import type { EngagementAction } from '@degenfeed/types';
import { ComposeModal, SignInModal } from '@degenfeed/ui';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useWeb3 } from '../components/Web3Provider';
import { useScheduledPosts } from '../hooks/useScheduledPosts';
import { useSolanaSignIn } from '../hooks/useSolanaSignIn';
import { useWalletSignIn } from '../hooks/useWalletSignIn';
import { engageNostr, publishNoteToNostr } from '../lib/nostr';
import { useToast } from './Toast';

export interface AuthContextValue {
  signedInProtocols: Record<string, boolean>;
  tokens: Record<string, string>;
  walletAddress?: string;
  primaryIdentity?: StoredIdentity;
  linkedIdentities: StoredIdentity[];
  isWalletOnly: boolean;
  linkGtsUrl?: string | null;
  nostrPublicId?: string;
  openSignIn: () => void;
  openCompose: () => void;
  signOut: () => Promise<void>;
  publish: (
    text: string,
    targets: string[],
  ) => Promise<Record<string, { ok: boolean; error?: string }>>;
  engage: (
    action: EngagementAction,
    postId: string,
    protocol: string,
    opts?: {
      content?: string;
      reaction?: string;
      target?: { authorId?: string; publicationId?: string };
    },
  ) => Promise<{ ok: boolean; error?: string }>;
  ready: boolean;
  setPrimaryIdentity: (id: string) => Promise<void>;
  unlinkIdentity: (id: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identities, setIdentities] = useState<StoredIdentity[]>([]);
  const [primaryIdentity, setPrimaryIdentity] = useState<StoredIdentity | undefined>(undefined);
  const [signedInProtocols, setSignedInProtocols] = useState<Record<string, boolean>>({});
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [walletAddress, setWalletAddress] = useState<string | undefined>(undefined);
  const [linkGtsUrl, setLinkGtsUrl] = useState<string | null>(null);
  const [nostrPublicId, setNostrPublicId] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const { scheduled: scheduledPosts, schedulePost, cancelSchedule, publishNow } =
    useScheduledPosts();

  const { account: wagmiAddress, isConnected, availableWallets } = useWeb3();
  const { signInWithEthereum, signingIn: walletSigningIn } = useWalletSignIn();
  const { signInWithSolana, signingIn: solanaSigningIn } = useSolanaSignIn();
  const { showToast } = useToast();

  const refresh = useCallback(async () => {
    const all = await getAllIdentities();
    const primary = await getPrimaryIdentity();
    setIdentities(all);
    setPrimaryIdentity(primary);

    const protocols: Record<string, boolean> = {};
    const toks: Record<string, string> = {};
    for (const identity of all) {
      protocols[identity.protocol] = true;
      if (identity.keys?.accessToken) {
        toks[identity.protocol] = identity.keys.accessToken;
      }
    }
    setSignedInProtocols(protocols);
    setTokens(toks);

    const wallet = all.find((i) => i.protocol === 'ethereum' || i.protocol === 'solana');
    setWalletAddress(wallet?.publicId ?? (isConnected ? (wagmiAddress ?? undefined) : undefined));

    const nostrId = all.find((i) => i.protocol === 'nostr');
    setNostrPublicId(nostrId?.publicId);
  }, [isConnected, wagmiAddress]);

  useEffect(() => {
    const init = async () => {
      let serverAddress: string | undefined;
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        if (res.ok) {
          const data = (await res.json()) as { address?: string };
          serverAddress = data.address;
        }
      } catch {
        /* session endpoint may be unavailable — continue without server session */
      }
      await refresh().catch(() => {});
      if (serverAddress) {
        setWalletAddress((prev) => prev ?? serverAddress?.toLowerCase());
      }
      setReady(true);
    };
    init();
  }, [refresh]);

  useEffect(() => {
    if (!ready) return;

    const processPending = async () => {
      const raw = localStorage.getItem('degenfeed_pending_identity');
      if (!raw) return;
      localStorage.removeItem('degenfeed_pending_identity');

      try {
        const pending = JSON.parse(raw) as {
          protocol: string;
          accessToken: string;
          profile?: { id?: string; acct?: string; displayName?: string; avatar?: string };
        };
        if (pending.protocol !== 'mastodon' || !pending.accessToken || !pending.profile?.id) return;

        const profile = pending.profile;
        const handle = profile.acct?.includes('@')
          ? profile.acct
          : `${profile.acct}@social.degenfeed.xyz`;
        const record = await buildIdentityRecord({
          protocol: 'mastodon',
          publicId: String(profile.id),
          handle,
          displayName: profile.displayName,
          avatarUrl: profile.avatar,
          secret: pending.accessToken,
          keys: { accessToken: pending.accessToken },
          isPrimary: false,
        });
        await saveIdentity(record);
        await refresh();
      } catch {
        /* ignore */
      }
    };

    processPending();
  }, [ready, refresh]);

  const handleSignIn = useCallback(
    async (protocol: string, credentials?: string | Record<string, string>) => {
      try {
        if (protocol === 'ethereum') {
          const session = await signInWithEthereum();
          if (session) {
            setLinkGtsUrl(session.gtsAuthorizeUrl ?? null);
            await refresh();
            setShowSignIn(false);
          }
          return;
        }

        // Backwards compat: if credentials is a string, treat as token
        const creds =
          typeof credentials === 'string' ? { token: credentials } : (credentials ?? {});
        const token = creds.token as string | undefined;

        switch (protocol) {
          case 'solana': {
            const session = await signInWithSolana();
            if (session) {
              setLinkGtsUrl(session.gtsAuthorizeUrl ?? null);
              await refresh();
              setShowSignIn(false);
            }
            return;
          }
          case 'nostr': {
            const { signInWithNostrNsec } = await import('@degenfeed/auth');
            if (creds.method === 'extension') {
              const win = window as unknown as {
                nostr?: {
                  getPublicKey: () => Promise<string>;
                  signEvent: (e: {
                    kind: number;
                    content: string;
                    tags: string[][];
                    created_at: number;
                  }) => Promise<{ sig: string }>;
                };
              };
              if (!win.nostr) throw new Error('NIP-07 extension not detected');
              const pubkey = await win.nostr.getPublicKey();
              const record = await buildIdentityRecord({
                protocol: 'nostr',
                publicId: pubkey,
                handle: pubkey.slice(0, 12),
                displayName: pubkey.slice(0, 12),
                secret: null,
                isPrimary: false,
              });
              await saveIdentity(record);
              await refresh();
              setShowSignIn(false);
              return;
            }
            const nsec = (creds.nsec as string) || token;
            if (!nsec) throw new Error('Nostr nsec required');
            await signInWithNostrNsec(nsec);
            break;
          }
          case 'farcaster': {
            const { signInWithFarcasterSigner } = await import('@degenfeed/auth');
            if (creds.method === 'warpcast') {
              window.location.href = '/api/auth/warpcast/authorize';
              return;
            }
            const fid = creds.fid as string;
            const username = creds.username as string;
            const signerKey = creds.signerKey as string;
            if (!fid || !username || !signerKey) throw new Error('Farcaster credentials required');
            await signInWithFarcasterSigner(signerKey, Number(fid), username, 'auto');
            break;
          }
          case 'lens': {
            const { signInWithLens } = await import('@degenfeed/auth');
            if (!window.ethereum) throw new Error('No Ethereum wallet detected');
            await signInWithLens({ wallet: window.ethereum });
            break;
          }
          case 'bluesky': {
            const { signInWithBluesky } = await import('@degenfeed/auth');
            const handle = creds.handle as string;
            const appPass = creds.appPassword as string;
            if (!handle || !appPass) throw new Error('Bluesky credentials required');
            await signInWithBluesky(handle, appPass);
            break;
          }
          case 'mastodon': {
            const { signInWithGtS } = await import('@degenfeed/auth');
            const instance = (creds.instance as string) || 'https://social.degenfeed.xyz';
            const accessToken = creds.accessToken as string;
            if (!accessToken) throw new Error('Access token required');
            await signInWithGtS(instance, accessToken);
            break;
          }
          default:
            throw new Error(`Unknown protocol: ${protocol}`);
        }

        await refresh();
        setShowSignIn(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sign-in failed';
        showToast('error', `Sign-in failed: ${message}`);
      }
    },
    [signInWithEthereum, refresh, signInWithSolana, showToast],
  );

  const handlePublish = useCallback(
    async (
      text: string,
      targets: string[],
      opts?: { lensCollect?: boolean },
    ): Promise<Record<string, { ok: boolean; error?: string }>> => {
      try {
        const res = await fetch('/api/publish', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, targets, auth: tokens, lensCollect: opts?.lensCollect }),
        });
        const data = await res.json();
        return data.results ?? {};
      } catch (_err) {
        const results: Record<string, { ok: boolean; error?: string }> = {};
        for (const t of targets) results[t] = { ok: false, error: 'Network error' };
        return results;
      }
    },
    [tokens],
  );

  const handleEngage = useCallback(
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

            // Derive passphrase from the user's Farcaster FID (unique, stable per identity).
            // Falls back to a session-stored random value if FID is unavailable.
            let passphrase = farcasterIdent.publicId;
            if (!passphrase) {
              passphrase = sessionStorage.getItem('degenfeed_farcaster_passphrase');
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
              passphrase,
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

  const handleSignOut = useCallback(async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore network errors — still clear local state */
    }
    try {
      await clearAllSessions();
      for (const identity of identities) {
        await deleteIdentity(identity.id);
      }
    } catch {
      /* ignore */
    }
    setIdentities([]);
    setPrimaryIdentity(undefined);
    setSignedInProtocols({});
    setTokens({});
    setWalletAddress(undefined);
    setLinkGtsUrl(null);
    showToast('success', 'Signed out');
  }, [identities, showToast]);

  const handleSetPrimary = useCallback(
    async (id: string) => {
      await setPrimaryIdentityInDb(id);
      await refresh();
    },
    [refresh],
  );

  const handleUnlink = useCallback(
    async (id: string) => {
      await deleteIdentity(id);
      await refresh();
    },
    [refresh],
  );

  const linkedIdentities = useMemo(
    () => identities.filter((i) => i.id !== primaryIdentity?.id),
    [identities, primaryIdentity],
  );

  const isWalletOnly = useMemo(() => {
    if (!primaryIdentity) return false;
    return (
      (primaryIdentity.protocol === 'ethereum' || primaryIdentity.protocol === 'solana') &&
      linkedIdentities.length === 0
    );
  }, [primaryIdentity, linkedIdentities]);

  const openSignIn = useCallback(() => setShowSignIn(true), []);
  const openCompose = useCallback(() => setShowCompose(true), []);

  const contextValue = useMemo(
    () => ({
      signedInProtocols,
      tokens,
      walletAddress,
      primaryIdentity,
      linkedIdentities,
      isWalletOnly,
      linkGtsUrl,
      openSignIn,
      openCompose,
      signOut: handleSignOut,
      nostrPublicId,
      publish: handlePublish,
      engage: handleEngage,
      ready,
      setPrimaryIdentity: handleSetPrimary,
      unlinkIdentity: handleUnlink,
    }),
    [
      signedInProtocols,
      tokens,
      walletAddress,
      primaryIdentity,
      linkedIdentities,
      isWalletOnly,
      linkGtsUrl,
      openSignIn,
      openCompose,
      handleSignOut,
      nostrPublicId,
      handlePublish,
      handleEngage,
      ready,
      handleSetPrimary,
      handleUnlink,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}

      <SignInModal
        open={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSignIn={handleSignIn}
        walletAddress={walletAddress}
        walletSigningIn={walletSigningIn || solanaSigningIn}
        availableWallets={availableWallets}
      />

      <ComposeModal
        open={showCompose}
        onClose={() => setShowCompose(false)}
        signedInProtocols={signedInProtocols}
        onPublish={handlePublish}
        onRequestSignIn={() => {
          setShowCompose(false);
          setShowSignIn(true);
        }}
        primaryIdentity={
          primaryIdentity
            ? {
                displayName: primaryIdentity.displayName,
                handle: primaryIdentity.handle,
                avatarUrl: primaryIdentity.avatarUrl,
              }
            : undefined
        }
        nostrBridgePublicId={nostrPublicId}
        onNostrBridge={async (text) => {
          if (!nostrPublicId) return;
          await publishNoteToNostr({ text, publicId: nostrPublicId });
        }}
        onSchedule={(text, targets, scheduledAt) =>
          schedulePost(text, targets, scheduledAt)
        }
        scheduledPosts={scheduledPosts}
        onCancelSchedule={(id) => cancelSchedule(id)}
        onPublishScheduledNow={(id) => {
          const post = publishNow(id);
          if (post) {
            handlePublish(post.text, post.targets);
          }
        }}
      />
    </AuthContext.Provider>
  );
}
