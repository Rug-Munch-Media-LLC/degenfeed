'use client';

/**
 * @degenfeed/ui — publish side effects (framework-free).
 *
 * The dialog owns the guards; this module owns what actually happens once a
 * submit is allowed: per-protocol status, the Mastodon→Nostr bridge, permanent
 * storage, and the success close. Kept out of the hook so each piece stays
 * readable and directly testable.
 */

import type { TokenGate } from '@degenfeed/token-gate';
import type { ContentProof } from '@degenfeed/types';
import { clearDraft } from '../ComposeDraftManager';
import type { ComposeTarget, ReplyContext } from './types';
import { storePermanently } from './usePermanenceStore';

type SetTargets = React.Dispatch<React.SetStateAction<ComposeTarget[]>>;

export interface PublishArgs {
  text: string;
  targets: ComposeTarget[];
  setTargets: SetTargets;
  onPublish: (
    text: string,
    targets: string[],
    opts: { lensCollect?: boolean; tokenGate?: TokenGate },
  ) => Promise<Record<string, { ok: boolean; error?: string }>>;
  onClose: () => void;
  bridgeToNostr: boolean;
  nostrBridgePublicId?: string;
  onNostrBridge?: (text: string) => void | Promise<void>;
  lensCollect: boolean;
  tokenGate: TokenGate | null;
  makePermanent: boolean;
  onStoringPermanent: (storing: boolean) => void;
  onPermanenceProof: (proof: ContentProof) => void;
}

export interface CrossReplyArgs {
  text: string;
  replyContext: ReplyContext;
  replyProtocol: string;
  setTargets: SetTargets;
  onClose: () => void;
  onCrossReply: (
    parentUri: string,
    parentProtocol: string,
    replyProtocol: string,
    text: string,
  ) => Promise<{ ok: boolean; error?: string }>;
}

const mark = (
  setTargets: SetTargets,
  id: string,
  status: ComposeTarget['status'],
  error?: string,
) => setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, status, error } : t)));

const clearQuietly = () => {
  try {
    clearDraft();
  } catch {
    /* storage unavailable */
  }
};

/** Post a reply through the cross-protocol bridge. */
export async function runCrossReply(args: CrossReplyArgs): Promise<void> {
  const { text, replyContext, replyProtocol, setTargets, onClose, onCrossReply } = args;
  mark(setTargets, replyProtocol, 'sending');
  try {
    const result = await onCrossReply(
      replyContext.parentPostUri,
      replyContext.parentProtocol,
      replyProtocol,
      text.trim(),
    );
    mark(setTargets, replyProtocol, result.ok ? 'sent' : 'failed', result.error);
    if (result.ok) {
      clearQuietly();
      setTimeout(() => onClose(), 1500);
    }
  } catch {
    mark(setTargets, replyProtocol, 'failed', 'Network error');
  }
}

/** Publish the draft to every enabled protocol. */
export async function runPublish(args: PublishArgs): Promise<void> {
  const {
    text,
    targets,
    setTargets,
    onPublish,
    onClose,
    bridgeToNostr,
    nostrBridgePublicId,
    onNostrBridge,
    lensCollect,
    tokenGate,
    makePermanent,
    onStoringPermanent,
    onPermanenceProof,
  } = args;

  const selected = targets.filter((t) => t.enabled).map((t) => t.id);
  setTargets((prev) => prev.map((t) => (t.enabled ? { ...t, status: 'sending' as const } : t)));

  try {
    const opts: { lensCollect?: boolean; tokenGate?: TokenGate } = {};
    if (selected.includes('lens') && lensCollect) opts.lensCollect = true;
    if (tokenGate) opts.tokenGate = tokenGate;
    const results = await onPublish(text, selected, opts);
    setTargets((prev) =>
      prev.map((t) => {
        if (!t.enabled) return t;
        const res = results[t.id];
        return { ...t, status: res?.ok ? 'sent' : 'failed', error: res?.error };
      }),
    );

    if (
      bridgeToNostr &&
      nostrBridgePublicId &&
      selected.includes('mastodon') &&
      results.mastodon?.ok !== false
    ) {
      try {
        await onNostrBridge?.(text);
      } catch {
        /* bridge failure is non-fatal — main post already went out */
      }
    }

    const allOk = selected.every((id) => results[id]?.ok);
    if (!allOk) return;
    clearQuietly();
    if (makePermanent) {
      storePermanently({
        content: text,
        protocols: selected,
        onStoring: onStoringPermanent,
        onProof: onPermanenceProof,
      });
      return;
    }
    setTimeout(() => onClose(), 1500);
  } catch {
    setTargets((prev) =>
      prev.map((t) => (t.enabled ? { ...t, status: 'failed', error: 'Network error' } : t)),
    );
  }
}
