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
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-degen-500 border-t-transparent" />
      </div>
    ),
  },
);

const ComposeModal = dynamic(
  () => import('@degenfeed/ui').then((m) => ({ default: m.ComposeModal })),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-degen-500 border-t-transparent" />
      </div>
    ),
  },
);

import { useWeb3 } from '../components/Web3Provider';
import { triggerOnboarding } from '../hooks/useOnboarding';
import { useScheduledPosts } from '../hooks/useScheduledPosts';
import { useSolanaSignIn } from '../hooks/useSolanaSignIn';
import { useWalletSignIn } from '../hooks/useWalletSignIn';
import { engageNostr, publishNoteToNostr, signBridgeReplyNote } from '../lib/nostr';
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

export interface AuthContextValue {
  signedInProtocols: Record<string, boolean>;
  tokens: Record<string, string>;
  /** Active wallet address (backward-compat: first wallet in the list) */
  walletAddress?: string;
  /** All connected wallet addresses */
  walletAddresses: string[];
  /** Index of the currently active wallet */
  activeWalletIndex: number;
  /** Number of connected wallets */
  walletCount: number;
  /** Metadata for each connected wallet */
  walletMeta: Record<string, StoredWalletMeta>;
  primaryIdentity?: StoredIdentity;
  linkedIdentities: StoredIdentity[];
  isWalletOnly: boolean;
  linkGtsUrl?: string | null;
  nostrPublicId?: string;
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
  // ── Multi-wallet state ──────────────────────────────────────────
  const [walletAddresses, setWalletAddresses] = useState<string[]>([]);
  const [activeWalletIndex, setActiveWalletIndexState] = useState<number>(0);
  const [walletMeta, setWalletMeta] = useState<Record<string, StoredWalletMeta>>({});
  // ── Legacy single-wallet derived state ──────────────────────────
  const walletAddress = walletAddresses[activeWalletIndex] ?? undefined;
  // ──
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

  const { account: wagmiAddress, isConnected, availableWallets } = useWeb3();
  const { signInWithEthereum, signingIn: walletSigningIn } = useWalletSignIn();
  const { signInWithSolana, signingIn: solanaSigningIn } = useSolanaSignIn();
  const { showToast } = useToast();

  // ── Wallet persistence helpers ──────────────────────────────────

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
          const data = (await res.json()) as { address?: string };
          if (data.address) {
            const addr = data.address.toLowerCase();
            const stored = getStoredWallets();
            if (!stored.some((w) => w.address === addr)) {
              addStoredWallet({
                address: addr,
                chain: 'ethereum',
                walletName: null,
                chainId: null,
                addedAt: Date.now(),
              });
              loadWallets();
            }
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
            // Add to wallet list
            const addr = session.address.toLowerCase();
            const meta: StoredWalletMeta = {
              address: addr,
              chain: 'ethereum',
              walletName: null,
              chainId: session.chainId ?? null,
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
                chainId: session.chainId ?? null,
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
        const results: Record<string, { ok: boolean; error?: string }> = data.results ?? {};

        // Show toast with per-protocol results
        const ok = targets.filter((t) => results[t]?.ok);
        const failed = targets.filter((t) => !results[t]?.ok);
        if (ok.length > 0 && failed.length === 0) {
          showToast('success', `Posted to ${ok.length} network${ok.length > 1 ? 's' : ''} \u2705`);
        } else if (ok.length > 0 && failed.length > 0) {
          const failedLabels = failed.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ');
          showToast(
            'warning',
            `Posted to ${ok.length} network${ok.length > 1 ? 's' : ''}, ${failed.length} failed (${failedLabels})`,
          );
        } else {
          const firstError = failed[0] ? results[failed[0]]?.error : '';
          showToast('error', `Publish failed: ${firstError || 'All networks returned errors'}`);
        }

        return results;
      } catch (_err) {
        const results: Record<string, { ok: boolean; error?: string }> = {};
        for (const t of targets) results[t] = { ok: false, error: 'Network error' };
        return results;
      }
    },
    [tokens, showToast],
  );

  const handleCrossReply = useCallback(
    async (
      parentPostUri: string,
      parentProtocol: string,
      replyProtocol: string,
      content: string,
    ): Promise<{ ok: boolean; nativeId?: string; error?: string }> => {
      // Must match BRIDGE_FOOTER in workers/api/src/routes/cross-reply.ts —
      // pre-signed payloads (Nostr, Farcaster) carry the footer client-side.
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

  // ── Multi-wallet actions ──────────────────────────────────────

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = (typeof window !== 'undefined' ? (window as any).ethereum : null) as any;
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
      const removed = stored[index];
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

  const contextValue = useMemo(
    () => ({
      signedInProtocols,
      tokens,
      walletAddress,
      walletAddresses,
      activeWalletIndex,
      walletCount,
      walletMeta,
      primaryIdentity,
      linkedIdentities,
      isWalletOnly,
      linkGtsUrl,
      openSignIn,
      openCompose,
      openComposeReply,
      signOut: handleSignOut,
      nostrPublicId,
      publish: handlePublish,
      engage: handleEngage,
      crossReply: handleCrossReply,
      ready,
      setPrimaryIdentity: handleSetPrimary,
      unlinkIdentity: handleUnlink,
      switchWallet,
      addWallet,
      removeWallet,
    }),
    [
      signedInProtocols,
      tokens,
      walletAddress,
      walletAddresses,
      activeWalletIndex,
      walletCount,
      walletMeta,
      primaryIdentity,
      linkedIdentities,
      isWalletOnly,
      linkGtsUrl,
      openSignIn,
      openCompose,
      openComposeReply,
      handleSignOut,
      nostrPublicId,
      handlePublish,
      handleEngage,
      handleCrossReply,
      ready,
      handleSetPrimary,
      handleUnlink,
      switchWallet,
      addWallet,
      removeWallet,
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
    </AuthContext.Provider>
  );
}
