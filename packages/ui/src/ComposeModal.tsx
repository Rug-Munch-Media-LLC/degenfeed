'use client';

/**
 * @degenfeed/ui — ComposeModal (facade).
 *
 * The headline feature: compose once, publish to multiple protocols.
 * This file is only the public contract + dialog mounting; state lives in
 * ./compose/useComposeController and the layout in ./compose/ComposeDialogView.
 *
 * Features:
 *   - Per-protocol toggles, character limits and live counters
 *   - Slash commands (/poll, /image, /link, /code, /thread, /schedule)
 *   - Draft autosave, Ctrl+Enter submit, schedule picker
 *   - Cross-protocol reply mode, Mastodon→Nostr bridge, permanent storage
 *   - Focus trap, Escape/backdrop close, labelled controls
 *
 * Auth tiers:
 *   Not signed in → "Sign in to compose" CTA
 *   Signed in (1+ protocols) → toggles show available protocols
 */

import type { TokenGate } from '@degenfeed/token-gate';
import { ComposeDialogView } from './compose/ComposeDialogView';
import type { ReplyContext, ScheduledPostItem } from './compose/types';
import { useComposeController } from './compose/useComposeController';

export type { ReplyContext, ScheduledPostItem } from './compose/types';

export interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  /** Map of protocol IDs the user is signed into. */
  signedInProtocols: Record<string, boolean>;
  /** Called when the user publishes. Returns per-protocol results. */
  onPublish: (
    text: string,
    targets: string[],
    opts?: { lensCollect?: boolean; tokenGate?: TokenGate },
  ) => Promise<Record<string, { ok: boolean; error?: string }>>;
  /** Called when a disconnected protocol is clicked. */
  onRequestSignIn?: (protocol: string) => void;
  /** Primary identity used for publish preview. */
  primaryIdentity?: { displayName?: string; handle?: string; avatarUrl?: string };
  /** Public key of the user's Nostr identity, if any. Used to enable the bridge toggle. */
  nostrBridgePublicId?: string;
  /** Called when the bridge toggle fires. Receives the trimmed post text. */
  onNostrBridge?: (text: string) => void | Promise<void>;
  /** Called when the user schedules a post. */
  onSchedule?: (text: string, targets: string[], scheduledAt: Date) => void;
  /** List of upcoming scheduled posts to display. */
  scheduledPosts?: ScheduledPostItem[];
  /** Called to cancel a scheduled post. */
  onCancelSchedule?: (id: string) => void;
  /** Called to publish a scheduled post immediately. */
  onPublishScheduledNow?: (id: string) => void;
  /** Pre-fill text content (e.g. from translation result) */
  prefillText?: string;
  /** Pre-select these protocols when opening (e.g. translation target) */
  preselectProtocols?: string[];
  /** Label shown in the prefill banner (e.g. "Translated from Farcaster") */
  prefillLabel?: string;
  /** Cross-protocol reply context — when set, compose enters reply mode. */
  replyContext?: ReplyContext;
  /** Called for cross-protocol replies instead of normal publish. */
  onCrossReply?: (
    parentPostUri: string,
    parentProtocol: string,
    replyProtocol: string,
    content: string,
  ) => Promise<{ ok: boolean; nativeId?: string; error?: string }>;
}

export function ComposeModal(props: ComposeModalProps) {
  const controller = useComposeController(props);
  if (!props.open) return null;
  return <ComposeDialogView c={controller} />;
}
