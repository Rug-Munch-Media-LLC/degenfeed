'use client';

/**
 * @component JoinAllProtocols — One-click "Join All" onboarding step
 *
 * Offers to create accounts on all self-hosted Fediverse protocols.
 * Shows checkboxes, "Create All" button, and success summary.
 *
 * Usage:
 *   <JoinAllProtocols username="myhandle" onComplete={...} />
 */

import { useCallback, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

interface ProtocolOption {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  url: string;
}

interface JoinResult {
  protocol: string;
  status: 'created' | 'pending' | 'failed';
  username?: string;
  error?: string;
  accountInfo?: Record<string, string>;
}

interface Props {
  /** Desired base username (e.g. "alice" — becomes alice@social.degenfeed.xyz) */
  username: string;
  /** Called when all selected accounts are created */
  onComplete?: (results: JoinResult[]) => void;
  /** Called when user skips this step */
  onSkip?: () => void;
  /** Whether we're currently processing */
  initialProcessing?: boolean;
}

// ─── Protocol Data ────────────────────────────────────────────────────────

const ALL_PROTOCOLS: ProtocolOption[] = [
  {
    id: 'mastodon',
    name: 'GoToSocial (Mastodon)',
    icon: '🐘',
    color: '#6364ff',
    desc: 'Short-form microblogging on the Fediverse',
    url: 'https://social.degenfeed.xyz',
  },
  {
    id: 'peertube',
    name: 'PeerTube',
    icon: '▶️',
    color: '#f2691d',
    desc: 'Federated video hosting & sharing',
    url: 'https://video.degenfeed.xyz',
  },
  {
    id: 'lemmy',
    name: 'Lemmy',
    icon: '🔮',
    color: '#4a8c6f',
    desc: 'Federated link aggregator & discussion',
    url: 'https://community.degenfeed.xyz',
  },
  {
    id: 'pixelfed',
    name: 'Pixelfed',
    icon: '📷',
    color: '#f5a623',
    desc: 'Federated image sharing platform',
    url: 'https://pixelfed.social',
  },
  {
    id: 'writefreely',
    name: 'WriteFreely',
    icon: '✍️',
    color: '#2eaadc',
    desc: 'Federated long-form blogging',
    url: 'https://blog.degenfeed.xyz',
  },
  {
    id: 'bookwyrm',
    name: 'BookWyrm',
    icon: '📚',
    color: '#4a8c6f',
    desc: 'Social reading & book tracking',
    url: 'https://books.degenfeed.xyz',
  },
  {
    id: 'mobilizon',
    name: 'Mobilizon',
    icon: '📅',
    color: '#f15a22',
    desc: 'Federated events management',
    url: 'https://events.degenfeed.xyz',
  },
  {
    id: 'funkwhale',
    name: 'Funkwhale',
    icon: '🎵',
    color: '#a855f7',
    desc: 'Federated music & audio sharing',
    url: 'https://music.degenfeed.xyz',
  },
];

// ─── Component ───────────────────────────────────────────────────────────

export function JoinAllProtocols({ username, onComplete, onSkip, initialProcessing }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(ALL_PROTOCOLS.map((p) => p.id)));
  const [results, setResults] = useState<JoinResult[]>([]);
  const [_processing, setProcessing] = useState(initialProcessing ?? false);
  const [phase, setPhase] = useState<'select' | 'creating' | 'done'>('select');

  const toggleProtocol = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(ALL_PROTOCOLS.map((p) => p.id)));
  }, []);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const createAll = useCallback(async () => {
    if (selected.size === 0) return;
    setProcessing(true);
    setPhase('creating');

    const selectedProtocols = Array.from(selected);
    const joinResults: JoinResult[] = [];

    // Create accounts sequentially to avoid rate limits
    for (const protocol of selectedProtocols) {
      try {
        const res = await fetch(`/api/protocol/${protocol}/register`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username }),
        });

        if (res.ok) {
          const json = (await res.json()) as { data: JoinResult };
          joinResults.push(json.data);
        } else {
          const errJson = (await res.json().catch(() => ({}))) as { error?: string };
          joinResults.push({
            protocol,
            status: 'failed',
            error: errJson.error || `HTTP ${res.status}`,
          });
        }
      } catch (err) {
        joinResults.push({
          protocol,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Network error',
        });
      }
    }

    setResults(joinResults);
    setProcessing(false);
    setPhase('done');
    onComplete?.(joinResults);
  }, [selected, username, onComplete]);

  // ─── Selection Phase ─────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl">🚀</div>
          <h2 className="text-lg font-bold text-[var(--color-fg)]">
            Create Accounts on All Networks
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            We can create accounts for you on {ALL_PROTOCOLS.length} federated networks.
            <br />
            All free. No gas fees. You own every account.
          </p>
        </div>

        {/* Protocol selection grid */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {ALL_PROTOCOLS.map((proto) => {
            const isChecked = selected.has(proto.id);
            return (
              <button
                key={proto.id}
                type="button"
                onClick={() => toggleProtocol(proto.id)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                  isChecked
                    ? 'border-degen-500/40 bg-degen-500/5 shadow-sm shadow-degen-500/10'
                    : 'border-[var(--color-glass-border)] bg-[var(--color-overlay)] opacity-60 hover:opacity-80'
                }`}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ backgroundColor: `${proto.color}18` }}
                >
                  {proto.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-fg)]">
                      {proto.name}
                    </span>
                    {isChecked && (
                      <svg
                        className="h-4 w-4 shrink-0 text-degen-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">{proto.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button type="button" onClick={selectAll} className="btn-secondary text-xs">
              Select All
            </button>
            <button type="button" onClick={deselectAll} className="btn-secondary text-xs">
              Deselect All
            </button>
          </div>
          <div className="flex gap-2">
            {onSkip && (
              <button type="button" onClick={onSkip} className="btn-secondary text-xs">
                Skip for Now
              </button>
            )}
            <button
              type="button"
              onClick={createAll}
              disabled={selected.size === 0}
              className="btn-primary text-xs disabled:opacity-50"
            >
              Create {selected.size} Account{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-[var(--color-muted)]">
          Username: <span className="font-mono text-[var(--color-fg)]">{username}</span> will be
          used across all networks
        </p>
      </div>
    );
  }

  // ─── Creating Phase ──────────────────────────────────────────────
  if (phase === 'creating') {
    return (
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          </div>
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Creating Your Accounts...</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Registering on {selected.size} networks with username <strong>{username}</strong>
          </p>
        </div>
        <div className="space-y-2">
          {ALL_PROTOCOLS.filter((p) => selected.has(p.id)).map((proto) => {
            const result = results.find((r) => r.protocol === proto.id);
            const isDone = result !== undefined;
            const isSuccess = result?.status === 'created';
            const isPending = result?.status === 'pending';
            const isFailed = result?.status === 'failed';

            return (
              <div
                key={proto.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  isSuccess
                    ? 'bg-green-500/5'
                    : isFailed
                      ? 'bg-red-500/5'
                      : isPending
                        ? 'bg-amber-500/5'
                        : ''
                }`}
              >
                <span className="text-lg">{proto.icon}</span>
                <span className="flex-1 text-sm text-[var(--color-fg)]">{proto.name}</span>
                {isDone ? (
                  isSuccess ? (
                    <span className="text-xs text-green-400">✅ Created</span>
                  ) : isPending ? (
                    <span className="text-xs text-amber-400">⏳ Pending</span>
                  ) : (
                    <span className="text-xs text-red-400" title={result.error}>
                      ❌ Failed
                    </span>
                  )
                ) : (
                  <span className="text-xs text-[var(--color-muted)]">⏳ Creating...</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Done Phase ──────────────────────────────────────────────────
  const created = results.filter((r) => r.status === 'created').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const pending = results.filter((r) => r.status === 'pending').length;
  const _succeededResults = results.filter((r) => r.status === 'created');

  return (
    <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6">
      <div className="mb-6 text-center">
        <div className="mb-2 text-3xl">🎉</div>
        <h2 className="text-lg font-bold text-[var(--color-fg)]">Accounts Created!</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {created} account{created !== 1 ? 's' : ''} created
          {failed > 0 ? `, ${failed} failed` : ''}
          {pending > 0 ? `, ${pending} pending` : ''}
        </p>
      </div>

      {/* Success summary */}
      <div className="mb-6 space-y-2">
        {results.map((result) => {
          const proto = ALL_PROTOCOLS.find((p) => p.id === result.protocol);
          return (
            <div
              key={result.protocol}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                result.status === 'created'
                  ? 'bg-green-500/5'
                  : result.status === 'pending'
                    ? 'bg-amber-500/5'
                    : 'bg-red-500/5'
              }`}
            >
              <span className="text-lg">{proto?.icon || '🔗'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-fg)]">
                    {proto?.name || result.protocol}
                  </span>
                  {result.status === 'created' && (
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                      Created
                    </span>
                  )}
                  {result.status === 'failed' && (
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                      Failed
                    </span>
                  )}
                  {result.status === 'pending' && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                      Pending
                    </span>
                  )}
                </div>
                {result.username && (
                  <p className="text-[11px] text-[var(--color-muted)]">{result.username}</p>
                )}
                {result.error && <p className="text-[11px] text-red-400">{result.error}</p>}
              </div>
              {result.accountInfo?.profileUrl && (
                <a
                  href={result.accountInfo.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-degen-400 hover:underline"
                >
                  View Profile ↗
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap justify-center gap-3">
        {onComplete && (
          <button type="button" onClick={() => onComplete(results)} className="btn-primary text-xs">
            Continue
          </button>
        )}
        {onSkip && (
          <button type="button" onClick={onSkip} className="btn-secondary text-xs">
            Close
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Utility: Fetch protocol status ───────────────────────────────────────

/**
 * Fetch the user's protocol registration status.
 * Returns the status of all self-hosted protocols.
 */
export async function fetchProtocolStatus(): Promise<{
  protocols: Record<
    string,
    {
      registered: boolean;
      username: string | null;
      profileUrl: string | null;
      label: string;
      icon: string;
      color: string;
    }
  >;
  connectedCount: number;
  totalPlatforms: number;
}> {
  const res = await fetch('/api/protocol/status');
  if (!res.ok) throw new Error(`Failed to fetch protocol status: HTTP ${res.status}`);
  const json = (await res.json()) as {
    data: { protocols: Record<string, unknown>; connectedCount: number; totalPlatforms: number };
  };
  return json.data as {
    protocols: Record<
      string,
      {
        registered: boolean;
        username: string | null;
        profileUrl: string | null;
        label: string;
        icon: string;
        color: string;
      }
    >;
    connectedCount: number;
    totalPlatforms: number;
  };
}
