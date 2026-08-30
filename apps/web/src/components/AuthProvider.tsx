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
import type { AuthTab } from '@degenfeed/ui';
import dynamic from 'next/dynamic';
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

const SignInModal = dynamic(
  () => import('@degenfeed/ui').then((m) => ({ default: m.SignInModal })),
  { ssr: false, loading: () => null },
);

import {
  signIn as betterSignIn,
  signOut as betterSignOut,
  signUp as betterSignUp,
  useSession,
} from '@/lib/auth-client';
import { useWeb3 } from '../components/Web3Provider';
import {
  AuthActionContext,
  type AuthActionValue,
  type AuthContextValue,
  AuthStateContext,
  type AuthStateValue,
  type ComposeReplyContext,
  useAuth,
  useAuthState,
} from '../context/auth-context';
import { EngageProvider, useEngageContext } from '../context/EngageContext';
import { PublishProvider, usePublishContext } from '../context/PublishContext';
import { useWallet, WalletProvider } from '../context/WalletContext';
import { triggerOnboarding } from '../hooks/useOnboarding';
import { useSolanaSignIn } from '../hooks/useSolanaSignIn';
import { useWalletSignIn } from '../hooks/useWalletSignIn';
import { addStoredWallet, getStoredWallets, type StoredWalletMeta } from '../lib/walletStorage';
import { RegistrationPrompt } from './RegistrationPrompt';
import { useToast } from './Toast';

// Backward-compatible re-exports — consumers keep importing from './AuthProvider'.
export type { AuthActionValue, AuthContextValue, AuthStateValue, ComposeReplyContext };
export { useAuth, useAuthState };

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <AuthCore>{children}</AuthCore>
    </WalletProvider>
  );
}

function AuthCore({ children }: { children: ReactNode }) {
  const [identities, setIdentities] = useState<StoredIdentity[]>([]);
  const [primaryIdentity, setPrimaryIdentity] = useState<StoredIdentity | undefined>(undefined);
  const [signedInProtocols, setSignedInProtocols] = useState<Record<string, boolean>>({});
  const [tokens, setTokens] = useState<Record<string, string>>({});
  // == Multi-wallet state lives in the scoped WalletContext ========
  const { walletAddresses, walletMeta, walletAddress, loadWallets, attachWallet, clearWallets } =
    useWallet();
  // ==
  const [linkGtsUrl, setLinkGtsUrl] = useState<string | null>(null);
  const [nostrPublicId, setNostrPublicId] = useState<string | undefined>(undefined);
  // App starts READY immediately — no blocking init.
  // Auth is purely lazy: wallet detection, session fetch, and identity
  // loading happen in the background without blocking the UI.
  const [ready] = useState(true);
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInTab, setSignInTab] = useState<AuthTab>('signin');
  const [signInError, setSignInError] = useState<string | null>(null);

  const { account: wagmiAddress, isConnected, availableWallets, chainId: evmChainId } = useWeb3();
  const { signInWithEthereum, signingIn: walletSigningIn } = useWalletSignIn();
  const { signInWithSolana, signingIn: solanaSigningIn } = useSolanaSignIn();
  const { showToast } = useToast();

  // Better Auth server session (replaces the broken `/api/auth/session` fetch).
  // `data.session` is null when logged out; `data.user` carries the account.
  const { data: session, isPending: sessionPending } = useSession();

  // == Wallet persistence helpers ==================================

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

    // Load persisted wallet list first
    loadWallets();

    // Merge any wallet identities from storage that aren't in our wallet list
    const walletIdentities = all.filter(
      (i) => i.protocol === 'ethereum' || i.protocol === 'solana',
    );
    for (const wi of walletIdentities) {
      const addr = wi.publicId;
      const stored = getStoredWallets();
      if (!stored.some((w) => w.address === addr)) {
        const newMeta: StoredWalletMeta = {
          address: addr,
          chain: wi.protocol === 'ethereum' ? 'ethereum' : 'solana',
          walletName: null,
          chainId: null,
          addedAt: wi.linkedAt ?? Date.now(),
        };
        addStoredWallet(newMeta);
      }
    }

    // If we still have no wallets but wagmi is connected, add that
    const stored = getStoredWallets();
    if (stored.length === 0 && isConnected && wagmiAddress) {
      addStoredWallet({
        address: wagmiAddress.toLowerCase(),
        chain: 'ethereum',
        walletName: null,
        chainId: null,
        addedAt: Date.now(),
      });
    }

    // Re-load after mutations
    loadWallets();

    const nostrId = all.find((i) => i.protocol === 'nostr');
    setNostrPublicId(nostrId?.publicId);
  }, [isConnected, wagmiAddress, loadWallets]);

  // Deferred background init: loads stored identities + session silently.
  // Does NOT block ready state — the app is usable immediately.
  useEffect(() => {
    const init = async () => {
      // Load stored identities from IndexedDB (silent, no prompt).
      await refresh().catch(() => {});
    };
    // Delay init slightly so the page renders first — no flash.
    const timer = setTimeout(init, 100);
    return () => {
      clearTimeout(timer);
    };
  }, [refresh]);

  // Keep UI state in sync with the Better Auth server session. When a session
  // exists the user is signed in server-side (email/social); reflect that in
  // signedInProtocols so components see an authenticated user even before any
  // protocol identity has been linked locally.
  useEffect(() => {
    if (sessionPending) return;
    if (session?.user) {
      setSignedInProtocols((prev) => {
        if (prev.email) return prev;
        return { ...prev, email: true };
      });
    } else {
      // No server session — clear any email protocol flag derived from it.
      setSignedInProtocols((prev) => {
        if (!prev.email) return prev;
        const next = { ...prev };
        delete next.email;
        return next;
      });
    }
  }, [session, sessionPending]);

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
          profile?: {
            id?: string;
            username?: string;
            email?: string;
            acct?: string;
            displayName?: string;
            avatar?: string;
            provider?: string;
          };
        };
        if (!pending.accessToken) return;

        const protocol = pending.protocol;
        const profile = pending.profile;

        // Only process pending identities for Mastodon/GotoSocial.
        // Other protocols (nostr, farcaster, etc.) have their own sign-in flows
        // and should not be auto-saved from the pending-identity bridge.
        if (protocol !== 'mastodon' && protocol !== 'gotosocial') {
          return;
        }

        const effectiveProtocol = profile?.provider || protocol;
        const publicId = String(profile?.id || profile?.email || profile?.username || 'unknown');

        let handle = '';
        let displayName = '';
        if (protocol === 'mastodon' || protocol === 'gotosocial') {
          handle = profile?.acct?.includes('@')
            ? profile.acct
            : `${profile?.acct}@social.degenfeed.xyz`;
          displayName = profile?.displayName || profile?.username || '';
        } else if (effectiveProtocol === 'google' || effectiveProtocol === 'email') {
          handle = profile?.email || '';
          displayName = profile?.displayName || profile?.email?.split('@')[0] || '';
        } else if (effectiveProtocol === 'github') {
          handle = profile?.username || `@${profile?.username}` || '';
          displayName = profile?.displayName || profile?.username || '';
        } else if (effectiveProtocol === 'discord') {
          handle = profile?.username || '';
          displayName = profile?.displayName || profile?.username || '';
        } else if (effectiveProtocol === 'twitter') {
          handle = profile?.username ? `@${profile?.username}` : '';
          displayName = profile?.displayName || profile?.username || '';
        } else if (effectiveProtocol === 'telegram') {
          handle = profile?.username ? `@${profile?.username}` : `tg:${profile?.id}`;
          displayName = profile?.displayName || profile?.username || '';
        } else if (effectiveProtocol === 'reddit') {
          handle = profile?.username ? `u/${profile?.username}` : '';
          displayName = profile?.displayName || profile?.username || '';
        } else if (effectiveProtocol === 'threads') {
          handle = profile?.username || '';
          displayName = profile?.displayName || profile?.username || '';
        } else {
          handle = profile?.username || profile?.email || publicId;
          displayName = profile?.displayName || profile?.username || '';
        }

        const record = await buildIdentityRecord({
          protocol: effectiveProtocol as import('@degenfeed/types').Protocol,
          publicId,
          handle: handle || publicId,
          displayName: displayName || handle || publicId,
          avatarUrl: profile?.avatar,
          secret: pending.accessToken,
          keys: { accessToken: pending.accessToken },
          isPrimary: false,
        });
        await saveIdentity(record);
        await refresh();
        showToast('success', `Connected to ${effectiveProtocol}!`);
        triggerOnboarding();
      } catch {
        /* ignore */
      }
    };

    processPending();
  }, [ready, refresh, showToast]);

  const handleSignIn = useCallback(
    async (protocol: string, credentials?: string | Record<string, string>) => {
      setSignInError(null);
      try {
        if (protocol === 'ethereum') {
          const session = await signInWithEthereum();
          if (session) {
            setLinkGtsUrl(session.gtsAuthorizeUrl ?? null);
            // Add to wallet list and activate it
            attachWallet({
              address: session.address.toLowerCase(),
              chain: 'ethereum',
              walletName: null,
              chainId: evmChainId ?? 1,
              addedAt: Date.now(),
            });
            await refresh();
            triggerOnboarding();
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
              // Add to wallet list
              attachWallet({
                address: session.address.toLowerCase(),
                chain: 'solana',
                walletName: null,
                chainId: null,
                addedAt: Date.now(),
              });
              await refresh();
              triggerOnboarding();
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
              triggerOnboarding();
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
            await signInWithFarcasterSigner(signerKey, Number(fid), username);
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
          case 'google':
          case 'github':
          case 'discord':
          case 'twitter':
          case 'telegram':
          case 'threads':
          case 'reddit': {
            // Better Auth handles the OAuth dance server-side. Triggering
            // signIn.social redirects the browser to the provider, then Better
            // Auth completes the callback and lands the user back at
            // `callbackURL` with a session cookie already set.
            const { error: socialError } = await betterSignIn.social({
              provider: protocol,
              callbackURL: '/home',
            });
            if (socialError) throw new Error(socialError.message || 'OAuth sign-in failed');
            return;
          }
          case 'email': {
            const emailMethod = creds.method as string;
            if (emailMethod === 'register') {
              // Better Auth handles email signup — creates the account and
              // (optionally) requires email verification before sign-in.
              const { data: signUpData, error: signUpError } = await betterSignUp.email({
                email: creds.email as string,
                password: creds.password as string,
                name:
                  (creds.displayName as string) || (creds.email as string).split('@')[0] || 'user',
              });
              if (signUpError) throw new Error(signUpError.message || 'Registration failed');
              const requiresVerification = !signUpData?.user?.emailVerified;
              if (requiresVerification) {
                showToast('success', 'Check your email to verify your account, then sign in.');
                setShowSignIn(false);
                return;
              }
              // Fall through to sign in after successful (verified) registration
            }
            const { data: signInData, error: signInError } = await betterSignIn.email({
              email: creds.email as string,
              password: creds.password as string,
            });
            if (signInError) throw new Error(signInError.message || 'Sign-in failed');
            const user = signInData?.user;
            const record = await buildIdentityRecord({
              protocol: 'email' as const,
              publicId: user?.id || (creds.email as string),
              handle: user?.name || (creds.email as string).split('@')[0] || 'user',
              displayName: user?.name || (creds.email as string).split('@')[0] || 'user',
              secret: null,
              keys: { email: creds.email as string },
              isPrimary: false,
            });
            await saveIdentity(record);
            await refresh();
            triggerOnboarding();
            setShowSignIn(false);
            showToast('success', `Welcome, ${user?.name || 'user'}!`);
            return;
          }
          default:
            throw new Error(`Unknown protocol: ${protocol}`);
        }

        await refresh();
        triggerOnboarding();
        setShowSignIn(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sign-in failed';
        setSignInError(message);
        showToast('error', `Sign-in failed: ${message}`);
      }
    },
    [signInWithEthereum, refresh, signInWithSolana, showToast, evmChainId, attachWallet],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await betterSignOut();
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
    clearWallets();
    setIdentities([]);
    setPrimaryIdentity(undefined);
    setSignedInProtocols({});
    setTokens({});
    setLinkGtsUrl(null);
    showToast('success', 'See you soon! 👋');
    // Redirect to landing page after a short delay
    setTimeout(() => {
      window.location.href = '/';
    }, 1200);
  }, [identities, showToast, clearWallets]);

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

  const openSignIn = useCallback(() => {
    setSignInError(null);
    setSignInTab('signin');
    setShowSignIn(true);
  }, []);
  const openSignUp = useCallback(() => {
    setSignInError(null);
    setSignInTab('signup');
    setShowSignIn(true);
  }, []);
  // ── Stable auth-only callbacks handed to AuthCoreInner (which runs INSIDE
  // ── the scoped Engage + Publish providers and re-exports the legacy combined
  // ── `useAuth()` action surface).
  const authActions = useMemo(
    () => ({
      openSignIn,
      openSignUp,
      signIn: handleSignIn,
      signOut: handleSignOut,
      setPrimaryIdentity: handleSetPrimary,
      unlinkIdentity: handleUnlink,
      refresh,
    }),
    [openSignIn, openSignUp, handleSignIn, handleSignOut, handleSetPrimary, handleUnlink, refresh],
  );

  /** Compose modal → sign-in modal handoff (stable ref, used by PublishProvider). */
  const handleOpenSignInFromCompose = useCallback(() => {
    setSignInError(null);
    setSignInTab('signin');
    setShowSignIn(true);
  }, []);

  // ── Split contexts: state (rarely-changing identity) vs actions (stable callbacks) ──

  const stateValue = useMemo(
    () => ({
      signedInProtocols,
      signingIn: walletSigningIn || solanaSigningIn,
      walletAddress,
      walletAddresses,
      walletMeta,
      primaryIdentity,
      linkedIdentities,
      isWalletOnly,
      linkGtsUrl,
      nostrPublicId,
    }),
    [
      signedInProtocols,
      walletSigningIn,
      solanaSigningIn,
      walletAddress,
      walletAddresses,
      walletMeta,
      primaryIdentity,
      linkedIdentities,
      isWalletOnly,
      linkGtsUrl,
      nostrPublicId,
    ],
  );

  const signInModalProps: ComponentProps<typeof SignInModal> = {
    open: showSignIn,
    onClose: () => {
      setSignInError(null);
      setShowSignIn(false);
    },
    onSignIn: handleSignIn,
    walletSigningIn: walletSigningIn || solanaSigningIn,
    availableWallets,
    initialTab: signInTab,
    onTabChange: setSignInTab,
    busy: walletSigningIn || solanaSigningIn,
    error: signInError ?? undefined,
  };

  return (
    <AuthStateContext.Provider value={stateValue}>
      <EngageProvider
        identities={identities}
        walletAddress={walletAddress}
        primaryIdentity={primaryIdentity}
      >
        <PublishProvider tokens={tokens} onRequestSignIn={handleOpenSignInFromCompose}>
          <AuthCoreInner
            tokens={tokens}
            ready={ready}
            authActions={authActions}
            signInModal={signInModalProps}
          >
            {children}
          </AuthCoreInner>
        </PublishProvider>
      </EngageProvider>
    </AuthStateContext.Provider>
  );
}

/**
 * Renders the legacy combined `useAuth()` action context. Lives INSIDE the
 * scoped Engage + Publish providers so it can read their contexts and re-export
 * `engage` / `crossReply` / `publish` / `openCompose` / `openComposeReply` on
 * the old AuthActionContext surface — existing consumers keep working without
 * changes, while identity/compose/engage state changes no longer re-render the
 * whole app.
 */
function AuthCoreInner({
  children,
  tokens,
  ready,
  authActions,
  signInModal,
}: {
  children: ReactNode;
  tokens: Record<string, string>;
  ready: boolean;
  authActions: {
    openSignIn: () => void;
    openSignUp: () => void;
    signIn: (protocol: string, credentials?: string | Record<string, string>) => Promise<void>;
    signOut: () => Promise<void>;
    setPrimaryIdentity: (id: string) => Promise<void>;
    unlinkIdentity: (id: string) => Promise<void>;
    refresh: () => Promise<void>;
  };
  signInModal: ComponentProps<typeof SignInModal>;
}) {
  const { engage, crossReply } = useEngageContext();
  const { publish, openCompose, openComposeReply } = usePublishContext();
  const { walletAddress, activeWalletIndex, walletCount, switchWallet, addWallet, removeWallet } =
    useWallet();

  const actionValue = useMemo(
    () => ({
      tokens,
      activeWalletIndex,
      walletCount,
      ready,
      openSignIn: authActions.openSignIn,
      openSignUp: authActions.openSignUp,
      signIn: authActions.signIn,
      openCompose,
      openComposeReply,
      signOut: authActions.signOut,
      publish,
      engage,
      crossReply,
      setPrimaryIdentity: authActions.setPrimaryIdentity,
      unlinkIdentity: authActions.unlinkIdentity,
      refresh: authActions.refresh,
      switchWallet,
      addWallet,
      removeWallet,
    }),
    [
      tokens,
      activeWalletIndex,
      walletCount,
      ready,
      authActions,
      openCompose,
      openComposeReply,
      publish,
      engage,
      crossReply,
      switchWallet,
      addWallet,
      removeWallet,
    ],
  );

  return (
    <AuthActionContext.Provider value={actionValue}>
      {children}

      <SignInModal {...signInModal} walletAddress={walletAddress} />

      {/* Registration prompt — nudges anonymous browsers after a few pages */}
      <RegistrationPrompt />
    </AuthActionContext.Provider>
  );
}
