'use client';

/**
 * @pages/creator/video — Creator Video Studio
 *
 * Unified video creation hub with 5 tabs:
 *   1. Shorts    — TikTok-style short form video creator
 *   2. Videos    — YouTube-style long-form video upload
 *   3. Live (Short) — TikTok-style vertical live stream
 *   4. Live (Full)  — YouTube-style horizontal live stream
 *   5. My Content   — All videos/shows across all platforms
 *
 * Design: Neon cyberpunk grid layer with glass-morphism cards,
 *         degen-green accent system, cinematic dark theme.
 */

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import type { CreatorVideoMeta } from '../../../components/creator/useCreatorVideos';
import { useWeb3 } from '../../../components/Web3Provider';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type VideoTab = 'shorts' | 'videos' | 'live-short' | 'live-full' | 'my-content';
type PublishTarget = 'degenfeed' | 'peertube' | 'farcaster' | 'zora' | 'nostr' | 'youtube';

interface VideoDraft {
  id: string;
  title: string;
  description: string;
  tags: string[];
  visibility: 'public' | 'unlisted' | 'followers' | 'token-gated';
  monetization: { tips: boolean; ads: boolean; subscription: boolean };
  publishTargets: PublishTarget[];
  file: File | null;
  thumbnail: string | null;
  category: string;
  duration: number;
  createdAt: number;
}

interface ShortDraft {
  id: string;
  title: string;
  description: string;
  hashtags: string[];
  publishTargets: PublishTarget[];
  recordedBlob: Blob | null;
  previewUrl: string | null;
  musicTrack: string | null;
  filter: string;
  textOverlay: string;
  createdAt: number;
}

interface LiveConfig {
  title: string;
  description: string;
  category: string;
  tags: string[];
  thumbnail: string | null;
  format: 'portrait' | 'landscape';
  platforms: PublishTarget[];
  tipsEnabled: boolean;
  tokenGated: boolean;
  tipGoal: number;
  chatEnabled: boolean;
}

interface VideoAnalyticsData {
  totalViews: number;
  totalWatchTime: number;
  avgViewDuration: number;
  tipRevenue: number;
  newFollowers: number;
  topContent: Array<{ title: string; views: number; revenue: number }>;
  bestTimes: Array<{ day: string; hour: number; engagement: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const TABS: { id: VideoTab; label: string; icon: string; desc: string }[] = [
  { id: 'shorts', label: 'Shorts', icon: '🎬', desc: 'TikTok-style vertical videos' },
  { id: 'videos', label: 'Videos', icon: '📹', desc: 'YouTube-style long-form' },
  { id: 'live-short', label: 'Live (Short)', icon: '📱', desc: 'Vertical live stream' },
  { id: 'live-full', label: 'Live (Full)', icon: '🖥️', desc: 'Horizontal live stream' },
  { id: 'my-content', label: 'My Content', icon: '📁', desc: 'All your videos & streams' },
];

const PUBLISH_TARGETS: { id: PublishTarget; label: string; icon: string; color: string }[] = [
  { id: 'degenfeed', label: 'DegenFeed', icon: '◆', color: '#00ff41' },
  { id: 'peertube', label: 'PeerTube', icon: '▶', color: '#f2691d' },
  { id: 'farcaster', label: 'Farcaster', icon: '◈', color: '#8a63d2' },
  { id: 'zora', label: 'Zora', icon: '⧫', color: '#f5a623' },
  { id: 'nostr', label: 'Nostr', icon: '⚡', color: '#8e30eb' },
  { id: 'youtube', label: 'YouTube', icon: '▶', color: '#ff0000' },
];

const CATEGORIES = [
  'Entertainment',
  'Music',
  'Gaming',
  'Education',
  'News',
  'Tech',
  'Crypto',
  'DeFi',
  'Trading',
  'Comedy',
  'Sports',
  'Art',
];

const FILTERS = [
  { id: 'none', label: 'None' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'noir', label: 'Noir' },
  { id: 'neon', label: 'Neon' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'drama', label: 'Drama' },
  { id: 'fade', label: 'Fade' },
  { id: 'chrome', label: 'Chrome' },
];

const MUSIC_TRACKS = [
  { id: 'none', label: 'No Music' },
  { id: 'lo-fi', label: 'Lo-Fi Beats' },
  { id: 'phonk', label: 'Phonk' },
  { id: 'edm', label: 'EDM' },
  { id: 'jazz', label: 'Jazz' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'hiphop', label: 'Hip Hop' },
  { id: 'rock', label: 'Rock' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

// ─── Tab Header ───────────────────────────────────────────────────────────

function StudioTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: VideoTab;
  onTabChange: (tab: VideoTab) => void;
}) {
  return (
    <div
      className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-1 scrollbar-none"
      role="tablist"
      aria-label="Video Studio tabs"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all ${
              isActive
                ? 'bg-gradient-to-br from-degen-500/15 to-emerald-500/10 text-degen-400 shadow-sm'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]'
            }`}
          >
            <span className="text-sm" aria-hidden="true">
              {tab.icon}
            </span>
            <div className="text-left">
              <div className="text-xs font-semibold">{tab.label}</div>
              <div className="text-[8px] opacity-60 hidden sm:block">{tab.desc}</div>
            </div>
            {isActive && (
              <span className="absolute -bottom-px left-2 right-2 h-0.5 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(0,255,65,0.6)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Publish Target Pills ──────────────────────────────────────────────────

function PublishTargetPills({
  selected,
  onToggle,
}: {
  selected: Set<PublishTarget>;
  onToggle: (target: PublishTarget) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PUBLISH_TARGETS.map((p) => {
        const isSelected = selected.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all ${
              isSelected
                ? 'text-white shadow-sm'
                : 'border border-[var(--color-glass-border)] text-[var(--color-muted)] hover:border-white/20 hover:text-[var(--color-fg)]'
            }`}
            style={
              isSelected
                ? { backgroundColor: `${p.color}30`, color: p.color, borderColor: `${p.color}50` }
                : {}
            }
          >
            <span>{p.icon}</span>
            <span>{p.label}</span>
            {isSelected && <span className="ml-0.5 text-[8px]">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Drag & Drop Zone ──────────────────────────────────────────────────────

function DropZone({
  onFile,
  accept = 'video/*',
  label = 'Drop video here or click to browse',
  multiple = false,
}: {
  onFile: (files: File[]) => void;
  accept?: string;
  label?: string;
  multiple?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('video/'));
      if (files.length > 0) onFile(files);
    },
    [onFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFile(Array.from(e.target.files));
      }
    },
    [onFile],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: DropZone requires div for HTML5 drag-and-drop API
    // biome-ignore lint/a11y/useSemanticElements: DropZone cannot use button; button elements break drag events on mobile
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
        dragging
          ? 'border-degen-500 bg-degen-500/10'
          : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-degen-500/30 hover:bg-degen-500/5'
      }`}
    >
      <label className="flex cursor-pointer flex-col items-center">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
          aria-label="Upload video"
        />
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/20 to-emerald-500/10">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-degen-400"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--color-fg)]">{label}</p>
        <p className="mt-1 text-[10px] text-[var(--color-muted)]">MP4, WebM, MOV • Max 4GB</p>
      </label>
    </div>
  );
}

// ─── Recording Timer ───────────────────────────────────────────────────────

function RecordingTimer({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
      </span>
      <span className="font-mono text-xl font-bold tabular-nums text-white drop-shadow-lg">
        {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab: Shorts Creator
// ═══════════════════════════════════════════════════════════════════════════

function ShortsCreatorTab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<'select' | 'record' | 'upload' | 'edit' | 'publish' | 'done'>(
    'select',
  );
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [selectedMusic, setSelectedMusic] = useState('none');
  const [textOverlay, setTextOverlay] = useState('');
  const [publishTargets, setPublishTargets] = useState<Set<PublishTarget>>(new Set(['degenfeed']));
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          t.stop();
        });
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          t.stop();
        });
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMode('record');
      setCameraFacing(facing);
    } catch {
      setError('Camera access denied. Please allow camera permissions or upload a file instead.');
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setMode('edit');
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      setRecordingTime(0);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(100);
    setRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime((t) => {
        if (t >= 60) {
          recorder.stop();
          return t;
        }
        return t + 1;
      });
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleUploadFile = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setRecordedBlob(file);
    setPreviewUrl(url);
    setMode('edit');
  }, []);

  const togglePublishTarget = useCallback((target: PublishTarget) => {
    setPublishTargets((prev) => {
      const next = new Set(prev);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  }, []);

  const handlePublish = useCallback(async () => {
    if (!recordedBlob || !title.trim()) return;
    setMode('publish');
    setUploadProgress(0);

    // Simulate upload progress
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((r) => setTimeout(r, 50));
      setUploadProgress(i);
    }

    // Simulate publish
    await new Promise((r) => setTimeout(r, 500));
    setMode('done');
  }, [recordedBlob, title]);

  const handleReset = useCallback(() => {
    setMode('select');
    setRecordedBlob(null);
    setPreviewUrl(null);
    setTitle('');
    setDescription('');
    setHashtags('');
    setTextOverlay('');
    setSelectedFilter('none');
    setSelectedMusic('none');
    setPublishTargets(new Set(['degenfeed']));
    setUploadProgress(0);
    setError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.stop();
      });
      streamRef.current = null;
    }
  }, []);

  if (mode === 'done') {
    return (
      <div className="rounded-2xl border border-degen-500/20 bg-gradient-to-br from-degen-500/[0.05] to-emerald-500/[0.03] p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-degen-500/20">
          <span className="text-3xl text-degen-400">✓</span>
        </div>
        <h3 className="text-xl font-bold text-[var(--color-fg)]">Short Published!</h3>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Your short is now live on {publishTargets.size} platform
          {publishTargets.size !== 1 ? 's' : ''}.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" onClick={handleReset} className="btn-primary">
            Create Another
          </button>
          <button type="button" onClick={() => setMode('select')} className="btn-secondary">
            Done
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'publish') {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <div className="mb-6 text-4xl">📤</div>
        <h3 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Publishing...</h3>
        <div className="mx-auto mb-2 h-2 w-full max-w-xs overflow-hidden rounded-full bg-[var(--color-overlay)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-degen-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
        <p className="text-xs text-[var(--color-muted)]">{uploadProgress}% complete</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {Array.from(publishTargets).map((t) => {
            const meta = PUBLISH_TARGETS.find((p) => p.id === t);
            return (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-medium"
                style={{ backgroundColor: `${meta?.color}20`, color: meta?.color }}
              >
                {meta?.icon} {meta?.label}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (mode === 'edit') {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Preview */}
        <div>
          <div className="relative mx-auto aspect-[9/16] max-w-xs overflow-hidden rounded-2xl bg-black">
            {previewUrl && (
              <video
                src={previewUrl}
                className="h-full w-full object-cover"
                controls
                style={
                  selectedFilter !== 'none' ? { filter: `url(#${selectedFilter})` } : undefined
                }
              />
            )}
            {textOverlay && (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <p className="text-center text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {textOverlay}
                </p>
              </div>
            )}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3">
              <span className="text-[10px] font-medium text-white/70">
                {formatDuration(recordingTime || 15)}
              </span>
            </div>
          </div>
        </div>

        {/* Edit controls */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a title..."
              className="input w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
              maxLength={100}
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this about?"
              rows={2}
              className="input w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] resize-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Hashtags
            </label>
            <input
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#crypto #defi #trading"
              className="input w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
          </div>

          {/* Filter */}
          <div>
            <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Filter
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
                    selectedFilter === f.id
                      ? 'bg-degen-500/15 text-degen-400'
                      : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Music */}
          <div>
            <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Music
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MUSIC_TRACKS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMusic(m.id)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
                    selectedMusic === m.id
                      ? 'bg-degen-500/15 text-degen-400'
                      : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Overlay */}
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Text Overlay
            </label>
            <input
              type="text"
              value={textOverlay}
              onChange={(e) => setTextOverlay(e.target.value)}
              placeholder="Add text overlay..."
              className="input w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
              maxLength={80}
            />
          </div>

          {/* Publish Targets */}
          <div>
            <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Publish To
            </label>
            <PublishTargetPills selected={publishTargets} onToggle={togglePublishTarget} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!title.trim() || publishTargets.size === 0}
              className="flex-1 rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 disabled:opacity-30"
            >
              Publish Short
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'record') {
    return (
      <div className="space-y-4">
        <div className="relative mx-auto aspect-[9/16] max-w-sm overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          {/* Recording indicator */}
          <div className="absolute left-4 top-4">
            <RecordingTimer seconds={recordingTime} />
          </div>

          {/* Switch camera */}
          <button
            type="button"
            onClick={() => startCamera(cameraFacing === 'user' ? 'environment' : 'user')}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            aria-label="Switch camera"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            Cancel
          </button>
          {recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
              aria-label="Stop recording"
            >
              <div className="h-5 w-5 rounded-sm bg-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
              aria-label="Start recording"
            >
              <div className="h-7 w-7 rounded-full bg-white" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Select mode
  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-xs text-red-400">{error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Record */}
        <button
          type="button"
          onClick={() => startCamera('user')}
          className="group relative overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-gradient-to-br from-purple-500/10 to-pink-500/5 p-8 text-center transition-all hover:border-degen-500/30 hover:shadow-[0_0_30px_rgba(0,255,65,0.06)]"
        >
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/20 to-pink-500/10 transition-transform group-hover:scale-110">
            <div className="h-6 w-6 rounded-full bg-red-500" />
          </div>
          <h3 className="text-sm font-bold text-[var(--color-fg)]">Record</h3>
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">
            Use your camera to record a short
          </p>
        </button>

        {/* Upload */}
        <div>
          <DropZone onFile={handleUploadFile} label="Upload a video file" />
        </div>
      </div>

      {/* Quick tips */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
          💡 Tips for Great Shorts
        </h4>
        <ul className="space-y-1 text-[10px] text-[var(--color-muted)]">
          <li>• Keep it under 60 seconds for best engagement</li>
          <li>• Vertical 9:16 ratio works best</li>
          <li>• Add text overlays for silent viewers</li>
          <li>• Use hashtags to reach more people</li>
          <li>• Cross-post to all platforms for maximum reach</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab: Videos (Long-form)
// ═══════════════════════════════════════════════════════════════════════════

function VideosCreatorTab() {
  const [mode, setMode] = useState<'upload' | 'metadata' | 'publishing' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('Entertainment');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'followers' | 'token-gated'>(
    'public',
  );
  const [publishTargets, setPublishTargets] = useState<Set<PublishTarget>>(
    new Set(['degenfeed', 'peertube']),
  );
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [tipsEnabled, setTipsEnabled] = useState(true);
  const [tokenGated, setTokenGated] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const togglePublishTarget = useCallback((target: PublishTarget) => {
    setPublishTargets((prev) => {
      const next = new Set(prev);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  }, []);

  const handleFile = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    // Auto-title from filename
    setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    setMode('metadata');
  }, []);

  const handleThumbnailUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) setThumbnail(URL.createObjectURL(f));
    };
    input.click();
  }, []);

  const handlePublish = useCallback(async () => {
    if (!title.trim()) return;
    setMode('publishing');
    setUploadProgress(0);

    for (let i = 0; i <= 100; i += 3) {
      await new Promise((r) => setTimeout(r, 30));
      setUploadProgress(i);
    }
    await new Promise((r) => setTimeout(r, 500));
    setMode('done');
  }, [title]);

  const handleReset = useCallback(() => {
    setMode('upload');
    setFile(null);
    setPreviewUrl(null);
    setTitle('');
    setDescription('');
    setTags('');
    setCategory('Entertainment');
    setVisibility('public');
    setPublishTargets(new Set(['degenfeed', 'peertube']));
    setThumbnail(null);
    setTipsEnabled(true);
    setTokenGated(false);
    setUploadProgress(0);
    setError(null);
  }, []);

  if (mode === 'done') {
    return (
      <div className="rounded-2xl border border-degen-500/20 bg-gradient-to-br from-degen-500/[0.05] to-emerald-500/[0.03] p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-degen-500/20">
          <span className="text-3xl text-degen-400">✓</span>
        </div>
        <h3 className="text-xl font-bold text-[var(--color-fg)]">Video Published!</h3>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Your video is now processing and will be available shortly.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" onClick={handleReset} className="btn-primary">
            Upload Another
          </button>
          <button type="button" onClick={handleReset} className="btn-secondary">
            Done
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'publishing') {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center">
        <div className="mb-6 text-4xl">📤</div>
        <h3 className="mb-2 text-lg font-bold text-[var(--color-fg)]">Uploading & Publishing...</h3>
        <div className="mx-auto mb-2 h-2 w-full max-w-sm overflow-hidden rounded-full bg-[var(--color-overlay)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-degen-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          {uploadProgress}% — {file?.name}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {Array.from(publishTargets).map((t) => {
            const meta = PUBLISH_TARGETS.find((p) => p.id === t);
            return (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-medium"
                style={{ backgroundColor: `${meta?.color}20`, color: meta?.color }}
              >
                {meta?.icon} {meta?.label}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (mode === 'metadata') {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Preview */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl bg-black">
            {previewUrl && (
              <video src={previewUrl} className="aspect-video w-full object-contain" controls />
            )}
          </div>

          {/* Visibility */}
          <div>
            <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Visibility
            </label>
            <div className="flex gap-2">
              {(['public', 'unlisted', 'followers', 'token-gated'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-medium transition-all ${
                    visibility === v
                      ? 'bg-degen-500/15 text-degen-400'
                      : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  {v === 'public' && '🌐 Public'}
                  {v === 'unlisted' && '🔗 Unlisted'}
                  {v === 'followers' && '👥 Followers'}
                  {v === 'token-gated' && '🔒 Token Gated'}
                </button>
              ))}
            </div>
          </div>

          {/* Monetization */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              💰 Monetization
            </h4>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-fg)]">Enable Tips</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tipsEnabled}
                  onClick={() => setTipsEnabled(!tipsEnabled)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    tipsEnabled ? 'bg-degen-500' : 'bg-[var(--color-overlay)]'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                      tipsEnabled ? 'translate-x-4' : ''
                    }`}
                  />
                </button>
              </label>
              <label className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-fg)]">Token-Gated Access</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tokenGated}
                  onClick={() => setTokenGated(!tokenGated)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    tokenGated ? 'bg-degen-500' : 'bg-[var(--color-overlay)]'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                      tokenGated ? 'translate-x-4' : ''
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a title..."
              className="input w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
              maxLength={200}
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell viewers about your video..."
              rows={4}
              className="input w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] resize-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="crypto, defi, tutorial"
              className="input w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Category
            </label>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
                    category === c
                      ? 'bg-degen-500/15 text-degen-400'
                      : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Thumbnail
            </label>
            <div className="flex items-center gap-3">
              {thumbnail ? (
                <div className="relative aspect-video w-32 overflow-hidden rounded-lg">
                  <img src={thumbnail} alt="Thumbnail" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setThumbnail(null)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[8px] text-white"
                    aria-label="Remove thumbnail"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleThumbnailUpload}
                  className="flex aspect-video w-32 items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] text-[9px] text-[var(--color-muted)] hover:border-degen-500/30 hover:text-degen-400"
                >
                  + Thumbnail
                </button>
              )}
              <span className="text-[9px] text-[var(--color-muted)]">Recommended: 1280×720</span>
            </div>
          </div>

          {/* Publish Targets */}
          <div>
            <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Distribution
            </label>
            <PublishTargetPills selected={publishTargets} onToggle={togglePublishTarget} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!title.trim() || publishTargets.size === 0}
              className="flex-1 rounded-xl bg-gradient-to-r from-degen-600 to-degen-400 py-2.5 text-xs font-bold text-black transition-all hover:from-degen-500 hover:to-degen-300 disabled:opacity-30"
            >
              Publish Video
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-xs text-red-400">{error}</div>
      )}

      {/* Import from URL */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <label className="mb-2 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
          Import from URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="Paste a video URL (YouTube, PeerTube, etc.)..."
            className="input flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
          />
          <button
            type="button"
            className="rounded-xl bg-degen-500/15 px-4 py-2.5 text-xs font-semibold text-degen-400 hover:bg-degen-500/25 transition-colors"
          >
            Import
          </button>
        </div>
      </div>

      <DropZone onFile={handleFile} label="Drop video here or click to browse" />

      {/* Format info */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 text-center">
          <div className="text-lg">📹</div>
          <div className="text-[10px] font-medium text-[var(--color-fg)]">Up to 4K</div>
          <div className="text-[8px] text-[var(--color-muted)]">High quality supported</div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 text-center">
          <div className="text-lg">📤</div>
          <div className="text-[10px] font-medium text-[var(--color-fg)]">Multi-Platform</div>
          <div className="text-[8px] text-[var(--color-muted)]">Publish everywhere at once</div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 text-center">
          <div className="text-lg">💰</div>
          <div className="text-[10px] font-medium text-[var(--color-fg)]">Monetize</div>
          <div className="text-[8px] text-[var(--color-muted)]">Tips & token gates</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab: Live Stream (Short/Full)
// ═══════════════════════════════════════════════════════════════════════════

function LiveStreamTab({ format }: { format: 'portrait' | 'landscape' }) {
  const [step, setStep] = useState<'setup' | 'streaming'>('setup');
  const [config, setConfig] = useState<LiveConfig>({
    title: '',
    description: '',
    category: 'Entertainment',
    tags: [],
    thumbnail: null,
    format,
    platforms: ['degenfeed'],
    tipsEnabled: true,
    tokenGated: false,
    tipGoal: 0,
    chatEnabled: true,
  });
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [rtmpUrl, setRtmpUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Simulate stream stats when live
  useEffect(() => {
    if (step !== 'streaming') return;
    const interval = setInterval(() => {
      setStreamDuration((d) => d + 1);
      setViewerCount((v) => Math.max(0, v + Math.floor(Math.random() * 5) - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const handleStartStream = useCallback(async () => {
    if (!config.title.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      // Simulate API call to get stream key
      await new Promise((r) => setTimeout(r, 1500));
      setStreamKey(`df_live_${generateId().slice(0, 12)}`);
      setRtmpUrl(
        format === 'portrait'
          ? 'rtmp://live.degenfeed.xyz/shorts'
          : 'rtmp://live.degenfeed.xyz/live',
      );
      setViewerCount(0);
      setStep('streaming');
    } catch {
      setError('Failed to start stream. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [config, format]);

  const handleStopStream = useCallback(() => {
    setStep('setup');
    setStreamKey(null);
    setRtmpUrl(null);
    setStreamDuration(0);
    setViewerCount(0);
  }, []);

  const togglePlatform = useCallback((target: PublishTarget) => {
    setConfig((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(target)
        ? prev.platforms.filter((p) => p !== target)
        : [...prev.platforms, target],
    }));
  }, []);

  const platformsToShow: PublishTarget[] = ['degenfeed', 'peertube', 'farcaster', 'youtube'];
  const simulcastPlatforms = useMemo(
    () => platformsToShow.filter((p) => config.platforms.includes(p)),
    [config.platforms, platformsToShow.filter],
  );

  if (step === 'streaming') {
    return (
      <div className="space-y-6">
        {/* Stream status banner */}
        <div className="relative overflow-hidden rounded-2xl border border-degen-500/20 bg-gradient-to-br from-degen-500/[0.08] via-emerald-500/[0.05] to-[var(--color-card)] p-6">
          <div
            className={`absolute inset-0 bg-gradient-to-br opacity-10 ${
              format === 'portrait'
                ? 'from-purple-600 via-pink-600 to-degen-600'
                : 'from-blue-600 via-purple-600 to-degen-600'
            }`}
          />
          <div className="relative z-10">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-xl bg-red-500/20" />
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                  </span>
                </span>
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-fg)]">{config.title}</h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    {format === 'portrait' ? 'Vertical' : 'Horizontal'} · Live for{' '}
                    {formatDuration(streamDuration)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStopStream}
                className="rounded-xl bg-red-500/20 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/30 transition-colors"
              >
                End Stream
              </button>
            </div>

            {/* Stream stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-black/20 backdrop-blur-sm p-3 text-center">
                <div className="text-2xl font-black text-degen-400 tabular-nums">{viewerCount}</div>
                <div className="text-[9px] text-[var(--color-muted)]">Viewers</div>
              </div>
              <div className="rounded-xl bg-black/20 backdrop-blur-sm p-3 text-center">
                <div className="text-2xl font-black text-degen-400 tabular-nums">
                  {formatDuration(streamDuration)}
                </div>
                <div className="text-[9px] text-[var(--color-muted)]">Duration</div>
              </div>
              <div className="rounded-xl bg-black/20 backdrop-blur-sm p-3 text-center">
                <div className="text-2xl font-black text-degen-400 tabular-nums">
                  {simulcastPlatforms.length}
                </div>
                <div className="text-[9px] text-[var(--color-muted)]">Platforms</div>
              </div>
            </div>
          </div>
        </div>

        {/* Stream Key & RTMP URL */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <label className="mb-1 block text-[9px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              RTMP URL
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-[var(--color-overlay)] px-3 py-2 text-xs font-mono text-degen-400">
                {rtmpUrl}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(rtmpUrl ?? '')}
                className="shrink-0 rounded-lg bg-[var(--color-overlay)] px-2 py-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                aria-label="Copy RTMP URL"
              >
                📋
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <label className="mb-1 block text-[9px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Stream Key
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-[var(--color-overlay)] px-3 py-2 text-xs font-mono text-degen-400">
                {streamKey}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(streamKey ?? '')}
                className="shrink-0 rounded-lg bg-[var(--color-overlay)] px-2 py-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                aria-label="Copy stream key"
              >
                📋
              </button>
            </div>
          </div>
        </div>

        {/* Simulcast platforms */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            📡 Simulcasting To
          </h4>
          <div className="flex flex-wrap gap-2">
            {simulcastPlatforms.map((p) => {
              const meta = PUBLISH_TARGETS.find((t) => t.id === p);
              return (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                  style={{ backgroundColor: `${meta?.color}20`, color: meta?.color }}
                >
                  {meta?.icon} {meta?.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Chat */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            <span>💬</span> Unified Chat
          </h4>
          <div className="mb-3 flex h-48 flex-col gap-2 overflow-y-auto rounded-xl bg-[var(--color-overlay)] p-3">
            <p className="text-[10px] text-[var(--color-muted)]">
              Chat messages from all platforms appear here.
            </p>
            <p className="text-[10px] text-[var(--color-muted)]/60">
              No messages yet. Share your stream to get started!
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Send a message..."
              className="input flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-2 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
              disabled
            />
            <button
              type="button"
              disabled
              className="rounded-xl bg-degen-500/30 px-4 py-2 text-xs font-semibold text-black/50"
            >
              Send
            </button>
          </div>
        </div>

        {/* OBS Instructions */}
        <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
          <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-[var(--color-fg)] hover:text-degen-400 transition-colors">
            📺 How to stream with OBS
          </summary>
          <div className="border-t border-[var(--color-border)] px-4 py-3">
            <ol className="ml-4 list-decimal space-y-1 text-[10px] text-[var(--color-muted)]">
              <li>Open OBS Studio</li>
              <li>Go to Settings → Stream</li>
              <li>
                Set Service to <strong>Custom...</strong>
              </li>
              <li>Paste the RTMP URL above</li>
              <li>Paste the Stream Key above</li>
              <li>Click OK and Start Streaming</li>
            </ol>
          </div>
        </details>

        {/* Simulcast note */}
        {simulcastPlatforms.length > 1 && (
          <div className="rounded-xl bg-gradient-to-r from-degen-500/[0.08] to-purple-500/[0.05] px-4 py-3 text-[10px] text-[var(--color-muted)]">
            <span className="font-semibold text-degen-400">📡 Simulcast Active:</span> Streaming to{' '}
            {simulcastPlatforms.length} platforms simultaneously. Chat is unified across all
            platforms.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-xs text-red-400">{error}</div>
      )}

      {/* Format indicator */}
      <div className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-gradient-to-r from-degen-500/[0.05] to-emerald-500/[0.03] px-4 py-3">
        <span className="text-lg">{format === 'portrait' ? '📱' : '🖥️'}</span>
        <div>
          <p className="text-xs font-semibold text-[var(--color-fg)]">
            {format === 'portrait' ? 'Vertical (Short) Live' : 'Horizontal (Full) Live'}
          </p>
          <p className="text-[9px] text-[var(--color-muted)]">
            {format === 'portrait'
              ? '9:16 TikTok-style — best for mobile viewers'
              : '16:9 YouTube-style — best for desktop viewers'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Setup form */}
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Stream Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig((p) => ({ ...p, title: e.target.value }))}
              placeholder="Give your stream a title..."
              className="input w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
              maxLength={150}
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={config.description}
              onChange={(e) => setConfig((p) => ({ ...p, description: e.target.value }))}
              placeholder="What's this stream about?"
              rows={3}
              className="input w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] resize-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Category
            </label>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setConfig((p) => ({ ...p, category: c }))}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
                    config.category === c
                      ? 'bg-degen-500/15 text-degen-400'
                      : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Platform selection & monetization */}
        <div className="space-y-4">
          {/* Simulcast platforms */}
          <div>
            <label className="mb-1.5 block text-[10px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Go Live On
            </label>
            <div className="space-y-2">
              {platformsToShow.map((p) => {
                const meta = PUBLISH_TARGETS.find((t) => t.id === p);
                const isSelected = config.platforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                      isSelected
                        ? 'border-degen-500/30 bg-degen-500/10'
                        : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-glass-border)]'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm ${
                        isSelected ? 'opacity-100' : 'opacity-50'
                      }`}
                      style={{ backgroundColor: isSelected ? `${meta?.color}20` : undefined }}
                    >
                      {meta?.icon}
                    </span>
                    <div className="flex-1">
                      <div
                        className={`text-xs font-semibold ${isSelected ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)]'}`}
                      >
                        {meta?.label}
                      </div>
                      <div className="text-[9px] text-[var(--color-muted)]">
                        {p === 'degenfeed' && 'Own platform — no limits'}
                        {p === 'peertube' && 'Free, federated'}
                        {p === 'farcaster' && 'Social reach'}
                        {p === 'youtube' && 'Mass audience (if connected)'}
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-degen-500 text-[8px] text-black font-bold">
                        ✓
                      </span>
                    ) : (
                      <span className="h-5 w-5 rounded-full border-2 border-[var(--color-border)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Monetization */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              💰 Monetization
            </h4>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-fg)]">Enable Tips</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.tipsEnabled}
                  onClick={() => setConfig((p) => ({ ...p, tipsEnabled: !p.tipsEnabled }))}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    config.tipsEnabled ? 'bg-degen-500' : 'bg-[var(--color-overlay)]'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${config.tipsEnabled ? 'translate-x-4' : ''}`}
                  />
                </button>
              </label>
              <label className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-fg)]">Token-Gated</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.tokenGated}
                  onClick={() => setConfig((p) => ({ ...p, tokenGated: !p.tokenGated }))}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    config.tokenGated ? 'bg-degen-500' : 'bg-[var(--color-overlay)]'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${config.tokenGated ? 'translate-x-4' : ''}`}
                  />
                </button>
              </label>
              {config.tipsEnabled && (
                <div>
                  <label className="mb-1 block text-[9px] text-[var(--color-muted)]">
                    Tip Goal (optional)
                  </label>
                  <input
                    type="number"
                    value={config.tipGoal || ''}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, tipGoal: Number(e.target.value) || 0 }))
                    }
                    placeholder="Set a tip goal..."
                    className="input w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)]"
                    min={0}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Chat */}
          <label className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
            <span className="flex items-center gap-2 text-xs text-[var(--color-fg)]">
              <span>💬</span>
              Unified Chat (all platforms)
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={config.chatEnabled}
              onClick={() => setConfig((p) => ({ ...p, chatEnabled: !p.chatEnabled }))}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                config.chatEnabled ? 'bg-degen-500' : 'bg-[var(--color-overlay)]'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${config.chatEnabled ? 'translate-x-4' : ''}`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Start button */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-[10px] text-[var(--color-muted)]">
          {config.platforms.length} platform{config.platforms.length !== 1 ? 's' : ''} selected
        </p>
        <button
          type="button"
          onClick={handleStartStream}
          disabled={!config.title.trim() || config.platforms.length === 0 || isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-degen-600 to-emerald-500 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-degen-500/20 transition-all hover:from-degen-500 hover:to-emerald-400 disabled:opacity-30 active:scale-[0.97]"
        >
          {isLoading ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              Setting up...
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Go Live {format === 'portrait' ? '(Vertical)' : '(Full)'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab: My Content
// ═══════════════════════════════════════════════════════════════════════════

function MyContentTab() {
  const [filterType, setFilterType] = useState<'all' | 'video' | 'short' | 'stream'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'views' | 'revenue'>('newest');
  const [videos, setVideos] = useState<CreatorVideoMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // Load videos from library
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/creator/videos?limit=50', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setVideos(data.videos ?? []);
        }
      } catch {
        // API not ready
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let items = [...videos];
    if (filterType === 'video') items = items.filter((v) => v.type === 'video' || !v.type);
    if (filterType === 'short') items = items.filter((v) => v.type === 'short');
    if (filterType === 'stream') items = items.filter((v) => v.type === 'stream');

    if (sortBy === 'views') items.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    else if (sortBy === 'revenue') items.sort((a, b) => (b.tipRevenue ?? 0) - (a.tipRevenue ?? 0));
    else
      items.sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      );

    return items;
  }, [videos, filterType, sortBy]);

  // Aggregate analytics
  const analytics = useMemo<VideoAnalyticsData>(() => {
    const totalViews = videos.reduce((s, v) => s + (v.views ?? 0), 0);
    const totalWatchTime = videos.reduce((s, v) => s + (v.watchTime ?? 0), 0);
    const tipRevenue = videos.reduce((s, v) => s + (v.tipRevenue ?? 0), 0);
    const newFollowers = videos.reduce((s, v) => s + (v.newFollowers ?? 0), 0);
    const avgViewDuration = totalViews > 0 ? Math.round(totalWatchTime / totalViews) : 0;

    const topContent = [...videos]
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 5)
      .map((v) => ({
        title: v.title || 'Untitled',
        views: v.views ?? 0,
        revenue: v.tipRevenue ?? 0,
      }));

    const bestTimes: VideoAnalyticsData['bestTimes'] = [
      { day: 'Monday', hour: 18, engagement: 89 },
      { day: 'Wednesday', hour: 12, engagement: 76 },
      { day: 'Friday', hour: 20, engagement: 94 },
      { day: 'Sunday', hour: 14, engagement: 82 },
    ];

    return {
      totalViews,
      totalWatchTime,
      avgViewDuration,
      tipRevenue,
      newFollowers,
      topContent,
      bestTimes,
    };
  }, [videos]);

  return (
    <div className="space-y-6">
      {/* Analytics overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-lg font-black text-[var(--color-fg)] tabular-nums">
            {formatCompact(analytics.totalViews)}
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">Total Views</div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-lg font-black text-[var(--color-fg)] tabular-nums">
            {formatDuration(analytics.avgViewDuration)}
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">Avg Watch Time</div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-lg font-black text-degen-400 tabular-nums">
            ${analytics.tipRevenue.toFixed(2)}
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">Tip Revenue</div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-lg font-black text-blue-400 tabular-nums">
            +{formatCompact(analytics.newFollowers)}
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">New Followers</div>
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
          <div className="text-lg font-black text-purple-400 tabular-nums">{videos.length}</div>
          <div className="text-[9px] text-[var(--color-muted)]">Total Videos</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-1">
          {(['all', 'video', 'short', 'stream'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterType(f)}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
                filterType === f
                  ? 'bg-degen-500/15 text-degen-400'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {f === 'all' && 'All'}
              {f === 'video' && '📹 Videos'}
              {f === 'short' && '🎬 Shorts'}
              {f === 'stream' && '🔴 Streams'}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-[10px] text-[var(--color-fg)]"
        >
          <option value="newest">Newest</option>
          <option value="views">Most Views</option>
          <option value="revenue">Highest Revenue</option>
        </select>
      </div>

      {/* Content list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((v) => (
            <div
              key={v.uuid}
              className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 transition-colors hover:border-degen-500/20"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--color-overlay)] sm:w-32">
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-lg text-[var(--color-muted)]">
                    {v.type === 'short' ? '🎬' : v.type === 'stream' ? '🔴' : '📹'}
                  </div>
                )}
                {v.duration && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[8px] font-mono text-white">
                    {formatDuration(v.duration)}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-xs font-semibold text-[var(--color-fg)]">
                  {v.title || 'Untitled'}
                </h4>
                <div className="mt-0.5 flex items-center gap-2 text-[9px] text-[var(--color-muted)]">
                  <span>{formatCompact(v.views ?? 0)} views</span>
                  <span>·</span>
                  <span>${(v.tipRevenue ?? 0).toFixed(2)} tips</span>
                  {v.createdAt && (
                    <>
                      <span>·</span>
                      <span>{timeAgo(new Date(v.createdAt).getTime())}</span>
                    </>
                  )}
                </div>
                {/* State badge */}
                {v.state && (
                  <span
                    className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
                      v.state === 'published'
                        ? 'bg-degen-500/15 text-degen-400'
                        : v.state === 'processing'
                          ? 'bg-yellow-500/15 text-yellow-400'
                          : v.state === 'error'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                    }`}
                  >
                    {v.state}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 gap-1">
                <a
                  href={`/video/${v.uuid}`}
                  className="rounded-lg px-2 py-1.5 text-[9px] text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
                >
                  View
                </a>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1.5 text-[9px] text-degen-400 hover:bg-degen-500/10 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-overlay)]">
            <span className="text-3xl text-[var(--color-muted)]">🎬</span>
          </div>
          <h3 className="text-lg font-bold text-[var(--color-fg)]">No Content Yet</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Create your first short, upload a video, or go live!
          </p>
        </div>
      )}

      {/* Best time to publish insight */}
      {analytics.totalViews > 0 && (
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-gradient-to-r from-degen-500/[0.05] to-purple-500/[0.03] p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            <span>📊</span> Best Time to Publish
          </h4>
          <div className="flex gap-2">
            {analytics.bestTimes.map((bt) => (
              <div
                key={`${bt.day}-${bt.hour}`}
                className="flex-1 rounded-lg bg-[var(--color-card)] px-2 py-2 text-center"
              >
                <div className="text-[9px] font-medium text-[var(--color-fg)]">{bt.day}</div>
                <div className="text-lg font-black text-degen-400">
                  {bt.hour > 12 ? `${bt.hour - 12}pm` : `${bt.hour}am`}
                </div>
                <div className="text-[8px] text-[var(--color-muted)]">
                  {bt.engagement}% engagement
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top performing content */}
      {analytics.topContent.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <h4 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
            🏆 Top Performing
          </h4>
          <div className="space-y-2">
            {analytics.topContent.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-2 truncate text-[var(--color-fg)]">
                  <span className="shrink-0 w-4 text-center font-bold text-[var(--color-muted)]">
                    {i + 1}
                  </span>
                  {item.title}
                </span>
                <span className="shrink-0 ml-2 flex items-center gap-3">
                  <span className="tabular-nums text-[var(--color-muted)]">
                    {formatCompact(item.views)} views
                  </span>
                  <span className="tabular-nums text-degen-400">${item.revenue.toFixed(2)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════

export default function CreatorVideoStudioPage() {
  const { ready, walletAddress, openSignIn } = useAuth();
  const { isConnected } = useWeb3();
  const [activeTab, setActiveTab] = useState<VideoTab>('shorts');

  const hasWallet = isConnected || !!walletAddress;

  // ── Loading State ──
  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="skeleton mb-6 h-12 w-80 rounded-xl" />
        <div className="skeleton mb-6 h-10 w-full rounded-2xl" />
        <div className="skeleton h-96 w-full rounded-2xl" />
      </div>
    );
  }

  // ── Wallet Gate ──
  if (!hasWallet) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
          <span className="text-3xl text-degen-400">🎬</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Creator Video Studio</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">
          Connect your wallet to create shorts, upload videos, and go live across all platforms. One
          dashboard to rule all your video content.
        </p>
        <div className="mt-8">
          <button type="button" onClick={openSignIn} className="btn-primary text-sm">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
        {/* ── Header ── */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">
              <span className="text-degen-400">◆</span> Creator Video Studio
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Create, upload, and stream video content across all platforms
            </p>
          </div>

          {/* Creator studio links */}
          <div className="flex items-center gap-2">
            <a
              href="/creator/videos"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)] hover:border-degen-500/30"
            >
              <span>📁</span>
              <span className="hidden sm:inline">Legacy Videos</span>
            </a>
            <a
              href="/creator/content"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)] hover:border-degen-500/30"
            >
              <span>📝</span>
              <span className="hidden sm:inline">Content Studio</span>
            </a>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <StudioTabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* ── Tab Content ── */}
        <div className="min-h-[400px]">
          {activeTab === 'shorts' && <ShortsCreatorTab />}
          {activeTab === 'videos' && <VideosCreatorTab />}
          {activeTab === 'live-short' && <LiveStreamTab format="portrait" />}
          {activeTab === 'live-full' && <LiveStreamTab format="landscape" />}
          {activeTab === 'my-content' && <MyContentTab />}
        </div>
      </div>
    </ErrorBoundary>
  );
}
