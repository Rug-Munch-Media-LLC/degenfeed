'use client';

import { ErrorBoundary } from '@degenfeed/ui';
import { useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useWeb3 } from '../../../components/Web3Provider';
import StudioTabBar from './StudioTabBar';
import ShortsTab from './ShortsTab';
import VideoTab from './VideoTab';
import LiveTab from './LiveTab';
import ContentTab from './ContentTab';
import type { VideoTab as VideoTabType } from './types';

export default function CreatorVideoStudioPage() {
  const { ready, walletAddress, openSignIn } = useAuth();
  const { isConnected } = useWeb3();
  const [activeTab, setActiveTab] = useState<VideoTabType>('shorts');
  const hasWallet = isConnected || !!walletAddress;

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="skeleton mb-6 h-12 w-80 rounded-xl" />
        <div className="skeleton mb-6 h-10 w-full rounded-2xl" />
        <div className="skeleton h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!hasWallet) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-overlay)]">
          <span className="text-3xl text-degen-400">🎬</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Creator Video Studio</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted)]">
          Connect your wallet to create shorts, upload videos, and go live across all platforms.
        </p>
        <div className="mt-8">
          <button type="button" onClick={openSignIn} className="btn-primary text-sm">Connect Wallet</button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">
              <span className="text-degen-400">◆</span> Creator Video Studio
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Create, upload, and stream video content across all platforms
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/creator/videos"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)] hover:border-degen-500/30">
              <span>📁</span><span className="hidden sm:inline">Legacy Videos</span>
            </a>
            <a href="/creator/content"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)] hover:border-degen-500/30">
              <span>📝</span><span className="hidden sm:inline">Content Studio</span>
            </a>
          </div>
        </div>
        <StudioTabBar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="min-h-[400px]">
          {activeTab === 'shorts' && <ShortsTab />}
          {activeTab === 'videos' && <VideoTab />}
          {activeTab === 'live-short' && <LiveTab format="portrait" />}
          {activeTab === 'live-full' && <LiveTab format="landscape" />}
          {activeTab === 'my-content' && <ContentTab />}
        </div>
      </div>
    </ErrorBoundary>
  );
}
