import type { UnifiedPost } from '@degenfeed/types';

export const WORDS_PER_MINUTE = 200;
export function estimateReadTime(text: string): string { const words = text.trim().split(/\s+/).length; return `${Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))} min read`; }

export const PROTOCOL_LABELS: Record<string, string> = { nostr: 'Nostr', farcaster: 'Farcaster', lens: 'Lens', bluesky: 'Bluesky', threads: 'Threads (Experimental)', mastodon: 'Mastodon', lemmy: 'Lemmy', rss: 'RSS', reddit: 'Reddit' };
export function protocolLabel(p: string): string { return PROTOCOL_LABELS[p] ?? p; }

export interface EmbedData { title?: string; description?: string; image?: string; siteName?: string; }
export interface FrameData { image: string; title?: string; buttons: Array<{ index: number; label: string; action?: string; target?: string }>; postUrl?: string; version: string; state?: string; }

export interface ThreadReply extends UnifiedPost { bridged?: boolean; bridgeFrom?: string; viaCrossPost?: boolean; depth?: number; parentUri?: string; }
export interface ThreadData { post: UnifiedPost | null; replies: ThreadReply[]; protocols: string[]; bridgeCount: number; byProtocol: Record<string, number>; }
export type ThreadSort = 'chrono' | 'top' | 'protocol';

export interface ThreadNode { reply: ThreadReply; children: ThreadNode[]; }

export function sortReplies(replies: ThreadReply[], mode: ThreadSort): ThreadReply[] {
  const score = (r: ThreadReply) => r.metrics.likes + r.metrics.reposts * 2 + r.metrics.replies;
  const out = [...replies];
  if (mode === 'top') out.sort((a, b) => score(b) - score(a) || a.createdAt - b.createdAt);
  else if (mode === 'protocol') out.sort((a, b) => a.protocol.localeCompare(b.protocol) || a.createdAt - b.createdAt);
  else out.sort((a, b) => a.createdAt - b.createdAt);
  return out;
}

export function buildThreadTree(replies: ThreadReply[], rootUri: string, mode: ThreadSort): ThreadNode[] {
  const sorted = sortReplies(replies, mode);
  const nodes = new Map<string, ThreadNode>();
  for (const r of sorted) nodes.set(r.dfUri ?? `df://${r.id}`, { reply: r, children: [] });
  const roots: ThreadNode[] = [];
  for (const node of nodes.values()) { const pu = node.reply.parentUri; const p = pu && pu !== rootUri ? nodes.get(pu) : undefined; if (p && p !== node) p.children.push(node); else roots.push(node); }
  return roots;
}
