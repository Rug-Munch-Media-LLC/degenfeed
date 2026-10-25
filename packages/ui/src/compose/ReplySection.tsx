'use client';

/**
 * @degenfeed/ui — reply-mode footer: preview, limit, submit.
 */

import { ComposePreview } from '../ComposePreview';
import { getProtocolLabel } from '../ProtocolBadge';
import { ComposeFooter } from './ComposeFooter';
import type { ComposeTarget } from './types';

export interface ReplySectionProps {
  text: string;
  replyProtocol: string;
  charLimit: number;
  isCrossProtocol: boolean;
  targets: ComposeTarget[];
  publishing: boolean;
  primaryIdentity?: { displayName?: string; handle?: string; avatarUrl?: string };
  onPublish: () => void;
}

export function ReplySection({
  text,
  replyProtocol,
  charLimit,
  isCrossProtocol,
  targets,
  publishing,
  primaryIdentity,
  onPublish,
}: ReplySectionProps) {
  const canSubmit = text.trim().length > 0 && text.length <= charLimit && !publishing;
  return (
    <div className="border-t border-[var(--color-border)] px-4 py-3">
      <ComposePreview
        text={text}
        targets={[{ id: replyProtocol, enabled: true, charLimit }]}
        author={text.trim() ? primaryIdentity : undefined}
      />
      <ComposeFooter
        textLength={text.length}
        charLimit={charLimit}
        canSubmit={canSubmit}
        publishing={publishing}
        busyLabel="⏳ Replying…"
        primaryLabel={`Reply as ${getProtocolLabel(replyProtocol)}${isCrossProtocol ? ' ↔' : ''}`}
        failureMessage={targets.find((t) => t.id === replyProtocol)?.error}
        onClick={onPublish}
      />
    </div>
  );
}
