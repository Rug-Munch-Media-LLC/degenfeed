'use client';

import { getProtocolColor } from '@degenfeed/ui';
import { formatTimeAgo } from '@degenfeed/utils';
import { QuickTipButton } from '../QuickTipButton';
import type { ThreadData, ThreadNode, ThreadReply, ThreadSort } from './types';
import { protocolLabel } from './types';

function ThreadReplyCard({ node, opAuthorId, parentProtocol, depth = 0 }: {
  node: ThreadNode; opAuthorId?: string; parentProtocol?: string; depth?: number;
}) {
  const { reply, children } = node;
  const color = getProtocolColor(reply.protocol);
  const isOp = !!opAuthorId && reply.author.id === opAuthorId;
  const bridgeSource = reply.bridgeFrom ?? reply.protocol;
  const isCross = parentProtocol != null && reply.protocol !== parentProtocol;
  return (
    <div className={depth > 0 ? 'mt-2' : ''}>
      <div className={`rounded-xl border p-4 ${isOp ? 'border-degen-500/40 bg-degen-500/[0.04]' : 'border-[var(--color-glass-border)] bg-white/[0.01]'}`} style={{ borderLeftWidth: 3, borderLeftColor: color }}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-medium text-xs text-[var(--color-fg)] truncate">{reply.author.displayName}</span>
          {isOp && <span className="rounded-full bg-degen-500/20 px-1.5 py-0.5 text-[9px] font-bold text-degen-400">OP</span>}
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ backgroundColor: `${color}22`, color }}>{protocolLabel(reply.protocol)}</span>
          {isCross && <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-degen-400" style={{ backgroundColor: '#a855f718' }} title={`Replied from ${protocolLabel(bridgeSource)}`}>↔ {protocolLabel(bridgeSource)}</span>}
          <span className="text-[10px] text-[var(--color-muted)]">{formatTimeAgo(reply.createdAt)} ago</span>
        </div>
        {isCross && <p className="mb-1.5 text-[10px] italic text-degen-400/80">↔ Replied from {protocolLabel(bridgeSource)} via DegenFeed bridge</p>}
        <p className="text-xs leading-relaxed text-[var(--color-muted)] whitespace-pre-wrap break-words line-clamp-6">{reply.text}</p>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
          <span>{reply.metrics.likes} likes</span><span>{reply.metrics.reposts} reposts</span><span>{reply.metrics.replies} replies</span>
          <span className="ml-auto"><QuickTipButton recipientProtocol={reply.protocol} recipientAuthorId={reply.author.id} recipientDisplayName={reply.author.displayName} publicationId={reply.id} subtle /></span>
        </div>
      </div>
      {children.length > 0 && <div className="ml-4 border-l-2 pl-3" style={{ borderColor: `${color}44` }}>{children.map((child) => <ThreadReplyCard key={child.reply.id} node={child} opAuthorId={opAuthorId} parentProtocol={parentProtocol} depth={depth + 1} />)}</div>}
    </div>
  );
}

function ProtocolReplyPills({ byProtocol }: { byProtocol: Record<string, number> }) {
  const entries = Object.entries(byProtocol).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return <div className="flex flex-wrap gap-1.5">{entries.map(([p, n]) => { const color = getProtocolColor(p); return <span key={p} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${color}18`, color }}>{protocolLabel(p)} {n}</span>; })}</div>;
}

export function PostThread({ replies, thread, byProtocol, threadTree, sortMode, onSortModeChange, opAuthorId, parentProtocol, loaded }: {
  replies: ThreadReply[]; thread: ThreadData | null; byProtocol: Record<string, number>; threadTree: ThreadNode[];
  sortMode: ThreadSort; onSortModeChange: (mode: ThreadSort) => void; opAuthorId?: string; parentProtocol: string; loaded: boolean;
}) {
  return (
    <section className="mt-6">
      {replies.length > 0 ? (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="font-semibold text-[var(--color-fg)] text-sm">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}{(thread?.protocols.length ?? 0) > 1 && <span className="ml-1.5 text-degen-400"> across {thread?.protocols.length} protocols</span>}</h2><ProtocolReplyPills byProtocol={byProtocol} /></div>
            <div className="flex gap-1">{([['chrono', 'Chronological'], ['top', 'Top'], ['protocol', 'By Protocol']] as [ThreadSort, string][]).map(([mode, label]) => (
              <button key={mode} type="button" onClick={() => onSortModeChange(mode)} className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${sortMode === mode ? 'bg-degen-500/20 text-degen-400' : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}>{label}</button>
            ))}</div>
          </div>
          <div className="space-y-2">{threadTree.map((node) => <ThreadReplyCard key={node.reply.id} node={node} opAuthorId={opAuthorId} parentProtocol={parentProtocol} />)}</div>
        </>
      ) : loaded && <div className="card border border-[var(--color-glass-border)] bg-white/[0.02] py-12 text-center"><p className="text-sm text-[var(--color-muted)]">No replies yet</p><p className="mt-1 text-xs text-[var(--color-muted)]">Be the first to join the conversation</p></div>}
    </section>
  );
}
