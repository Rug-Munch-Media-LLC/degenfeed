'use client';

import dynamic from 'next/dynamic';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { usePublish } from '../hooks/usePublish';
import { type ScheduledPost, useScheduledPosts } from '../hooks/useScheduledPosts';
import { publishNoteToNostr } from '../lib/nostr';
import { type ComposeReplyContext, useAuthState } from './auth-context';
import { useEngageContext } from './EngageContext';

const ComposeModal = dynamic(
  () => import('@degenfeed/ui').then((m) => ({ default: m.ComposeModal })),
  { ssr: false, loading: () => null },
);

/**
 * Scoped publish context — composer open/close state, publish + scheduling,
 * and the ComposeModal render. Extracted from AuthProvider so opening the
 * composer (or scheduling a post) only re-renders publish consumers instead
 * of the whole app.
 *
 * Mounted inside AuthProvider; the legacy `useAuth().publish` /
 * `useAuth().openCompose` / `useAuth().openComposeReply` surface is
 * re-exported from AuthProvider for backward compatibility.
 */
export interface PublishContextValue {
  /** Open the composer in fresh-post mode. */
  openCompose: () => void;
  /** Open the composer in cross-protocol reply mode for the given parent post. */
  openComposeReply: (ctx: ComposeReplyContext) => void;
  /** Publish a post to the given targets, returning per-protocol results. */
  publish: (
    text: string,
    targets: string[],
    opts?: { lensCollect?: boolean },
  ) => Promise<Record<string, { ok: boolean; error?: string }>>;
  /** Scheduled posts awaiting their publish time. */
  scheduledPosts: ScheduledPost[];
  schedulePost: (text: string, targets: string[], scheduledAt: Date) => void;
  cancelSchedule: (id: string) => void;
  /** Remove a scheduled post (and mark it published) immediately. */
  publishNow: (id: string) => void;
}

const PublishContext = createContext<PublishContextValue | null>(null);

/** Read publish actions. Must be used within a PublishProvider. */
export function usePublishContext(): PublishContextValue {
  const ctx = useContext(PublishContext);
  if (!ctx) throw new Error('usePublishContext must be used within a PublishProvider');
  return ctx;
}

export function PublishProvider({
  children,
  tokens,
  onRequestSignIn,
}: {
  children: ReactNode;
  tokens: Record<string, string>;
  /** Called when the composer asks the user to sign in (opens the SignIn modal). */
  onRequestSignIn: () => void;
}) {
  const { signedInProtocols, primaryIdentity, nostrPublicId } = useAuthState();
  const { crossReply } = useEngageContext();

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
  const publish = usePublish(tokens);

  const openCompose = useCallback(() => {
    setComposeReplyContext(undefined);
    setShowCompose(true);
  }, []);

  const openComposeReply = useCallback((ctx: ComposeReplyContext) => {
    setComposeReplyContext(ctx);
    setShowCompose(true);
  }, []);

  const handleClose = useCallback(() => {
    setShowCompose(false);
    setComposeReplyContext(undefined);
  }, []);

  const handleRequestSignIn = useCallback(() => {
    setShowCompose(false);
    setComposeReplyContext(undefined);
    onRequestSignIn();
  }, [onRequestSignIn]);

  const handleNostrBridge = useCallback(
    async (text: string) => {
      if (!nostrPublicId) return;
      await publishNoteToNostr({ text, publicId: nostrPublicId });
    },
    [nostrPublicId],
  );

  const value = useMemo(
    () => ({
      openCompose,
      openComposeReply,
      publish,
      scheduledPosts,
      schedulePost,
      cancelSchedule,
      publishNow,
    }),
    [
      openCompose,
      openComposeReply,
      publish,
      scheduledPosts,
      schedulePost,
      cancelSchedule,
      publishNow,
    ],
  );

  return (
    <PublishContext.Provider value={value}>
      {children}

      <ComposeModal
        open={showCompose}
        onClose={handleClose}
        signedInProtocols={signedInProtocols}
        onPublish={publish}
        replyContext={composeReplyContext}
        onCrossReply={crossReply}
        onRequestSignIn={handleRequestSignIn}
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
        onNostrBridge={handleNostrBridge}
        onSchedule={schedulePost}
        scheduledPosts={scheduledPosts}
        onCancelSchedule={cancelSchedule}
        onPublishScheduledNow={publishNow}
      />
    </PublishContext.Provider>
  );
}
