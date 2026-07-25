'use client';

import { getProtocolColor } from '@degenfeed/ui';
import { protocolLabel } from './types';

export function PostReplyComposer({ signedIn, replyProtocol, onReplyProtocolChange, postProtocol, replyText, onReplyTextChange, onReply, replying, replyError, textareaRef, openSignIn }: {
  signedIn: string[]; replyProtocol: string | null; onReplyProtocolChange: (p: string) => void; postProtocol: string;
  replyText: string; onReplyTextChange: (t: string) => void; onReply: () => void; replying: boolean;
  replyError: string | null; textareaRef: React.RefObject<HTMLTextAreaElement | null>; openSignIn: () => void;
}) {
  if (signedIn.length === 0) {
    return <div className="card mt-4 border border-[var(--color-glass-border)] bg-white/[0.02] py-6 text-center"><p className="text-sm text-[var(--color-muted)]"><button type="button" onClick={openSignIn} className="text-degen-400 hover:text-degen-300 transition-colors underline">Sign in</button> to reply to this post</p></div>;
  }
  return (
    <div className="card mt-4 border border-[var(--color-glass-border)] bg-white/[0.02]">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--color-glass-border)] px-4 py-2.5">
        <span className="mr-1 text-[11px] text-[var(--color-muted)]">Reply as:</span>
        {signedIn.map((p) => { const active = (replyProtocol ?? postProtocol) === p; const color = getProtocolColor(p);
          return <button key={p} type="button" onClick={() => onReplyProtocolChange(p)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${active ? '' : 'border-[var(--color-glass-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
            style={active ? { backgroundColor: `${color}22`, color, borderColor: `${color}66` } : undefined}>{protocolLabel(p)}{p !== postProtocol && ' ↔'}</button>; })}
      </div>
      {replyProtocol && replyProtocol !== postProtocol && <p className="px-4 pt-2 text-[11px] text-degen-400">↔ Bridging your reply from {protocolLabel(replyProtocol)} to this {protocolLabel(postProtocol)} post</p>}
      <textarea ref={textareaRef} value={replyText} onChange={(e) => { onReplyTextChange(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`; }}
        placeholder="Post your reply" rows={3} className="w-full resize-none bg-transparent p-4 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none" />
      {replyError && <p className="px-4 pb-1 text-xs text-red-400">{replyError}</p>}
      <div className="flex items-center justify-between border-t border-[var(--color-glass-border)] px-4 py-3">
        <span className={`text-xs ${replyText.length > 500 ? 'text-red-400' : replyText.length > 400 ? 'text-yellow-400' : 'text-[var(--color-muted)]'}`}>{replyText.length}</span>
        <button type="button" onClick={onReply} disabled={!replyText.trim() || replying} className="btn-primary px-4 text-sm disabled:opacity-50">{replying ? 'Replying…' : 'Reply'}</button>
      </div>
    </div>
  );
}
