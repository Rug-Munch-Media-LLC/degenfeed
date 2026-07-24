'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';

// === Types ================================================================

interface ConnectedAccount {
  platform: string;
  label: string;
  icon: string;
  connectedAt: string;
  platformUserId: string;
  metadata?: Record<string, string>;
  expiresAt?: number;
}

interface ScheduledPost {
  id: string;
  text: string;
  targets: string[];
  scheduledAt: string;
  createdAt: string;
  status: 'pending' | 'published' | 'failed';
  retries?: number;
  lastError?: string;
}

type CrossPostPlatform =
  | 'medium'
  | 'substack'
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'linkedin'
  | 'reddit'
  | 'pinterest';

const CENTRALIZED_PLATFORMS: {
  id: CrossPostPlatform;
  label: string;
  icon: string;
  color: string;
  description: string;
  hasOAuth: boolean;
  needsVideo: boolean;
  needsImage: boolean;
}[] = [
  {
    id: 'medium',
    label: 'Medium',
    icon: '✍️',
    color: '#00ab6c',
    description: 'Long-form articles with Markdown',
    hasOAuth: true,
    needsVideo: false,
    needsImage: false,
  },
  {
    id: 'substack',
    label: 'Substack',
    icon: '✉️',
    color: '#ff6719',
    description: 'Newsletter (email-to-post)',
    hasOAuth: false,
    needsVideo: false,
    needsImage: false,
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: '▶️',
    color: '#ff0000',
    description: 'Video publishing',
    hasOAuth: true,
    needsVideo: true,
    needsImage: false,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    color: '#000000',
    description: 'Short video sharing',
    hasOAuth: true,
    needsVideo: true,
    needsImage: false,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    icon: '📷',
    color: '#e4405f',
    description: 'Photo & video posts',
    hasOAuth: true,
    needsVideo: false,
    needsImage: true,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: '💼',
    color: '#0a66c2',
    description: 'Professional posts',
    hasOAuth: true,
    needsVideo: false,
    needsImage: false,
  },
  {
    id: 'reddit',
    label: 'Reddit',
    icon: '🤖',
    color: '#ff4500',
    description: 'Subreddit submissions',
    hasOAuth: true,
    needsVideo: false,
    needsImage: false,
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    icon: '📌',
    color: '#bd081c',
    description: 'Image pin sharing',
    hasOAuth: true,
    needsVideo: false,
    needsImage: true,
  },
];

const PLATFORM_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  threads: '#888888',
  medium: '#00ab6c',
  substack: '#ff6719',
  youtube: '#ff0000',
  tiktok: '#000000',
  instagram: '#e4405f',
  linkedin: '#0a66c2',
  reddit: '#ff4500',
  pinterest: '#bd081c',
  mirror: '#00ff41',
  paragraph: '#ff6b6b',
};

// === Helpers ==============================================================

function _shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// === Platform Card ========================================================

function PlatformCard({
  platform,
  connected,
  onConnect,
  onDisconnect,
}: {
  platform: (typeof CENTRALIZED_PLATFORMS)[0];
  connected: ConnectedAccount | null;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (platform.hasOAuth) {
      setLoading(true);
      try {
        const res = await fetch(`/api/accounts/connect/${platform.id}`, {
          method: 'POST',
          credentials: 'include',
        });
        const data = (await res.json()) as { authorizeUrl?: string; manual?: boolean };
        if (data.authorizeUrl) {
          window.location.href = data.authorizeUrl;
        } else if (data.manual) {
          // Substack — show email setup
          window.location.href = '/creator/cross-post?setup=substack';
        }
      } catch (err) {
        console.error('Failed to connect:', err);
      } finally {
        setLoading(false);
      }
    } else {
      // Non-OAuth platform (Substack)
      window.location.href = '/creator/cross-post?setup=substack';
    }
  };

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        connected
          ? 'border-degen-500/20 bg-degen-500/5'
          : 'border-[var(--color-border)] bg-[var(--color-card)]'
      }`}
      style={
        connected
          ? {
              borderColor: `${platform.color}40`,
              backgroundColor: `${platform.color}08`,
            }
          : {}
      }
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{platform.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[var(--color-fg)]">{platform.label}</h3>
              {connected && (
                <span
                  className="inline-block h-2 w-2 rounded-full shadow-[0_0_6px_rgba(0,255,65,0.5)]"
                  style={{ backgroundColor: platform.color }}
                />
              )}
            </div>
            <p className="text-[11px] text-[var(--color-muted)]">{platform.description}</p>
          </div>
        </div>
        {connected ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-degen-500/10 px-2 py-0.5 text-[10px] font-medium text-degen-400">
              Connected
            </span>
            <button
              type="button"
              onClick={() => onDisconnect(platform.id)}
              className="rounded px-2 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] transition-colors hover:border-degen-500/30 hover:text-degen-400 disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>

      {connected && (
        <div className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--color-muted)]">Account</span>
            <span className="font-medium text-[var(--color-fg)]">
              {connected.metadata?.username ||
                connected.metadata?.name ||
                connected.metadata?.channelName ||
                connected.metadata?.displayName ||
                connected.label}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[var(--color-muted)]">Connected</span>
            <span className="font-medium text-[var(--color-fg)]">
              {formatDate(connected.connectedAt)}
            </span>
          </div>
          {connected.expiresAt && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--color-muted)]">Token expires</span>
              <span className="font-medium text-[var(--color-fg)]">
                {connected.expiresAt > Date.now() ? 'Active' : 'Expired'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// === Quick Cross-Post Composer ============================================

function CrossPostComposer({
  connectedPlatforms,
  onPublish,
}: {
  connectedPlatforms: string[];
  onPublish: (text: string, targets: string[], title?: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const toggleTarget = (platform: string) => {
    setSelectedTargets((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  };

  const handlePublish = async () => {
    if (!text || selectedTargets.length === 0) return;

    setPublishing(true);
    setResult(null);

    try {
      for (const target of selectedTargets) {
        const res = await fetch(`/api/cross-post/${target}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            title: title || undefined,
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          result?: { nativeUrl?: string };
        };
        if (data.ok) {
          setResult(
            `✅ Published to ${target}${data.result?.nativeUrl ? `: ${data.result.nativeUrl}` : ''}`,
          );
        } else {
          setResult(`❌ Failed to publish to ${target}: ${data.error}`);
        }
      }

      setText('');
      setTitle('');
      setSelectedTargets([]);
    } catch (err) {
      setResult(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
      <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Quick Cross-Post</h3>

      {/* Title (for long-form platforms) */}
      <input
        type="text"
        placeholder="Post title (required for Reddit, optional for others)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mb-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/40 focus:outline-none"
      />

      {/* Text input */}
      <textarea
        placeholder="What do you want to share?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="mb-3 w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/40 focus:outline-none"
      />
      <div className="mb-3 text-right text-[11px] text-[var(--color-muted)]">
        {text.length} characters
      </div>

      {/* Platform selection */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-medium text-[var(--color-muted)]">Publish to:</p>
        <div className="flex flex-wrap gap-2">
          {/* Always-enabled protocols */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-degen-500/15 px-3 py-1.5 text-xs font-medium text-degen-400">
            <span className="h-1.5 w-1.5 rounded-full bg-degen-400" />
            DegenFeed
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1185fe]/15 px-3 py-1.5 text-xs font-medium text-[#1185fe]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1185fe]" />
            Bluesky
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8e30eb]/15 px-3 py-1.5 text-xs font-medium text-[#8e30eb]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8e30eb]" />
            Nostr
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8a63d2]/15 px-3 py-1.5 text-xs font-medium text-[#8a63d2]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8a63d2]" />
            Farcaster
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6364ff]/15 px-3 py-1.5 text-xs font-medium text-[#6364ff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6364ff]" />
            Mastodon
          </span>

          {/* Connected centralized platforms */}
          {connectedPlatforms.map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => toggleTarget(platform)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                selectedTargets.includes(platform)
                  ? 'border border-degen-500/40 bg-degen-500/20 text-degen-400 shadow-[0_0_10px_rgba(0,255,65,0.1)]'
                  : 'border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted)] hover:border-[var(--color-fg)]'
              }`}
              style={
                selectedTargets.includes(platform)
                  ? {
                      borderColor: `${PLATFORM_COLORS[platform] || '#666'}60`,
                      backgroundColor: `${PLATFORM_COLORS[platform] || '#666'}18`,
                      color: PLATFORM_COLORS[platform] || '#666',
                    }
                  : {}
              }
            >
              {PLATFORM_COLORS[platform] && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: PLATFORM_COLORS[platform] }}
                />
              )}
              {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </button>
          ))}
        </div>

        {connectedPlatforms.length === 0 && (
          <div className="mt-2 rounded-lg bg-yellow-500/5 p-2 text-center text-[11px] text-yellow-400">
            Connect centralized platforms above to see them here.
          </div>
        )}
      </div>

      {/* Publish button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handlePublish}
          disabled={!text || selectedTargets.length === 0 || publishing}
          className="btn-primary text-sm disabled:opacity-40"
        >
          {publishing
            ? 'Publishing...'
            : `Publish to ${selectedTargets.length || 0} platform${selectedTargets.length !== 1 ? 's' : ''}`}
        </button>
        <span className="text-[11px] text-[var(--color-muted)]">
          {selectedTargets.length === 0
            ? 'Select at least one platform'
            : 'Content will be adapted per platform limits'}
        </span>
      </div>

      {/* Result message */}
      {result && (
        <div className="mt-3 rounded-lg bg-[var(--color-card)] p-3 text-xs text-[var(--color-fg)]">
          {result}
        </div>
      )}
    </div>
  );
}

// === Scheduled Posts List =================================================

function ScheduledPostsList() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduled', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { posts: ScheduledPost[] };
        setPosts(data.posts || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/schedule/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      // ignore
    }
  };

  const handlePublishNow = async (id: string) => {
    try {
      const res = await fetch(`/api/schedule/${id}/publish-now`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        loadPosts();
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
        <div className="skeleton h-5 w-40 rounded mb-4" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">Scheduled Posts</h3>
          <p className="text-xs text-[var(--color-muted)]">
            {posts.length} post{posts.length !== 1 ? 's' : ''} scheduled
          </p>
        </div>
      </div>

      {posts.length > 0 ? (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-overlay)]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/10 text-degen-400 text-xs">
                📅
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--color-fg)] line-clamp-1">{post.text}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
                    {formatDate(post.scheduledAt)}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)]">·</span>
                  <div className="flex gap-1">
                    {post.targets.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium"
                        style={{
                          backgroundColor: `${PLATFORM_COLORS[t] || '#666'}18`,
                          color: PLATFORM_COLORS[t] || '#666',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                      post.status === 'pending'
                        ? 'bg-blue-500/10 text-blue-400'
                        : post.status === 'published'
                          ? 'bg-degen-500/10 text-degen-400'
                          : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
                {post.lastError && (
                  <p className="mt-1 text-[10px] text-red-400">{post.lastError}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                {post.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePublishNow(post.id)}
                      className="rounded px-2 py-1 text-[10px] text-degen-400 transition-colors hover:bg-degen-500/10"
                    >
                      Publish Now
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancel(post.id)}
                      className="rounded px-2 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-overlay)] text-sm text-[var(--color-muted)]">
            📅
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            No posts scheduled. Use the composer to schedule cross-platform posts.
          </p>
        </div>
      )}
    </div>
  );
}

// === Settings / Substack email setup modal =================================

function SubstackSetupModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    if (!email && !url) return;
    setSaving(true);
    try {
      const res = await fetch('/api/accounts/connect/substack/email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, substackUrl: url }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => onClose(), 1500);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl">
        {done ? (
          <div className="py-8 text-center">
            <span className="text-4xl">✅</span>
            <p className="mt-3 text-sm font-medium text-degen-400">Substack connected!</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--color-fg)]">Connect Substack</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-xs text-[var(--color-muted)]">
              Substack doesn't provide a public API. Instead, publish via email-to-post:
            </p>
            <ol className="mb-4 list-inside list-decimal space-y-1 text-xs text-[var(--color-muted)]">
              <li>Go to your Substack Settings → Email</li>
              <li>Copy your &quot;Email to post&quot; address</li>
              <li>Paste it below</li>
            </ol>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="substack-email-to-post@substack.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/40 focus:outline-none"
              />
              <input
                type="url"
                placeholder="https://yournewsletter.substack.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-degen-500/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={(!email && !url) || saving}
                className="btn-primary w-full text-sm disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Connect Substack'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function CrossPostPage() {
  const { ready, walletAddress, signedInProtocols } = useAuth();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubstackModal, setShowSubstackModal] = useState(false);

  const connectedPlatforms = useMemo(() => accounts.map((a) => a.platform), [accounts]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounts/connected', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { accounts: ConnectedAccount[] };
        setAccounts(data.accounts || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready) loadAccounts();
  }, [ready, loadAccounts]);

  // Check for Substack setup query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('setup') === 'substack') {
      setShowSubstackModal(true);
    }
  }, []);

  const handleConnect = async (platformId: string) => {
    if (platformId === 'substack') {
      setShowSubstackModal(true);
      return;
    }
    try {
      const res = await fetch(`/api/accounts/connect/${platformId}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json()) as { authorizeUrl?: string };
      if (data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
      }
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  };

  const handleDisconnect = async (platformId: string) => {
    try {
      const res = await fetch(`/api/accounts/disconnect/${platformId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.platform !== platformId));
      }
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const handlePublish = async (text: string, targets: string[], title?: string) => {
    for (const target of targets) {
      await fetch(`/api/cross-post/${target}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, title }),
      });
    }
    await loadAccounts();
  };

  // Auth gate
  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="space-y-4">
          <div className="skeleton h-8 w-64" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
            <span className="text-3xl text-degen-400">📤</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Cross-Platform Publishing</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Connect your wallet to publish across centralized and decentralized platforms from one
            place.
          </p>
          <div className="mt-8">
            <Link href="/creator" className="btn-primary text-sm">
              Go to Creator Studio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const connectedMap = new Map(accounts.map((a) => [a.platform, a]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">
            Cross-Platform Publishing
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Publish to centralized platforms — one click, everywhere
          </p>
        </div>
        <Link href="/creator" className="btn-secondary text-sm">
          ← Back to Creator Studio
        </Link>
      </div>

      {/* Connected Accounts Grid */}
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Connected Platforms</h2>
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {CENTRALIZED_PLATFORMS.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                connected={connectedMap.get(platform.id) || null}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />
            ))}
          </div>
        )}
      </section>

      {/* Quick Cross-Post Composer */}
      <section className="mb-8">
        <CrossPostComposer connectedPlatforms={connectedPlatforms} onPublish={handlePublish} />
      </section>

      {/* Scheduled Posts */}
      <section className="mb-8">
        <ScheduledPostsList />
      </section>

      {/* Platform Limits Reference */}
      <section>
        <details className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--color-fg)]">
            Platform Content Limits Reference
          </summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-muted)]">
                  <th className="pb-2 pr-4 font-medium">Platform</th>
                  <th className="pb-2 pr-4 font-medium">Max Characters</th>
                  <th className="pb-2 pr-4 font-medium">Max Images</th>
                  <th className="pb-2 pr-4 font-medium">Supports Video</th>
                  <th className="pb-2 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Mastodon', '500', '4', '✓', 'Short post'],
                  ['Bluesky', '300', '4', '✓', 'Short post'],
                  ['Nostr', '10,000', '10', '✓', 'Long post'],
                  ['Farcaster', '320', '2', '✓', 'Short post'],
                  ['LinkedIn', '3,000', '9', '✓', 'Professional'],
                  ['Reddit', '40,000', '20', '✓', 'Forum post'],
                  ['Medium', 'Unlimited', '100', '-', 'Long-form'],
                  ['Substack', 'Unlimited', '100', '-', 'Newsletter'],
                  ['YouTube', '5,000', '-', '✓ (required)', 'Video'],
                  ['TikTok', '2,200', '-', '✓ (required)', 'Short video'],
                  ['Instagram', '2,200', '10', '✓', 'Visual'],
                  ['Pinterest', '500', '1', '-', 'Pin'],
                ].map(([platform, chars, images, video, type]) => (
                  <tr
                    key={platform}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="py-2 pr-4 font-medium text-[var(--color-fg)]">{platform}</td>
                    <td className="py-2 pr-4 text-[var(--color-muted)]">{chars}</td>
                    <td className="py-2 pr-4 text-[var(--color-muted)]">{images}</td>
                    <td className="py-2 pr-4 text-[var(--color-muted)]">{video}</td>
                    <td className="py-2 text-[var(--color-muted)]">{type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* Substack setup modal */}
      {showSubstackModal && <SubstackSetupModal onClose={() => setShowSubstackModal(false)} />}
    </div>
  );
}
