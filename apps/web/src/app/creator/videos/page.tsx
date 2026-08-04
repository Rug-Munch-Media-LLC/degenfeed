'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import type { CreatorVideoMeta } from '../../../components/creator/useCreatorVideos';
import VideoLibrary from '../../../components/creator/VideoLibrary';
import { useWeb3 } from '../../../components/Web3Provider';

// === Dynamic imports (heavy modals) =======================================

const VideoUploader = dynamic(() => import('../../../components/creator/VideoUploader'), {
  ssr: false,
});

const VideoEditor = dynamic(() => import('../../../components/creator/VideoEditor'), {
  ssr: false,
});

const VideoAnalytics = dynamic(() => import('../../../components/creator/VideoAnalytics'), {
  ssr: false,
});

const ShortCreator = dynamic(() => import('../../../components/creator/ShortCreator'), {
  ssr: false,
});

// === Types ===============================================================

type TabId = 'all' | 'videos' | 'shorts';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'all', label: 'All Content', icon: '📁' },
  { id: 'videos', label: 'Videos', icon: '📹' },
  { id: 'shorts', label: 'Shorts', icon: '🎬' },
];

// === Page ================================================================

export default function CreatorVideosPage() {
  const { ready, walletAddress, openSignIn } = useAuth();
  const { isConnected } = useWeb3();

  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [showUploader, setShowUploader] = useState(false);
  const [showShortCreator, setShowShortCreator] = useState(false);
  const [editingVideo, setEditingVideo] = useState<CreatorVideoMeta | null>(null);
  const [analyticsVideo, setAnalyticsVideo] = useState<CreatorVideoMeta | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<CreatorVideoMeta | null>(null);

  const hasWallet = isConnected || !!walletAddress;

  const handleEdit = useCallback((video: CreatorVideoMeta) => {
    setEditingVideo(video);
  }, []);

  const handleDelete = useCallback((video: CreatorVideoMeta) => {
    setDeletingVideo(video);
  }, []);

  const handleAnalytics = useCallback((video: CreatorVideoMeta) => {
    setAnalyticsVideo(video);
  }, []);

  // Confirm-delete state is declared before the wallet gate so hooks stay at
  // the top level (Rules of Hooks).
  const [confirmDeleteUuid, setConfirmDeleteUuid] = useState<string | null>(null);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteUuid) return;
    try {
      // Can't call hooks outside component — use direct fetch instead
      const res = await fetch(`/api/creator/videos/${confirmDeleteUuid}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setDeletingVideo(null);
        setConfirmDeleteUuid(null);
        // Force re-fetch by triggering a navigation-like effect
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Delete failed');
      }
    } catch {
      alert('Delete failed');
    }
  }, [confirmDeleteUuid]);

  // == Wallet Gate ====================================================

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="space-y-4">
          <div className="skeleton h-8 w-64 rounded-lg" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton aspect-video rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
            <span className="text-3xl text-degen-400">🎬</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Creator Videos</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Connect a wallet to upload, manage, and monetize your video content on DegenFeed. Videos
            are hosted on PeerTube, cross-posted to all protocols, and monetizable via tips.
          </p>
          <div className="mt-8">
            <button type="button" onClick={openSignIn} className="btn-primary">
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  // == Dashboard ======================================================

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">
            Creator Videos
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Upload, manage, and monetize your video content. Hosted on PeerTube, distributed across
            all protocols. Labeled as &quot;DegenFeed Creator&quot; on the Video Hub.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowShortCreator(true)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <span>🎬</span>
            Record Short
          </button>
          <button
            type="button"
            onClick={() => setShowUploader(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M7 1v12M1 7h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Upload Video
          </button>
        </div>
      </div>

      {/* Quick info cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">📹</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              PeerTube Hosted
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            All videos are uploaded to our PeerTube instance at video.degenfeed.xyz and federated
            via ActivityPub.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">📤</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Cross-Protocol
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Videos are automatically announced to ActivityPub, Nostr, AT Protocol, Farcaster, and
            Lens.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Monetizable
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Each video supports tips via DegenFeed&apos;s unified tipping system. Creators can also
            link creator coins.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏷️</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              DegenFeed Creator
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            All uploads appear on the Video Hub labeled as &quot;DegenFeed Creator&quot; with your
            profile link.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="mb-6 flex border-b border-[var(--color-border)]"
        role="tablist"
        aria-label="Video tabs"
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

      {/* Video Library */}
      <VideoLibrary
        type={activeTab === 'all' ? undefined : activeTab === 'shorts' ? 'short' : 'video'}
        onUploadClick={() => setShowUploader(true)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAnalytics={handleAnalytics}
        onCreateShort={() => setShowShortCreator(true)}
      />

      {/* Modals */}
      {showUploader && (
        <VideoUploader
          mode={activeTab === 'shorts' ? 'short' : 'video'}
          onClose={() => setShowUploader(false)}
          onSuccess={() => {
            setShowUploader(false);
          }}
        />
      )}

      {showShortCreator && (
        <ShortCreator
          onClose={() => setShowShortCreator(false)}
          onSuccess={() => {
            setShowShortCreator(false);
          }}
        />
      )}

      {editingVideo && (
        <VideoEditor
          video={editingVideo}
          onClose={() => setEditingVideo(null)}
          onSaved={() => setEditingVideo(null)}
        />
      )}

      {analyticsVideo && (
        <VideoAnalytics video={analyticsVideo} onClose={() => setAnalyticsVideo(null)} />
      )}

      {/* Delete confirmation */}
      {deletingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/20">
                <span className="text-xl text-red-400">🗑️</span>
              </div>
              <h3 className="text-base font-semibold text-[var(--color-fg)]">Delete Video?</h3>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Are you sure you want to delete &ldquo;{deletingVideo.title}&rdquo;? This
                permanently removes it from PeerTube and all protocols.
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeletingVideo(null);
                  setConfirmDeleteUuid(null);
                }}
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] py-2.5 text-sm text-[var(--color-fg)] transition-colors hover:bg-[var(--color-card)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteUuid(deletingVideo.uuid);
                  handleConfirmDelete();
                }}
                className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
