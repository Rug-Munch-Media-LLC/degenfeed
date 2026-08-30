'use client';

import type { StoredIdentity } from '@degenfeed/storage';
import type { EngagementAction } from '@degenfeed/types';
import { createContext, useContext } from 'react';
import type { StoredWalletMeta } from '../lib/walletStorage';

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
  /** True while a wallet sign-in request is in flight */
  signingIn: boolean;
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
  /** Open the sign-in modal directly on the "Create Account" tab. */
  openSignUp: () => void;
  /** Trigger a sign-in for a protocol directly (wallet, email, nsec, …). */
  signIn: (protocol: string, credentials?: string | Record<string, string>) => Promise<void>;
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
  /** Reload identities + wallets from local storage (after linking/unlinking). */
  refresh: () => Promise<void>;
}

/** Combined type for backward compatibility with existing consumers */
export interface AuthContextValue extends AuthStateValue, AuthActionValue {}

export const AuthStateContext = createContext<AuthStateValue | null>(null);
export const AuthActionContext = createContext<AuthActionValue | null>(null);

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
