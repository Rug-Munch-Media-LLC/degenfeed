'use client';

/**
 * @degenfeed/ui — which protocol a cross-protocol reply posts as.
 *
 * Remembers the last choice per parent protocol, and only offers protocols the
 * user is signed into that the bridge can actually reach.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReplyContext } from './types';
import { BRIDGE_REPLY_PROTOCOLS, COMPOSE_TARGETS } from './types';

export interface UseReplyProtocolArgs {
  open: boolean;
  replyContext?: ReplyContext;
  signedInProtocols: Record<string, boolean>;
}

export function useReplyProtocol({ open, replyContext, signedInProtocols }: UseReplyProtocolArgs) {
  const [replyProtocol, setReplyProtocol] = useState<string>(() => {
    if (!replyContext) return '';
    try {
      const stored = localStorage.getItem(`cross-reply-pref:${replyContext.parentProtocol}`);
      if (stored && BRIDGE_REPLY_PROTOCOLS.has(stored)) return stored;
    } catch {
      /* storage unavailable */
    }
    return replyContext.parentProtocol;
  });

  const availableReplyProtocols = useMemo(() => {
    if (!replyContext) return [];
    return COMPOSE_TARGETS.map((t) => t.id).filter(
      (id) =>
        signedInProtocols[id] &&
        (id === replyContext.parentProtocol || BRIDGE_REPLY_PROTOCOLS.has(id)),
    );
  }, [replyContext, signedInProtocols]);

  useEffect(() => {
    if (open && replyContext) setReplyProtocol(replyContext.parentProtocol);
  }, [open, replyContext]);

  const selectReplyProtocol = useCallback(
    (protocol: string) => {
      setReplyProtocol(protocol);
      try {
        if (replyContext) {
          localStorage.setItem(`cross-reply-pref:${replyContext.parentProtocol}`, protocol);
        }
      } catch {
        /* storage unavailable */
      }
    },
    [replyContext],
  );

  const isCrossProtocolReply = !!replyContext && replyContext.parentProtocol !== replyProtocol;

  return { replyProtocol, selectReplyProtocol, availableReplyProtocols, isCrossProtocolReply };
}
