'use client';

import { buildIdentityRecord } from '@degenfeed/auth';
import type { StoredIdentity } from '@degenfeed/storage';
import {
  deleteIdentity,
  getAllIdentities,
  getPrimaryIdentity,
  saveIdentity,
  setPrimaryIdentity as setPrimaryIdentityInDb,
} from '@degenfeed/storage';
import type { EngagementAction } from '@degenfeed/types';
import { ComposeModal, SignInModal } from '@degenfeed/ui';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useWeb3 } from '../components/Web3Provider';
import { useWalletSignIn } from '../hooks/useWalletSignIn';

export interface AuthContextValue {
  signedInProtocols: Record<string, boolean>;
  tokens: Record<string, string>;
  walletAddress?: string;
  primaryIdentity?: StoredIdentity;
  linkedIdentities: StoredIdentity[];
  isWalletOnly: boolean;
  linkGtsUrl?: string | null;
  openSignIn: () => void;
  openCompose: () => void;
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
  const [ready, setReady] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const { account: wagmiAddress, isConnected } = useWeb3();
  const { signInWithEthereum, signingIn: walletSigningIn } = useWalletSignIn();

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
          passphrase: 'auto-unlock',
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
    async (protocol: string, token?: string) => {
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

        switch (protocol) {
          case 'solana': {
            throw new Error('Solana wallet sign-in is not yet supported');
          }
          case 'nostr': {
            const { signInWithNostrNsec } = await import('@degenfeed/auth');
            if (!token) throw new Error('Nostr nsec required');
            await signInWithNostrNsec(token, 'auto-unlock-passphrase');
            break;
          }
          case 'farcaster': {
            const { signInWithFarcasterSigner } = await import('@degenfeed/auth');
            const fid = prompt('Farcaster FID (numeric):');
            const username = prompt('Farcaster username:');
            const signerKey = prompt('Signer private key hex:');
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
            const handle = prompt('Bluesky handle (user.bsky.social):');
            const appPass = prompt('Bluesky app password:');
            if (!handle || !appPass) throw new Error('Bluesky credentials required');
            await signInWithBluesky(handle, appPass, 'auto-unlock');
            break;
          }
          case 'threads': {
            const { signInWithThreads } = await import('@degenfeed/auth');
            const identifier = prompt('Threads/AT Protocol identifier:');
            const apPass = prompt('App password:');
            if (!identifier || !apPass) throw new Error('Threads credentials required');
            await signInWithThreads(identifier, apPass, 'auto-unlock');
            break;
          }
          case 'mastodon': {
            const { signInWithGtS } = await import('@degenfeed/auth');
            const instance =
              prompt('Mastodon instance URL (https://social.degenfeed.xyz):') ||
              'https://social.degenfeed.xyz';
            const accessToken = prompt('Access token:');
            if (!accessToken) throw new Error('Access token required');
            await signInWithGtS(instance, accessToken, 'auto-unlock');
            break;
          }
          default:
            throw new Error(`Unknown protocol: ${protocol}`);
        }

        await refresh();
        setShowSignIn(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sign-in failed';
        alert(`Sign-in failed: ${message}`);
      }
    },
    [signInWithEthereum, refresh],
  );

  const handlePublish = useCallback(
    async (
      text: string,
      targets: string[],
    ): Promise<Record<string, { ok: boolean; error?: string }>> => {
      try {
        const res = await fetch('/api/publish', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, targets, auth: tokens }),
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
      const identity = identities.find((i) => i.protocol === protocol);
      const auth: Record<string, string> = {};
      if (identity?.keys?.accessToken) auth[protocol] = identity.keys.accessToken;
      if (protocol === 'mastodon') {
        auth.mastodon_instance = identity?.keys?.instanceUrl || 'https://social.degenfeed.xyz';
      }
      if (protocol === 'bluesky' || protocol === 'threads') {
        auth[`${protocol}_did`] = identity?.publicId ?? '';
      }
      if (protocol === 'lens') {
        auth.lens_profileId = identity?.publicId ?? '';
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

  return (
    <AuthContext.Provider
      value={{
        signedInProtocols,
        tokens,
        walletAddress,
        primaryIdentity,
        linkedIdentities,
        isWalletOnly,
        linkGtsUrl,
        openSignIn: () => setShowSignIn(true),
        openCompose: () => setShowCompose(true),
        publish: handlePublish,
        engage: handleEngage,
        ready,
        setPrimaryIdentity: handleSetPrimary,
        unlinkIdentity: handleUnlink,
      }}
    >
      {children}

      <SignInModal
        open={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSignIn={handleSignIn}
        walletAddress={walletAddress}
        walletSigningIn={walletSigningIn}
      />

      <ComposeModal
        open={showCompose}
        onClose={() => setShowCompose(false)}
        signedInProtocols={signedInProtocols}
        onPublish={handlePublish}
      />
    </AuthContext.Provider>
  );
}
