'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// === Types =================================================

interface Subscriber {
  email: string;
  tier: 'free' | 'paid' | 'token-gated';
  subscribedAt: number;
  active: boolean;
}

interface SubscriberResponse {
  subscribers: Subscriber[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface SubscriberCounts {
  total: number;
  free: number;
  paid: number;
  token: number;
}

interface NewsletterStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
}

interface SendResult {
  success: boolean;
  sent: number;
  failed: number;
  campaignId: string;
  provider: 'mailgun' | 'sendgrid';
  errors?: string[];
}

type TabId = 'compose' | 'subscribers' | 'analytics' | 'templates';

// === Helpers ===============================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}


// === Stat Card =============================================

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="card relative overflow-hidden border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl transition-all duration-300 hover:border-degen-500/20 hover:shadow-[0_0_30px_rgba(0,255,65,0.06)]">
      <div
        className="absolute right-0 top-0 h-1 w-full opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accent})` }}
      />
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
        {label}
      </span>
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--color-fg)]">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

// === Mini Progress =========================================

function MiniProgress({
  value,
  total,
  color,
  label,
}: {
  value: number;
  total: number;
  color: string;
  label: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-20 shrink-0 text-xs text-[var(--color-muted)]">{label}</span>
      <div
        className="flex-1 overflow-hidden rounded-full bg-[var(--color-card)]"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }}
        />
      </div>
      <span className="w-16 text-right text-xs font-medium tabular-nums text-[var(--color-fg)]">
        {formatNumber(value)}
      </span>
    </div>
  );
}

// === Main Component ========================================

export default function CreatorNewsletterPage() {
  const [activeTab, setActiveTab] = useState<TabId>('compose');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [counts, setCounts] = useState<SubscriberCounts>({ total: 0, free: 0, paid: 0, token: 0 });
  const [stats, setStats] = useState<NewsletterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const mountedRef = useRef(true);

  // Compose form state
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [tier, setTier] = useState<'free' | 'paid' | 'token-gated'>('free');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  // === Load subscriber counts ================================

  useEffect(() => {
    mountedRef.current = true;
    const load = async () => {
      try {
        const [countRes, subRes] = await Promise.all([
          fetch('/api/newsletter/creator/count', { credentials: 'include' }),
          fetch('/api/newsletter/creator/subscribers?limit=50', { credentials: 'include' }),
        ]);

        if (countRes.ok) {
          const c = (await countRes.json()) as SubscriberCounts;
          if (mountedRef.current) setCounts(c);
        }

        if (subRes.ok) {
          const s = (await subRes.json()) as SubscriberResponse;
          if (mountedRef.current) {
            setSubscribers(s.subscribers);
            setHasMore(s.hasMore);
          }
        }
      } catch (e) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to load data');
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    load();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // === Load more subscribers ================================

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    try {
      const res = await fetch(`/api/newsletter/creator/subscribers?limit=50&page=${nextPage}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as SubscriberResponse;
        setSubscribers((prev) => [...prev, ...data.subscribers]);
        setHasMore(data.hasMore);
        setPage(nextPage);
      }
    } catch {
      // silent
    }
  }, [page]);

  // === Load analytics stats for a post ======================

  const loadStats = useCallback(async (postId: string) => {
    try {
      const res = await fetch(`/api/newsletter/creator/stats/${postId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as NewsletterStats;
        setStats(data);
      }
    } catch {
      // silent
    }
  }, []);

  // === Send newsletter ======================================

  const handleSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!subject.trim() || !content.trim()) return;

      setSending(true);
      setSendResult(null);

      try {
        const res = await fetch('/api/newsletter/creator/send', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            subject: subject.trim(),
            html: content,
            tier,
            postId: `manual-${Date.now()}`,
          }),
        });

        const data = (await res.json()) as { ok?: boolean; result?: SendResult; error?: string };
        if (data.ok && data.result) {
          setSendResult(data.result);
          if (data.result.success) {
            setSubject('');
            setContent('');
          }
        } else {
          setSendResult({
            success: false,
            sent: 0,
            failed: 0,
            campaignId: '',
            provider: 'mailgun',
            errors: [data.error ?? 'Unknown error'],
          });
        }
      } catch (err) {
        setSendResult({
          success: false,
          sent: 0,
          failed: 0,
          campaignId: '',
          provider: 'mailgun',
          errors: [err instanceof Error ? err.message : 'Network error'],
        });
      } finally {
        setSending(false);
      }
    },
    [subject, content, tier],
  );

  // === Aggregate dashboard values ===========================

  const dashboard = useMemo(
    () => ({
      totalSubscribers: counts.total,
      freeSubscribers: counts.free,
      paidSubscribers: counts.paid,
      tokenSubscribers: counts.token,
      recentSent: stats?.sent ?? 0,
      openRate: stats ? formatPercent(stats.openRate) : '—',
      clickRate: stats ? formatPercent(stats.clickRate) : '—',
    }),
    [counts, stats],
  );

  // === Tabs =================================================

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'compose', label: 'Compose', icon: '✉' },
    { id: 'subscribers', label: 'Subscribers', icon: '👥' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'templates', label: 'Templates', icon: '🎨' },
  ];

  // === Loading State ========================================

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="skeleton h-8 w-64 rounded-lg mb-6" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
        <div className="mt-6 skeleton h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">Newsletter</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Send newsletters, manage subscribers, and track engagement
        </p>
      </div>

      {/* Dashboard Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Subscribers"
          value={formatNumber(dashboard.totalSubscribers)}
          sub="All tiers"
          accent="#10b981"
        />
        <StatCard
          label="Free"
          value={formatNumber(dashboard.freeSubscribers)}
          sub="Free tier"
          accent="#8a63d2"
        />
        <StatCard
          label="Paid"
          value={formatNumber(dashboard.paidSubscribers)}
          sub="Paying subscribers"
          accent="#f7931a"
        />
        <StatCard
          label="Token-Gated"
          value={formatNumber(dashboard.tokenSubscribers)}
          sub="Token holders"
          accent="#1185fe"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div
        className="mb-8 flex border-b border-[var(--color-border)] overflow-x-auto"
        role="tablist"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-degen-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(0,255,65,0.6)]" />
            )}
          </button>
        ))}
      </div>

      {/* ═══════════ COMPOSE ═══════════ */}
      {activeTab === 'compose' && (
        <div className="space-y-6">
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-6 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
              Compose Newsletter
            </h3>

            <form onSubmit={handleSend} className="space-y-4">
              {/* Subject */}
              <div>
                <label
                  htmlFor="subject"
                  className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]"
                >
                  Subject Line
                </label>
                <input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  maxLength={200}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/40 focus:ring-1 focus:ring-degen-500/20"
                  required
                />
                <p className="mt-1 text-right text-[10px] text-[var(--color-muted)]">
                  {subject.length}/200
                </p>
              </div>

              {/* Tier Selector */}
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]">
                  Audience
                </span>
                <div className="flex gap-2">
                  {(['free', 'paid', 'token-gated'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTier(t)}
                      className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                        tier === t
                          ? 'border-degen-500/30 bg-degen-500/10 text-degen-400'
                          : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-border)]'
                      }`}
                    >
                      <div className="capitalize">{t}</div>
                      <div className="mt-0.5 text-[10px] opacity-70">
                        {t === 'free'
                          ? `${formatNumber(dashboard.freeSubscribers)} subscribers`
                          : t === 'paid'
                            ? `${formatNumber(dashboard.paidSubscribers)} subscribers`
                            : `${formatNumber(dashboard.tokenSubscribers)} holders`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content (HTML) */}
              <div>
                <label
                  htmlFor="content"
                  className="mb-1.5 block text-xs font-medium text-[var(--color-muted)]"
                >
                  HTML Content
                </label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="<h1>Your newsletter content here...</h1><p>HTML formatted email body</p>"
                  rows={16}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm font-mono text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none transition-colors focus:border-degen-500/40 focus:ring-1 focus:ring-degen-500/20"
                  required
                />
              </div>

              {/* Send Button */}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={sending || !subject.trim() || !content.trim()}
                  className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M1 7l12-6-6 12-2-4-4-2z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Send Newsletter
                    </>
                  )}
                </button>
                <span className="text-[11px] text-[var(--color-muted)]">
                  {tier === 'free'
                    ? `Will send to ${formatNumber(dashboard.freeSubscribers)} free subscribers`
                    : tier === 'paid'
                      ? `Will send to ${formatNumber(dashboard.paidSubscribers)} paid subscribers`
                      : `Will send to ${formatNumber(dashboard.tokenSubscribers)} token holders`}
                </span>
              </div>
            </form>
          </div>

          {/* Send Result */}
          {sendResult && (
            <div
              className={`card border p-6 backdrop-blur-xl ${
                sendResult.success
                  ? 'border-degen-500/20 bg-degen-500/5'
                  : 'border-red-500/20 bg-red-500/5'
              }`}
            >
              <h4
                className={`text-sm font-semibold mb-2 ${
                  sendResult.success ? 'text-degen-400' : 'text-red-400'
                }`}
              >
                {sendResult.success ? 'Newsletter sent!' : 'Send failed'}
              </h4>
              <div className="space-y-1 text-xs text-[var(--color-muted)]">
                <p>
                  Sent: <span className="text-[var(--color-fg)]">{sendResult.sent}</span>
                </p>
                <p>
                  Failed: <span className="text-[var(--color-fg)]">{sendResult.failed}</span>
                </p>
                <p>
                  Provider: <span className="text-[var(--color-fg)]">{sendResult.provider}</span>
                </p>
                <p>
                  Campaign:{' '}
                  <span className="font-mono text-[var(--color-fg)]">{sendResult.campaignId}</span>
                </p>
                {sendResult.errors && sendResult.errors.length > 0 && (
                  <div className="mt-2 rounded bg-red-500/10 p-2">
                    <p className="text-[10px] text-red-400">{sendResult.errors.join('; ')}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick tip */}
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 backdrop-blur-xl">
            <p className="text-xs text-yellow-400">
              Tip: You can also send a newsletter directly from any Ghost article by clicking "Send
              as Newsletter" in the article editor.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════ SUBSCRIBERS ═══════════ */}
      {activeTab === 'subscribers' && (
        <div className="space-y-6">
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-fg)]">Subscriber List</h3>
              <span className="text-[11px] text-[var(--color-muted)]">{counts.total} total</span>
            </div>

            {/* Tier breakdown */}
            <div className="mb-4 space-y-2">
              <MiniProgress
                value={counts.free}
                total={counts.total || 1}
                color="#8a63d2"
                label="Free"
              />
              <MiniProgress
                value={counts.paid}
                total={counts.total || 1}
                color="#f7931a"
                label="Paid"
              />
              <MiniProgress
                value={counts.token}
                total={counts.total || 1}
                color="#1185fe"
                label="Token"
              />
            </div>

            {/* Subscriber rows */}
            {subscribers.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-overlay)] text-sm text-[var(--color-muted)]">
                  👥
                </div>
                <p className="text-xs text-[var(--color-muted)]">No subscribers yet</p>
                <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                  Subscribers appear here when users subscribe to your newsletter.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {subscribers.map((sub) => (
                  <div
                    key={sub.email}
                    className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-2.5 transition-colors hover:bg-[var(--color-card)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm text-[var(--color-fg)] truncate">{sub.email}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          sub.tier === 'free'
                            ? 'bg-purple-500/10 text-purple-400'
                            : sub.tier === 'paid'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-blue-500/10 text-blue-400'
                        }`}
                      >
                        {sub.tier}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--color-muted)]">
                      {new Date(sub.subscribedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Load more */}
            {hasMore && (
              <div className="mt-4 text-center">
                <button type="button" onClick={loadMore} className="btn-secondary text-xs">
                  Load More
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ ANALYTICS ═══════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
              Newsletter Analytics
            </h3>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Sent"
                value={formatNumber(stats?.sent ?? 0)}
                sub="Total emails sent"
                accent="#10b981"
              />
              <StatCard
                label="Delivered"
                value={formatNumber(stats?.delivered ?? 0)}
                sub="Successfully delivered"
                accent="#8a63d2"
              />
              <StatCard
                label="Open Rate"
                value={stats ? formatPercent(stats.openRate) : '—'}
                sub="Unique opens / delivered"
                accent="#1185fe"
              />
              <StatCard
                label="Click Rate"
                value={stats ? formatPercent(stats.clickRate) : '—'}
                sub="Unique clicks / delivered"
                accent="#f7931a"
              />
              <StatCard
                label="Bounced"
                value={formatNumber(stats?.bounced ?? 0)}
                sub="Failed delivery"
                accent="#ef4444"
              />
              <StatCard
                label="Unsubscribed"
                value={formatNumber(stats?.unsubscribed ?? 0)}
                sub="Post-campaign"
                accent="#f59e0b"
              />
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <p className="text-xs text-[var(--color-muted)]">
                To view analytics for a specific newsletter, enter the campaign ID or post ID below.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Campaign or Post ID"
                  className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-xs text-[var(--color-fg)] placeholder-[var(--color-muted)] outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      loadStats((e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>(
                      '[placeholder="Campaign or Post ID"]',
                    );
                    if (input?.value) loadStats(input.value);
                  }}
                >
                  Load Stats
                </button>
              </div>
            </div>

            {!stats && (
              <div className="mt-6 py-8 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-overlay)] text-sm text-[var(--color-muted)]">
                  📊
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  No analytics data yet. Send a newsletter to see stats here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ TEMPLATES ═══════════ */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Email Templates</h3>
            <p className="mb-6 text-xs text-[var(--color-muted)]">
              DegenFeed uses professional, responsive HTML email templates with dark theme for all
              newsletters.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Newsletter Template */}
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-fg)]">Newsletter</span>
                  <span className="rounded bg-degen-500/10 px-2 py-0.5 text-[10px] text-degen-400">
                    Default
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-muted)]">
                  Full article template with title, author, content, tracking pixel, and unsubscribe
                  footer. Used when sending newsletters to subscribers.
                </p>
              </div>

              {/* Welcome Template */}
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-fg)]">Welcome</span>
                  <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-400">
                    Auto
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-muted)]">
                  Sent automatically when a user subscribes. Includes creator profile link and
                  onboarding messaging.
                </p>
              </div>

              {/* Receipt Template */}
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-fg)]">
                    Payment Receipt
                  </span>
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
                    Paid
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-muted)]">
                  Receipt for paid subscriptions. Shows plan name, amount, billing dates, and a link
                  to view full receipt.
                </p>
              </div>

              {/* New Article Alert */}
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-fg)]">
                    New Article Alert
                  </span>
                  <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400">
                    Auto
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-muted)]">
                  Alert sent when a creator publishes a new article. Includes title, excerpt, image,
                  and CTA button.
                </p>
              </div>
            </div>

            {/* Template features */}
            <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <h4 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
                Template Features
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-muted)]">
                <div className="flex items-center gap-2">
                  <span className="text-degen-400">✓</span> Responsive design (mobile + desktop)
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-degen-400">✓</span> Dark theme (DegenFeed branding)
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-degen-400">✓</span> Inline CSS for email clients
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-degen-400">✓</span> MSO (Outlook) compatibility
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-degen-400">✓</span> Open tracking pixel
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-degen-400">✓</span> One-click unsubscribe
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
