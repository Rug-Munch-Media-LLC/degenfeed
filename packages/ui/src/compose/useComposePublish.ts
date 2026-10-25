'use client';

/**
 * @degenfeed/ui — submit guards for the composer.
 *
 * Owns only the "may this fire, and only once" decision plus the publishing
 * flag; the side effects live in publishPipeline.
 */

import type { TokenGate } from '@degenfeed/token-gate';
import type { ContentProof } from '@degenfeed/types';
import { useCallback, useRef, useState } from 'react';
import { clearDraft } from '../ComposeDraftManager';
import {
  type CrossReplyArgs,
  type PublishArgs,
  runCrossReply,
  runPublish,
} from './publishPipeline';
import type { ComposeTarget, ReplyContext } from './types';

export interface UseComposePublishArgs extends Omit<PublishArgs, 'setTargets' | 'text'> {
  text: string;
  setTargets: React.Dispatch<React.SetStateAction<ComposeTarget[]>>;
  scheduledAt: Date | null;
  onSchedule?: (text: string, targets: string[], at: Date) => void;
  replyContext?: ReplyContext;
  replyProtocol: string;
  onCrossReply?: CrossReplyArgs['onCrossReply'];
}

export interface UseComposePublish {
  publishing: boolean;
  handlePublish: () => Promise<void>;
  handleSchedule: () => void;
}

export function useComposePublish(args: UseComposePublishArgs): UseComposePublish {
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false);
  const {
    text,
    targets,
    setTargets,
    onPublish,
    onClose,
    scheduledAt,
    onSchedule,
    replyContext,
    replyProtocol,
    onCrossReply,
  } = args;

  const handleSchedule = useCallback(() => {
    if (!text.trim() || !scheduledAt || publishingRef.current) return;
    if (scheduledAt <= new Date()) return;
    const selected = targets.filter((t) => t.enabled).map((t) => t.id);
    if (selected.length === 0) return;
    publishingRef.current = true;
    setPublishing(true);
    try {
      onSchedule?.(text.trim(), selected, scheduledAt);
      clearDraft();
    } catch {
      /* storage unavailable — scheduling already dispatched */
    }
    publishingRef.current = false;
    setPublishing(false);
    onClose();
  }, [text, targets, scheduledAt, onSchedule, onClose]);

  const handlePublish = useCallback(async () => {
    if (!text.trim() || publishingRef.current) return;
    publishingRef.current = true;
    setPublishing(true);
    try {
      if (replyContext && onCrossReply) {
        await runCrossReply({
          text,
          replyContext,
          replyProtocol,
          setTargets,
          onClose,
          onCrossReply,
        });
        return;
      }
      await runPublish({ ...args, text, targets, setTargets, onPublish, onClose });
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  }, [
    args,
    text,
    targets,
    setTargets,
    onPublish,
    onClose,
    replyContext,
    replyProtocol,
    onCrossReply,
  ]);

  return { publishing, handlePublish, handleSchedule };
}

export type { ContentProof, TokenGate };
