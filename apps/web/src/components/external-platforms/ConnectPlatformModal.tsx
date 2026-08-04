'use client';

/**
 * ConnectPlatformModal — Modal for connecting external social platforms
 * (YouTube, Twitch, Kick, TikTok, Instagram, LinkedIn) via Postiz OAuth.
 *
 * Shows a grid of available platforms with connect/disconnect buttons.
 * Gated to Enterprise tier or standalone DegenFeed Connect add-on.
 */

import { useCallback, useEffect, useState } from 'react';
import { PremiumGate } from '../PremiumGate';

// ─── Types ────────────────────────────────────────────────────────────────

export interface PlatformInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  capabilities: string[];
  connected: boolean;
  connectedAccount?: {
    displayName: string;
    avatarUrl?: string;
    connectedAt: string;
  };
}

interface ConnectPlatformModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Called after a platform is connected/disconnected */
  onRefresh?: () => void;
}

// ─── Capability Badge ─────────────────────────────────────────────────────

function CapabilityBadge({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-[var(--color-muted)]">
      {label}
    </span>
  );
}

// ─── Platform Card ────────────────────────────────────────────────────────

function PlatformCard({
  platform,
  onConnect,
  onDisconnect,
  connecting,
}: {
  platform: PlatformInfo;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  connecting: string | null;
}) {
  return (
    <div
      className={`group relative rounded-xl border p-4 transition-all ${
        platform.connected
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-[var(--color-glass-border)] bg-white/[0.02] hover:border-white/20'
      }`}
    >
      {/* Platform icon + name */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-2xl" role="img" aria-label={platform.name}>
          {platform.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-[var(--color-fg)]">{platform.name}</h3>
          {platform.connected && platform.connectedAccount ? (
            <p className="truncate text-xs text-green-400">
              ✓ Connected as {platform.connectedAccount.displayName}
            </p>
          ) : (
            <p className="truncate text-xs text-[var(--color-muted)]">{platform.description}</p>
          )}
        </div>
      </div>

      {/* Capabilities */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {platform.capabilities.map((cap) => (
          <CapabilityBadge key={cap} label={cap} />
        ))}
      </div>

      {/* Connect/Disconnect button */}
      {platform.connected ? (
        <button
          type="button"
          onClick={() => onDisconnect(platform.id)}
          className="w-full rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
        >
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onConnect(platform.id)}
          disabled={connecting === platform.id}
          className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {connecting === platform.id ? 'Connecting...' : 'Connect'}
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export function ConnectPlatformModal({ isOpen, onClose, onRefresh }: ConnectPlatformModalProps) {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch platform status
  const fetchPlatforms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, platformsRes] = await Promise.all([
        fetch('/api/external/status'),
        fetch('/api/external/platforms'),
      ]);

      const statusData = (await statusRes.json()) as {
        data?: {
          hasAccess?: boolean;
          accounts?: Array<{
            platform: string;
            displayName: string;
            avatarUrl?: string;
            connectedAt: string;
          }>;
        };
        error?: string;
      };
      const platformsData = (await platformsRes.json()) as {
        data?: {
          platforms: Array<{
            id: string;
            name: string;
            icon: string;
            description: string;
            capabilities: string[];
          }>;
        };
      };

      const status = statusData.data;
      const platformList = platformsData.data?.platforms ?? [];

      if (status && !status.hasAccess) {
        setHasAccess(false);
        setPlatforms([]);
        setLoading(false);
        return;
      }

      const connectedAccounts = status?.accounts ?? [];
      const connectedMap = new Map(connectedAccounts.map((a) => [a.platform, a]));

      setPlatforms(
        platformList.map((p) => ({
          ...p,
          connected: connectedMap.has(p.id),
          connectedAccount: connectedMap.get(p.id)
            ? {
                displayName: connectedMap.get(p.id)?.displayName,
                avatarUrl: connectedMap.get(p.id)?.avatarUrl,
                connectedAt: connectedMap.get(p.id)?.connectedAt,
              }
            : undefined,
        })),
      );
      setHasAccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platforms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchPlatforms();
    }
  }, [isOpen, fetchPlatforms]);

  // Initiate connection
  const handleConnect = useCallback(async (platformId: string) => {
    setConnecting(platformId);
    setError(null);
    try {
      const res = await fetch('/api/external/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platformId }),
      });
      const data = (await res.json()) as {
        data?: { url?: string };
        error?: string;
      };

      if (res.ok && data.data?.url) {
        // Redirect to Postiz OAuth
        window.location.href = data.data.url;
      } else {
        setError(data.error ?? 'Connection failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(null);
    }
  }, []);

  // Disconnect platform
  const handleDisconnect = useCallback(
    async (platformId: string) => {
      setError(null);
      try {
        const res = await fetch('/api/external/disconnect', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: platformId }),
        });
        const data = (await res.json()) as { error?: string };

        if (res.ok) {
          await fetchPlatforms();
          onRefresh?.();
        } else {
          setError(data.error ?? 'Failed to disconnect');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to disconnect');
      }
    },
    [fetchPlatforms, onRefresh],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-2xl rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-fg)]">DegenFeed Connect</h2>
            <p className="text-sm text-[var(--color-muted)]">
              Connect external platforms to post, schedule, and go live
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : !hasAccess ? (
          <div className="py-8 text-center">
            <p className="mb-2 text-lg text-[var(--color-fg)]">🚀 DegenFeed Connect</p>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Post to YouTube, Twitch, Kick, TikTok, Instagram, and LinkedIn.
              <br />
              Included in Enterprise tier or available as a standalone add-on.
            </p>
            <a
              href="/connect"
              className="inline-block rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-white/20"
            >
              View Plans
            </a>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {platforms.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                connecting={connecting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Premium-Gated Export ─────────────────────────────────────────────────

export function GatedConnectPlatformModal(props: ConnectPlatformModalProps) {
  return (
    <PremiumGate requiredTier="enterprise" feature="External Platform Posting">
      <ConnectPlatformModal {...props} />
    </PremiumGate>
  );
}
