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
import dynamic from 'next/dynamic';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const SignInModal = dynamic(
  () => import('@degenfeed/ui').then((m) => ({ default: m.SignInModal })),
  { ssr: false, loading: () => null },
);

const ComposeModal = dynamic(
  () => import('@degenfeed/ui').then((m) => ({ default: m.ComposeModal })),
  { ssr: false, loading: () => null },
);

import { useWeb3 } from '../components/Web3Provider';
import { useCrossReply } from '../hooks/useCrossReply';
import { useEngage } from '../hooks/useEngage';
import { triggerOnboarding } from '../hooks/useOnboarding';
import { usePublish } from '../hooks/usePublish';
import { useScheduledPosts } from '../hooks/useScheduledPosts';
import { useSolanaSignIn } from '../hooks/useSolanaSignIn';
import { useWalletSignIn } from '../hooks/useWalletSignIn';
import { publishNoteToNostr } from '../lib/nostr';
import {
  addStoredWallet,
  clearStoredWallets,
  getActiveWalletIndex,
  getStoredWallets,
  removeStoredWallet,
  type StoredWalletMeta,
  setActiveWalletIndex,
} from '../lib/walletStorage';
import { useToast } from './Toast';

/** Cross-protocol reply context passed to ComposeModal. */
export interface ComposeReplyContext {
  parentPostUri: string;
  parentProtocol: string;
  parentPreview?: string;
}

// ── Split contexts: identity state (rarely changes) vs actions (stable refs) ──

/** Values that change only when identity/wallet data changes */
export interface AuthStateValue {
  signedInProtocols: Record<string, boolean>;
  /** Active wallet address (backward-compat: first wallet in the list) */
  walletAddress?: string;
  /** All connected wallet addresses */
  walletAddresses: string[];
  /** Metadata for each connected wallet */
  walletMeta: Record<string, StoredWalletMeta>;
  primaryIdentity?: StoredIdentity;
  linkedIdentities: StoredIdentity[];
  isWalletOnly: boolean;
  linkGtsUrl?: string | null;
  nostrPublicId?: string;
}

/** Stable action functions + frequently-changing non-identity state */
export interface AuthActionValue {
  tokens: Record<string, string>;
  /** Index of the currently active wallet */
  activeWalletIndex: number;
  /** Number of connected wallets */
  walletCount: number;
  ready: boolean;
  openSignIn: () => void;
  openCompose: () => void;
  /** Open the composer in cross-protocol reply mode for the given parent post. */
  openComposeReply: (ctx: ComposeReplyContext) => void;
  signOut: () => Promise<void>;
  /** Switch to a different connected wallet by index */
  switchWallet: (index: number) => void;
  /** Connect a new wallet without disconnecting the current one */
  addWallet: () => Promise<void>;
  /** Remove a wallet from the connected list */
  removeWallet: (index: number) => void;
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
  /** Reply to a post on another protocol via the cross-protocol bridge. */
  crossReply: (
    parentPostUri: string,
    parentProtocol: string,
    replyProtocol: string,
    content: string,
  ) => Promise<{ ok: boolean; nativeId?: string; error?: string }>;
  setPrimaryIdentity: (id: string) => Promise<void>;
  unlinkIdentity: (id: string) => Promise<void>;
}

/** Combined type for backward compatibility with existing consumers */
export interface AuthContextValue extends AuthStateValue, AuthActionValue {}

const AuthStateContext = createContext<AuthStateValue | null>(null);
const AuthActionContext = createContext<AuthActionValue | null>(null);

/**
 * Read only identity state — does NOT re-render when action callbacks change.
 * Preferred for components that only need signedInProtocols, walletAddress, etc.
 */
export function useAuthState(): AuthStateValue {
  const ctx = useContext(AuthStateContext);
  if (!ctx) throw new Error('useAuthState must be used within an AuthProvider');
  return ctx;
}

/** Combined convenience hook — reads from both contexts. Backward compatible. */
export function useAuth(): AuthContextValue {
  const state = useContext(AuthStateContext);
  const actions = useContext(AuthActionContext);
  if (!state || !actions) throw new Error('useAuth must be used within an AuthProvider');
  return { ...state, ...actions };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identities, setIdentities] = useState<StoredIdentity[]>([]);
  const [primaryIdentity, setPrimaryIdentity] = useState<StoredIdentity | undefined>(undefined);
  const [signedInProtocols, setSignedInProtocols] = useState<Record<string, boolean>>({});
  const [tokens, setTokens] = useState<Record<string, string>>({});
  // == Multi-wallet state ==========================================
  const [walletAddresses, setWalletAddresses] = useState<string[]>([]);
  const [activeWalletIndex, setActiveWalletIndexState] = useState<number>(0);
  const [walletMeta, setWalletMeta] = useState<Record<string, StoredWalletMeta>>({});
  // == Legacy single-wallet derived state ==========================
  const walletAddress = walletAddresses[activeWalletIndex] ?? undefined;
  // ==
  const [linkGtsUrl, setLinkGtsUrl] = useState<string | null>(null);
  const [nostrPublicId, setNostrPublicId] = useState<string | undefined>(undefined);
  // App starts READY immediately — no blocking init.
  // Auth is purely lazy: wallet detection, session fetch, and identity
  // loading happen in the background without blocking the UI.
  const [ready] = useState(true);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeReplyContext, setComposeReplyContext] = useState<ComposeReplyContext | undefined>(
    undefined,
  );
  const {
    scheduled: scheduledPosts,
    schedulePost,
    cancelSchedule,
    publishNow,
  } = useScheduledPosts();

  const { account: wagmiAddress, isConnected, availableWallets, chainId: evmChainId } = useWeb3();
  const { signInWithEthereum, signingIn: walletSigningIn } = useWalletSignIn();
  const { signInWithSolana, signingIn: solanaSigningIn } = useSolanaSignIn();
  const { showToast } = useToast();

  // == Wallet persistence helpers ==================================

  /** Load wallet list from localStorage and merge with any stored identities */
  const loadWallets = useCallback(() => {
    const stored = getStoredWallets();
    const addresses = stored.map((m) => m.address);
    const meta: Record<string, StoredWalletMeta> = {};
    for (const m of stored) meta[m.address] = m;
    setWalletMeta(meta);
    setWalletAddresses(addresses);
    const idx = getActiveWalletIndex();
    setActiveWalletIndexState(idx < addresses.length ? idx : 0);
  }, []);

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
    let cancelled = false;
    const init = async () => {
      // Load stored identities from IndexedDB (silent, no prompt).
      await refresh().catch(() => {});

      // Try to restore server session (also silent).
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        if (!cancelled && res.ok) {
          const data = (await res.json()) as {
            address?: string;
            chain?: 'ethereum' | 'solana';
          };
          if (data.address) {
            const sessionChain = data.chain ?? 'ethereum';
            const addr = data.address.toLowerCase();
            const stored = getStoredWallets();
            if (!stored.some((w) => w.address === addr)) {
              addStoredWallet({
                address: addr,
                chain: sessionChain,
                walletName: null,
                chainId: sessionChain === 'ethereum' ? 1 : null,
                addedAt: Date.now(),
              });
              loadWallets();
            }
            // Ensure signedInProtocols reflects the server session even
            // when IndexedDB identities are not yet loaded or available.
            setSignedInProtocols((prev) => {
              if (prev[sessionChain]) return prev;
              return { ...prev, [sessionChain]: true };
            });
          }
        }
      } catch {
        /* session endpoint unavailable — continue without server session */
      }
    };
    // Delay init slightly so the page renders first — no flash.
    const timer = setTimeout(init, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh, loadWallets]);

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
          handle = `@${profile?.username}` || '';
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
      try {
        if (protocol === 'ethereum') {
          const session = await signInWithEthereum();
          if (session) {
            setLinkGtsUrl(session.gtsAuthorizeUrl ?? null);
            // Add to wallet list
            const addr = session.address.toLowerCase();
            const meta: StoredWalletMeta = {
              address: addr,
              chain: 'ethereum',
              walletName: null,
              chainId: evmChainId ?? 1,
              addedAt: Date.now(),
            };
            const updated = addStoredWallet(meta);
            setWalletMeta((prev) => ({ ...prev, [addr]: meta }));
            setWalletAddresses(updated.map((w) => w.address));
            setActiveWalletIndexState(updated.length - 1);
            setActiveWalletIndex(updated.length - 1);
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
              const addr = session.address.toLowerCase();
              const meta: StoredWalletMeta = {
                address: addr,
                chain: 'solana',
                walletName: null,
                chainId: null,
                addedAt: Date.now(),
              };
              const updated = addStoredWallet(meta);
              setWalletMeta((prev) => ({ ...prev, [addr]: meta }));
              setWalletAddresses(updated.map((w) => w.address));
              setActiveWalletIndexState(updated.length - 1);
              setActiveWalletIndex(updated.length - 1);
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
            // OAuth providers handled via redirect in SignInModal
            // The callback page stores the result in localStorage
            return;
          }
          case 'email': {
            const emailMethod = creds.method as string;
            if (emailMethod === 'register') {
              const resp = await fetch('/api/auth/email/register', {
                method: 'POST',
                credentials: 'include',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  email: creds.email,
                  password: creds.password,
                  displayName: creds.displayName,
                }),
              });
              const data = (await resp.json()) as {
                success?: boolean;
                message?: string;
                error?: string;
                requiresVerification?: boolean;
              };
              if (!resp.ok) throw new Error(data.error || 'Registration failed');
              showToast('success', data.message || 'Check your email to verify your account.');
              if (data.requiresVerification) {
                setShowSignIn(false);
                return;
              }
              // Fall through to sign in after registration
            }
            const resp = await fetch('/api/auth/email/signin', {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ email: creds.email, password: creds.password }),
            });
            const data = (await resp.json()) as {
              success?: boolean;
              user?: { id?: string; email?: string; displayName?: string };
              error?: string;
            };
            if (!resp.ok) throw new Error(data.error || 'Sign-in failed');
            const record = await buildIdentityRecord({
              protocol: 'email' as const,
              publicId: data.user?.id || (creds.email as string),
              handle: data.user?.displayName || (creds.email as string).split('@')[0] || 'user',
              displayName:
                data.user?.displayName || (creds.email as string).split('@')[0] || 'user',
              secret: null,
              keys: { email: creds.email as string },
              isPrimary: false,
            });
            await saveIdentity(record);
            await refresh();
            triggerOnboarding();
            setShowSignIn(false);
            showToast('success', `Welcome, ${data.user?.displayName || 'user'}!`);
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
        showToast('error', `Sign-in failed: ${message}`);
      }
    },
    [signInWithEthereum, refresh, signInWithSolana, showToast, evmChainId],
  );

  const handlePublish = usePublish(tokens);

  const handleCrossReply = useCrossReply(identities, walletAddress, primaryIdentity);

  const handleEngage = useEngage(identities);

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
    clearStoredWallets();
    setIdentities([]);
    setPrimaryIdentity(undefined);
    setSignedInProtocols({});
    setTokens({});
    setWalletAddresses([]);
    setActiveWalletIndexState(0);
    setWalletMeta({});
    setLinkGtsUrl(null);
    showToast('success', 'See you soon! 👋');
    // Redirect to landing page after a short delay
    setTimeout(() => {
      window.location.href = '/';
    }, 1200);
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

  // == Multi-wallet actions ======================================

  const switchWallet = useCallback((index: number) => {
    const stored = getStoredWallets();
    if (index < 0 || index >= stored.length) return;
    setActiveWalletIndexState(index);
    setActiveWalletIndex(index);
  }, []);

  const addWallet = useCallback(async () => {
    // Connect a NEW wallet via the Web3 provider (without disconnecting current).
    // We call connect() which prompts the browser wallet to switch accounts.
    try {
      interface Eip1193Provider {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        on?: (event: string, handler: (...args: unknown[]) => void) => void;
        removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
      }
      const provider: Eip1193Provider | null =
        typeof window !== 'undefined'
          ? ((window as unknown as { ethereum?: Eip1193Provider }).ethereum ?? null)
          : null;
      if (!provider) {
        showToast('error', 'No Ethereum wallet detected');
        return;
      }
      // Request accounts — the wallet may prompt the user to select an account.
      // If they select a new/different account, it gets added to our list.
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[];
      const newAddress = accounts[0]?.toLowerCase();
      if (!newAddress) {
        showToast('error', 'No account selected');
        return;
      }

      const stored = getStoredWallets();
      if (stored.some((w) => w.address === newAddress)) {
        // Already connected — just switch to it
        const existingIdx = stored.findIndex((w) => w.address === newAddress);
        switchWallet(existingIdx);
        showToast('success', 'Switched to wallet');
        return;
      }

      const meta: StoredWalletMeta = {
        address: newAddress,
        chain: 'ethereum',
        walletName: null,
        chainId: null,
        addedAt: Date.now(),
      };
      const updated = addStoredWallet(meta);
      setWalletMeta((prev) => ({ ...prev, [newAddress]: meta }));
      setWalletAddresses(updated.map((w) => w.address));
      setActiveWalletIndexState(updated.length - 1);
      setActiveWalletIndex(updated.length - 1);
      showToast('success', 'Wallet added');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add wallet';
      showToast('error', message);
    }
  }, [switchWallet, showToast]);

  const removeWallet = useCallback(
    (index: number) => {
      const stored = getStoredWallets();
      if (index < 0 || index >= stored.length) return;
      const removed = stored[index]!;
      const updated = removeStoredWallet(removed.address);
      setWalletMeta((prev) => {
        const next = { ...prev };
        delete next[removed.address];
        return next;
      });
      setWalletAddresses(updated.map((w) => w.address));

      // Adjust active wallet index
      if (updated.length === 0) {
        setActiveWalletIndexState(0);
        setActiveWalletIndex(0);
      } else if (index >= updated.length) {
        setActiveWalletIndexState(updated.length - 1);
        setActiveWalletIndex(updated.length - 1);
      } else if (index === activeWalletIndex) {
        // Active wallet was removed — keep index at same position (it shifted)
        // No change needed
      } else if (index < activeWalletIndex) {
        setActiveWalletIndexState(activeWalletIndex - 1);
        setActiveWalletIndex(activeWalletIndex - 1);
      }
    },
    [activeWalletIndex],
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

  const walletCount = walletAddresses.length;

  const openSignIn = useCallback(() => setShowSignIn(true), []);
  const openCompose = useCallback(() => {
    setComposeReplyContext(undefined);
    setShowCompose(true);
  }, []);
  const openComposeReply = useCallback((ctx: ComposeReplyContext) => {
    setComposeReplyContext(ctx);
    setShowCompose(true);
  }, []);

  // ── Split contexts: state (rarely-changing identity) vs actions (stable callbacks) ──

  const stateValue = useMemo(
    () => ({
      signedInProtocols,
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

  const actionValue = useMemo(
    () => ({
      tokens,
      activeWalletIndex,
      walletCount,
      ready,
      openSignIn,
      openCompose,
      openComposeReply,
      signOut: handleSignOut,
      publish: handlePublish,
      engage: handleEngage,
      crossReply: handleCrossReply,
      setPrimaryIdentity: handleSetPrimary,
      unlinkIdentity: handleUnlink,
      switchWallet,
      addWallet,
      removeWallet,
    }),
    [
      tokens,
      activeWalletIndex,
      walletCount,
      ready,
      openSignIn,
      openCompose,
      openComposeReply,
      handleSignOut,
      handlePublish,
      handleEngage,
      handleCrossReply,
      handleSetPrimary,
      handleUnlink,
      switchWallet,
      addWallet,
      removeWallet,
    ],
  );

  return (
    <AuthStateContext.Provider value={stateValue}>
      <AuthActionContext.Provider value={actionValue}>
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
          onClose={() => {
            setShowCompose(false);
            setComposeReplyContext(undefined);
          }}
          signedInProtocols={signedInProtocols}
          onPublish={handlePublish}
          replyContext={composeReplyContext}
          onCrossReply={handleCrossReply}
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
          onSchedule={(text, targets, scheduledAt) => schedulePost(text, targets, scheduledAt)}
          scheduledPosts={scheduledPosts}
          onCancelSchedule={(id) => cancelSchedule(id)}
          onPublishScheduledNow={(id) => {
            publishNow(id);
          }}
        />
      </AuthActionContext.Provider>
    </AuthStateContext.Provider>
  );
}
