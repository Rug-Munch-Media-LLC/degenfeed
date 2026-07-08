'use client';

import { useEffect, useState } from 'react';

interface HealthStatus {
  relays?: Record<string, string>;
  healthy?: number;
  health?: Record<string, { healthy: boolean; latencyMs: number; error?: string }>;
  checkedAt?: number;
}

function StatusDot(ok: boolean) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}
    />
  );
}

export default function HealthPage() {
  const [api, setApi] = useState<HealthStatus | null>(null);
  const [feed, setFeed] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [apiRes, feedRes] = await Promise.all([
          fetch('/api/health', { credentials: 'include' }),
          fetch('/api/feed/health', { credentials: 'include' }),
        ]);
        if (apiRes.ok) setApi(await apiRes.json());
        if (feedRes.ok) setFeed(await feedRes.json());
      } catch {
        /* ignore */
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-white">System Health</h1>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* API Worker */}
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold text-white">API Worker</h2>
            {api?.relays ? (
              <div className="space-y-2">
                {Object.entries(api.relays).map(([relay, status]) => (
                  <div key={relay} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-mono">{relay}</span>
                    <div className="flex items-center gap-2">
                      {StatusDot(status === 'ok')}
                      <span className={status === 'ok' ? 'text-green-400' : 'text-red-400'}>
                        {status}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                  <span className="text-gray-500">Healthy relays</span>
                  <span className="text-degen-400">{api.healthy ?? 0}/5</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Relay health unavailable</p>
            )}
          </div>

          {/* Feed Providers */}
          {feed?.health && (
            <div className="card">
              <h2 className="mb-3 text-sm font-semibold text-white">Feed Providers</h2>
              <div className="space-y-2">
                {Object.entries(feed.health).map(([protocol, h]) => (
                  <div key={protocol} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400 font-medium">{protocol}</span>
                    <div className="flex items-center gap-3">
                      {StatusDot(h.healthy)}
                      <span className={h.healthy ? 'text-green-400' : 'text-red-400'}>
                        {h.healthy ? `${h.latencyMs}ms` : (h.error ?? 'down')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {feed.checkedAt && (
                <p className="mt-3 text-[10px] text-gray-600">
                  Checked at {new Date(feed.checkedAt).toUTCString()}
                </p>
              )}
            </div>
          )}

          {/* App Status */}
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold text-white">App</h2>
            <div className="space-y-1.5 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Client</span>
                <span className="text-degen-400">app.degenfeed.xyz</span>
              </div>
              <div className="flex justify-between">
                <span>API</span>
                <span className="text-degen-400">degenfeed-api (Cloudflare Worker)</span>
              </div>
              <div className="flex justify-between">
                <span>Social</span>
                <span className="text-degen-400">social.degenfeed.xyz (GotoSocial)</span>
              </div>
              <div className="flex justify-between">
                <span>Sources</span>
                <span className="text-degen-400">
                  RSS, Reddit, Hacker News, Nostr, Farcaster, Bluesky, Lens, Mastodon
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
