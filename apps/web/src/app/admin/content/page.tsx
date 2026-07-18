'use client';

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  protocol: string;
  authorHandle: string;
  authorAddress?: string;
  text: string;
  timestamp: number;
  engagement: { likes: number; replies: number; tips: number };
  score: number;
  status: 'published' | 'flagged' | 'removed' | 'pending';
  flags?: string[];
  mediaUrls?: string[];
}

interface SpamItem {
  id: string;
  contentId: string;
  reason: string;
  confidence: number;
  detectedAt: number;
  status: 'pending' | 'confirmed' | 'false_positive';
  text: string;
  authorHandle: string;
  protocol: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const PROTOCOL_ICONS: Record<string, string> = {
  nostr: '⚡',
  farcaster: '🟣',
  lens: '🌿',
  bluesky: '🦋',
  mastodon: '🐘',
  threads: '🧵',
  reddit: '🔴',
  rss: '📡',
};

// ─── Mock data ────────────────────────────────────────────────────────

const PROTOCOLS = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];
const HANDLES = ['alice_web3', 'bob_nft', 'crypto_kyle', 'defi_dan', 'metaverse_mary'];
const TEXTS: string[] = [
  'Just swapped some ETH for SOL. Bullish on Solana this cycle! 🚀',
  'New NFT collection drop tomorrow. Whitelist spots available!',
  'Does anyone know the best Farcaster client for iOS?',
  'Hot take: Nostr will overtake Twitter within 5 years. 🔥',
  'Check out this new DeFi protocol I found — insane APY!',
  'gm ☕️ another day in the web3 trenches',
  'Published my research on zk-rollups vs optimistic rollups',
  'Who else is going to ETHDenver this year?',
  'Free mint alert! New project on Base, 10K supply',
  'The fediverse is the future of social media. Period.',
];

const MOCK_CONTENT: ContentItem[] = Array.from({ length: 20 }, (_, i) => ({
  id: `content-${i + 1}`,
  protocol: PROTOCOLS[i % 5] || 'nostr',
  authorHandle: HANDLES[i % 5] || 'unknown',
  text: TEXTS[i % 10] || '',
  timestamp: Date.now() - Math.random() * 7 * 86400000,
  engagement: {
    likes: Math.floor(Math.random() * 200),
    replies: Math.floor(Math.random() * 40),
    tips: Math.floor(Math.random() * 10),
  },
  score: Math.random(),
  status: i < 3 ? 'flagged' : i === 4 ? 'removed' : 'published',
  flags: i < 3 ? ['possible_spam', 'high_mention_count'] : undefined,
}));

const MOCK_SPAM: SpamItem[] = [
  {
    id: 'spam-1',
    contentId: 'content-x1',
    reason: 'Repeated link dropping',
    confidence: 0.92,
    detectedAt: Date.now() - 3600000,
    status: 'pending',
    text: 'FREE ETH!!! Claim your airdrop at http://scam-link.xyz now!!!',
    authorHandle: 'scam_bot_42',
    protocol: 'nostr',
  },
  {
    id: 'spam-2',
    contentId: 'content-x2',
    reason: 'Pump and dump',
    confidence: 0.87,
    detectedAt: Date.now() - 7200000,
    status: 'pending',
    text: 'BUY BUY BUY!!! This coin is going to $100!!! Dont miss out!!!',
    authorHandle: 'pumpdumper_99',
    protocol: 'farcaster',
  },
  {
    id: 'spam-3',
    contentId: 'content-x3',
    reason: 'Impersonation',
    confidence: 0.95,
    detectedAt: Date.now() - 10800000,
    status: 'pending',
    text: 'I am Vitalik. Send me ETH and I will send you back 2x.',
    authorHandle: 'vitalik.eth_fake',
    protocol: 'lens',
  },
  {
    id: 'spam-4',
    contentId: 'content-x4',
    reason: 'Duplicate content',
    confidence: 0.76,
    detectedAt: Date.now() - 14400000,
    status: 'confirmed',
    text: 'Check out my new project! 🚀',
    authorHandle: 'spammy_mcgee',
    protocol: 'bluesky',
  },
];

// ─── Component ────────────────────────────────────────────────────────

export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState<'feed' | 'spam' | 'trending'>('feed');
  const [content, setContent] = useState<ContentItem[]>(MOCK_CONTENT);
  const [spam, setSpam] = useState<SpamItem[]>(MOCK_SPAM);
  const [loading, setLoading] = useState(true);
  const [protocolFilter, setProtocolFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchContent = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (protocolFilter) params.set('protocol', protocolFilter);
      const res = await fetch(`/api/admin/content?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { content: ContentItem[] };
        if (data.content) setContent(data.content);
      }
    } catch {
      /* use defaults */
    }
  }, [protocolFilter]);

  const fetchSpam = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/content/spam', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { items: SpamItem[] };
        if (data.items) setSpam(data.items);
      }
    } catch {
      /* use defaults */
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchContent(), fetchSpam()]).finally(() => setLoading(false));
  }, [fetchContent, fetchSpam]);

  const handleModerate = useCallback(
    async (contentId: string, action: 'remove' | 'approve' | 'feature') => {
      setActionLoading(contentId);
      try {
        const res = await fetch(`/api/admin/content/${contentId}/${action}`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          showToast(`Content ${action}d`);
          setContent((prev) =>
            prev.map((c) =>
              c.id === contentId
                ? { ...c, status: action === 'remove' ? 'removed' : 'published' }
                : c,
            ),
          );
        } else {
          showToast(`Failed to ${action}`, 'error');
        }
      } catch {
        showToast('Network error', 'error');
      } finally {
        setActionLoading(null);
      }
    },
    [showToast],
  );

  const handleSpamAction = useCallback(
    async (spamId: string, action: 'confirm' | 'false_positive') => {
      setActionLoading(spamId);
      try {
        const res = await fetch(`/api/admin/content/spam/${spamId}/${action}`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          showToast(`Spam item ${action === 'confirm' ? 'confirmed' : 'marked as false positive'}`);
          setSpam((prev) =>
            prev.map((s) =>
              s.id === spamId
                ? { ...s, status: action === 'confirm' ? 'confirmed' : 'false_positive' }
                : s,
            ),
          );
        } else {
          showToast(`Failed to ${action} spam`, 'error');
        }
      } catch {
        showToast('Network error', 'error');
      } finally {
        setActionLoading(null);
      }
    },
    [showToast],
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--color-muted)]">Loading content…</p>
        </div>
      </div>
    );
  }

  const flaggedCount = content.filter((c) => c.status === 'flagged').length;
  const pendingSpam = spam.filter((s) => s.status === 'pending').length;

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl transition-all ${
            toast.kind === 'success'
              ? 'border border-green-500/30 bg-green-900/40 text-green-300'
              : 'border border-red-500/30 bg-red-900/40 text-red-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Content Management</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Feed moderation, spam queue, and trending curation
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {[
          { key: 'feed', label: '📝 Content Feed', badge: flaggedCount } as const,
          { key: 'spam', label: '🚫 Spam Queue', badge: pendingSpam } as const,
          { key: 'trending', label: '🔥 Trending Curation' } as const,
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-degen-500/15 text-degen-400'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-muted)]'
            }`}
          >
            {tab.label}
            {'badge' in tab && tab.badge !== undefined && tab.badge > 0 && (
              <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content Feed Tab ── */}
      {activeTab === 'feed' && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <select
              value={protocolFilter}
              onChange={(e) => setProtocolFilter(e.target.value)}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-fg)] focus:border-degen-500 focus:outline-none"
            >
              <option value="">All Protocols</option>
              {[
                'nostr',
                'farcaster',
                'lens',
                'bluesky',
                'mastodon',
                'threads',
                'reddit',
                'rss',
              ].map((p) => (
                <option key={p} value={p}>
                  {PROTOCOL_ICONS[p] || ''} {p}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--color-muted)]">{content.length} items</span>
          </div>

          <div className="space-y-3">
            {content.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border bg-[var(--color-card)] p-4 transition-colors ${
                  item.status === 'flagged'
                    ? 'border-yellow-500/20'
                    : item.status === 'removed'
                      ? 'border-red-500/20 opacity-50'
                      : 'border-[var(--color-border)]'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Meta row */}
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs">{PROTOCOL_ICONS[item.protocol]}</span>
                      <span className="text-xs font-medium text-[var(--color-fg)]">
                        @{item.authorHandle}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          item.status === 'flagged'
                            ? 'bg-yellow-500/15 text-yellow-400'
                            : item.status === 'removed'
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-degen-500/15 text-degen-400'
                        }`}
                      >
                        {item.status}
                      </span>
                      {item.flags?.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] text-orange-400"
                        >
                          {f.replace(/_/g, ' ')}
                        </span>
                      ))}
                      <span className="text-[10px] text-gray-600">
                        {formatTime(item.timestamp)}
                      </span>
                    </div>

                    {/* Content */}
                    <p className="text-sm text-[var(--color-fg)] line-clamp-3">{item.text}</p>

                    {/* Engagement */}
                    <div className="mt-2 flex items-center gap-4 text-[10px] text-[var(--color-muted)]">
                      <span>❤️ {formatCount(item.engagement.likes)}</span>
                      <span>💬 {formatCount(item.engagement.replies)}</span>
                      <span>💸 {formatCount(item.engagement.tips)}</span>
                      <span className="ml-auto">
                        Score:{' '}
                        <span className={item.score > 0.7 ? 'text-degen-400' : 'text-[var(--color-muted)]'}>
                          {(item.score * 100).toFixed(0)}%
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {item.status !== 'removed' && (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        disabled={actionLoading === item.id}
                        onClick={() => handleModerate(item.id, 'remove')}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                      >
                        {actionLoading === item.id ? '…' : '✕ Remove'}
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === item.id}
                        onClick={() => handleModerate(item.id, 'feature')}
                        className="rounded-lg border border-degen-500/30 px-3 py-1.5 text-[10px] font-medium text-degen-400 transition-colors hover:bg-degen-500/10 disabled:opacity-40"
                      >
                        ★ Feature
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Spam Queue Tab ── */}
      {activeTab === 'spam' && (
        <div className="space-y-3">
          {spam.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] py-16 text-center">
              <div className="mb-3 text-3xl">✅</div>
              <p className="text-sm text-[var(--color-muted)]">No spam in the queue.</p>
            </div>
          ) : (
            spam.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border bg-[var(--color-card)] p-4 ${
                  item.status === 'pending'
                    ? 'border-red-500/20'
                    : 'border-[var(--color-border)] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-400">
                        {(item.confidence * 100).toFixed(0)}% confidence
                      </span>
                      <span className="text-xs">
                        {PROTOCOL_ICONS[item.protocol]} {item.protocol}
                      </span>
                      <span className="text-xs text-[var(--color-muted)]">@{item.authorHandle}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          item.status === 'pending'
                            ? 'bg-yellow-500/15 text-yellow-400'
                            : item.status === 'confirmed'
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-green-500/15 text-green-400'
                        }`}
                      >
                        {item.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {formatTime(item.detectedAt)}
                      </span>
                    </div>
                    <p className="mb-1 text-sm text-[var(--color-fg)] line-clamp-2">{item.text}</p>
                    <p className="text-[10px] text-[var(--color-muted)]">Reason: {item.reason}</p>
                  </div>

                  {item.status === 'pending' && (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        disabled={actionLoading === item.id}
                        onClick={() => handleSpamAction(item.id, 'confirm')}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                      >
                        {actionLoading === item.id ? '…' : '🚫 Confirm Spam'}
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === item.id}
                        onClick={() => handleSpamAction(item.id, 'false_positive')}
                        className="rounded-lg border border-green-500/30 px-3 py-1.5 text-[10px] font-medium text-green-400 transition-colors hover:bg-green-500/10 disabled:opacity-40"
                      >
                        {actionLoading === item.id ? '…' : '✓ False Positive'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Trending Curation Tab ── */}
      {activeTab === 'trending' && (
        <div>
          <p className="mb-4 text-sm text-[var(--color-muted)]">
            Curate trending content. Items with high engagement are auto-promoted.
          </p>
          <div className="space-y-3">
            {[...content]
              .sort((a, b) => b.engagement.likes - a.engagement.likes)
              .slice(0, 10)
              .map((item, i) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-yellow-500/20 to-orange-500/20 text-sm font-bold text-yellow-400">
                      #{i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs">{PROTOCOL_ICONS[item.protocol]}</span>
                        <span className="text-xs font-medium text-[var(--color-fg)]">
                          @{item.authorHandle}
                        </span>
                        <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                          <span>❤️ {formatCount(item.engagement.likes)}</span>
                          <span>💬 {formatCount(item.engagement.replies)}</span>
                          <span>💸 {formatCount(item.engagement.tips)}</span>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--color-fg)] line-clamp-2">{item.text}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleModerate(item.id, 'feature')}
                        disabled={actionLoading === item.id}
                        className="rounded-lg bg-degen-500/20 px-3 py-1.5 text-[10px] font-medium text-degen-400 transition-colors hover:bg-degen-500/30 disabled:opacity-40"
                      >
                        {actionLoading === item.id ? '…' : '★ Feature'}
                      </button>
                      {item.status !== 'removed' && (
                        <button
                          type="button"
                          onClick={() => handleModerate(item.id, 'remove')}
                          disabled={actionLoading === item.id}
                          className="rounded-lg border border-red-500/30 px-2 py-1.5 text-[10px] text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
