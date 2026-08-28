'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StreamExtended, ViewerAnalytics } from './types';

/* === Stat Card ================================================ */

function StatCard({
  label,
  value,
  change,
  icon,
  color,
}: {
  label: string;
  value: string;
  change?: string;
  icon: React.ReactNode;
  color: string;
}) {
  const isPositive = change?.startsWith('+');
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20">
      <div className="flex items-center justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          {icon}
        </div>
        {change && (
          <span
            className={`text-[10px] font-medium ${isPositive ? 'text-degen-400' : 'text-red-400'}`}
          >
            {change}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-white/40">{label}</p>
    </div>
  );
}

/* === Viewer Chart (simplified) ================================ */

function ViewerChart({ data }: { data: ViewerAnalytics }) {
  const max = Math.max(...data.viewerHistory.map((h) => h.count), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.viewerHistory.slice(-48).map((point, i) => {
        const height = (point.count / max) * 100;
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all hover:opacity-80"
            style={{
              height: `${Math.max(height, 3)}%`,
              backgroundColor:
                point.count > data.averageViewers ? 'rgba(0,255,65,0.5)' : 'rgba(255,255,255,0.1)',
            }}
            title={`${point.count} viewers`}
          />
        );
      })}
    </div>
  );
}

/* === Metric bar =============================================== */

function MetricBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-[10px] text-white/50">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-16 text-right text-[10px] font-medium text-white/70 tabular-nums">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

/* === Generate mock analytics ================================== */

/* === CreatorDashboard ========================================= */

interface CreatorDashboardProps {
  streamId?: string;
}

export function CreatorDashboard(_props: CreatorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'revenue' | 'vods'>('overview');
  const analytics = useRef<ViewerAnalytics>({} as ViewerAnalytics).current;
  const streams = useRef<StreamExtended[]>([]).current[0];

  /* === Stream health simulation =============================== */
  const [uptime, setUptime] = useState('00:00:00');
  const [bitrate, setBitrate] = useState(3500);
  const [fps, setFps] = useState(60);
  const [droppedFrames, setDroppedFrames] = useState(0.2);

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime((prev) => {
        const parts = prev.split(':').map(Number);
        const h = parts[0] ?? 0;
        const m = parts[1] ?? 0;
        const s = parts[2] ?? 0;
        const total = h * 3600 + m * 60 + s + 1;
        return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      });
      setBitrate((b) => b + Math.floor(Math.random() * 100 - 50));
      setFps((f) => Math.max(30, Math.min(60, f + Math.floor(Math.random() * 5 - 2))));
      setDroppedFrames((d) => Math.max(0, d + (Math.random() - 0.5) * 0.1));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleEndStream = useCallback(() => {
    // End stream logic
  }, []);

  return (
    <div className="space-y-6">
      {/* Stream health bar */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold uppercase text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
            <span className="text-sm font-semibold text-white/90">
              {streams?.title ?? 'Stream'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleEndStream}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition-colors"
          >
            End Stream
          </button>
        </div>

        {/* Health metrics */}
        <div className="mt-4 grid grid-cols-5 gap-3">
          {[
            { label: 'Uptime', value: uptime, color: '#00ff41' },
            { label: 'Bitrate', value: `${bitrate} Kbps`, color: '#2196F3' },
            { label: 'FPS', value: String(fps), color: '#FFD600' },
            {
              label: 'Dropped Frames',
              value: `${droppedFrames.toFixed(1)}%`,
              color: droppedFrames > 1 ? '#F44336' : '#00C853',
            },
            {
              label: 'Viewers',
              value: streams?.viewerCount.toLocaleString() ?? '0',
              color: '#9146FF',
            },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <p className="text-xs font-bold text-white tabular-nums" style={{ color: m.color }}>
                {m.value}
              </p>
              <p className="text-[9px] text-white/30 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10" role="tablist">
        {(['overview', 'chat', 'revenue', 'vods'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-medium capitalize transition-all border-b-2 ${
              activeTab === tab
                ? 'border-degen-500 text-degen-400'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-4 animate-fade-in">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Peak Viewers"
              value={analytics.peakViewers.toLocaleString()}
              change="+12%"
              icon={
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#00ff41"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              }
              color="#00ff41"
            />
            <StatCard
              label="Avg Viewers"
              value={analytics.averageViewers.toLocaleString()}
              icon={
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2196F3"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              }
              color="#2196F3"
            />
            <StatCard
              label="New Followers"
              value={analytics.newFollowers.toLocaleString()}
              change="+8%"
              icon={
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFD600"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              }
              color="#FFD600"
            />
            <StatCard
              label="Tips Received"
              value={`$${analytics.tipsReceived.toFixed(2)}`}
              change="+23%"
              icon={
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FF4081"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              }
              color="#FF4081"
            />
          </div>

          {/* Viewer chart */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white/70">Viewer Trend (Last 2 Hours)</h3>
              <span className="text-[9px] text-white/30">Peak: {analytics.peakViewers}</span>
            </div>
            <ViewerChart data={analytics} />
          </div>

          {/* Top chatters */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h3 className="mb-3 text-xs font-semibold text-white/70">Top Chatters</h3>
            <div className="space-y-2">
              {analytics.topChatters.slice(0, 5).map((chatter, i) => (
                <div key={chatter.handle} className="flex items-center gap-3">
                  <span className="w-4 text-[10px] text-white/30 tabular-nums">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/70">{chatter.handle}</span>
                      <span className="text-[10px] text-white/40">{chatter.messages} msgs</span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-degen-500 to-emerald-400"
                        style={{
                          width: `${(chatter.messages / (analytics.topChatters[0]?.messages ?? 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 animate-fade-in">
          <div className="space-y-3">
            <MetricBar
              label="Total Messages"
              value={analytics.topChatters.reduce((a, c) => a + c.messages, 0)}
              max={2000}
              color="#00ff41"
            />
            <MetricBar
              label="Unique Chatters"
              value={analytics.topChatters.length}
              max={50}
              color="#9146FF"
            />
            <MetricBar label="Commands Used" value={23} max={100} color="#2196F3" />
            <MetricBar label="Emotes Used" value={156} max={500} color="#FFD600" />
          </div>
        </div>
      )}

      {activeTab === 'revenue' && (
        <div className="space-y-3 animate-fade-in">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Subscriptions', value: '$345.60', change: '+12%', color: '#9146FF' },
              { label: 'Tips', value: '$456.78', change: '+23%', color: '#FF4081' },
              { label: 'Total This Stream', value: '$802.38', change: '+18%', color: '#00ff41' },
            ].map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                change={item.change}
                icon={<div />}
                color={item.color}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'vods' && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white/80">VOD Management</h3>
              <p className="text-xs text-white/40 mt-1">
                Your past broadcasts are automatically saved. Download or export highlights.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:bg-white/5"
            >
              Export to PeerTube
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            {['Current Stream (in progress)', 'Previous Stream — DeFi Deep Dive'].map((vod, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-white/10 p-3"
              >
                <div className="aspect-video w-20 rounded bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="white"
                    opacity="0.3"
                    aria-hidden="true"
                  >
                    <polygon points="6 3 20 12 6 21 6 3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-white/70">{vod}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">2.3 GB • 3h 24m</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 px-2.5 py-1 text-[9px] text-white/40 hover:bg-white/5"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
