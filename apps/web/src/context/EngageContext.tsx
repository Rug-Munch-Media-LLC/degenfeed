'use client';

import type { StoredIdentity } from '@degenfeed/storage';
import type { EngagementAction } from '@degenfeed/types';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { useCrossReply } from '../hooks/useCrossReply';
import { useEngage } from '../hooks/useEngage';

/**
 * Scoped engagement context — like/boost/reply + cross-protocol replies.
 *
 * Extracted from AuthProvider so a change in engagement logic (or the
 * identities it depends on) only re-renders components that consume this
 * context, instead of the whole app.
 *
 * Mounted inside AuthProvider; the legacy `useAuth().engage` /
 * `useAuth().crossReply` surface is re-exported from AuthProvider for
 * backward compatibility.
 */
export interface EngageContextValue {
  /** Like/boost/reply across all supported protocols. */
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
}

const EngageContext = createContext<EngageContextValue | null>(null);

/** Read engagement actions. Must be used within an EngageProvider. */
export function useEngageContext(): EngageContextValue {
  const ctx = useContext(EngageContext);
  if (!ctx) throw new Error('useEngageContext must be used within an EngageProvider');
  return ctx;
}

export function EngageProvider({
  children,
  identities,
  walletAddress,
  primaryIdentity,
}: {
  children: ReactNode;
  identities: StoredIdentity[];
  walletAddress?: string;
  primaryIdentity?: StoredIdentity;
}) {
  const engage = useEngage(identities);
  const crossReply = useCrossReply(identities, walletAddress, primaryIdentity);
  const value = useMemo(() => ({ engage, crossReply }), [engage, crossReply]);

  return <EngageContext.Provider value={value}>{children}</EngageContext.Provider>;
}
