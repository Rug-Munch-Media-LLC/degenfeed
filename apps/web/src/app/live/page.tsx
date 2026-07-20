'use client';

import { ErrorBoundary } from '@degenfeed/ui';
import { useCallback, useState } from 'react';
import { FeaturedStreams } from '../../components/streams/FeaturedStreams';
import { GoLiveModal } from '../../components/streams/GoLiveModal';
import { LiveHeader } from '../../components/streams/LiveHeader';
import { LiveStreamGrid } from '../../components/streams/LiveStreamGrid';
import { LiveTabs } from '../../components/streams/LiveTabs';
import { SpacesHub } from '../../components/streams/SpacesHub';
import { UpcomingStreams } from '../../components/streams/UpcomingStreams';
import {
  type LiveStream,
  type StreamType,
  useLiveStreams,
} from '../../components/streams/useLiveStreams';

/* ─── Count streams by type ──────────────────────────────────── */

function countByType(streams: LiveStream[]): Partial<Record<StreamType | 'all', number>> {
  const counts: Partial<Record<StreamType | 'all', number>> = { all: streams.length };
  for (const s of streams) {
    counts[s.streamType] = (counts[s.streamType] ?? 0) + 1;
  }
  return counts;
}

/* ─── Main Page ──────────────────────────────────────────────── */

export default function LivePage() {
  const { streams, featured, total, isLoading, isValidating } = useLiveStreams();
  const [activeTab, setActiveTab] = useState<StreamType | 'all'>('all');
  const [goLiveOpen, setGoLiveOpen] = useState(false);

  const filtered =
    activeTab === 'all' ? streams : streams.filter((s) => s.streamType === activeTab);
  const spaces = streams.filter((s) => s.streamType === 'spaces');
  const counts = countByType(streams);

  const handleGoLive = useCallback(() => {
    setGoLiveOpen(true);
  }, []);

  const handleStartStream = useCallback((_data: { title: string; streamType: StreamType }) => {
    // In a real app, this would call the API to start a stream
    // For now, just close the modal
  }, []);

  const handlePlay = useCallback((stream: LiveStream) => {
    // Navigate to stream detail page
    window.location.href = `/live/${stream.id}`;
  }, []);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 py-6 animate-page-enter">
        {/* Header with "Go Live" button */}
        <LiveHeader liveCount={total} onGoLive={handleGoLive} />

        {/* Syncing indicator */}
        {isValidating && !isLoading && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-degen-500/10 px-3 py-1.5 text-[11px] text-degen-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-degen-500" />
            Syncing live streams...
          </div>
        )}

        {/* Tabs: All / Coin Launches / Spaces / Solo / Collab */}
        <LiveTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

        <div className="space-y-8">
          {/* Featured streams carousel (only on "All" tab) */}
          {activeTab === 'all' && (
            <FeaturedStreams streams={featured} isLoading={isLoading} onPlay={handlePlay} />
          )}

          {/* Active audio spaces (only on "All" tab) */}
          {activeTab === 'all' && <SpacesHub spaces={spaces} isLoading={isLoading} />}

          {/* Stream grid */}
          <LiveStreamGrid
            streams={filtered}
            isLoading={isLoading}
            onPlay={handlePlay}
            emptyMessage={
              activeTab === 'all'
                ? 'No active streams right now.'
                : `No ${activeTab} streams active right now.`
            }
          />

          {/* Upcoming streams (only on "All" tab) */}
          {activeTab === 'all' && <UpcomingStreams isLoading={isLoading} />}
        </div>

        {/* Go Live Modal */}
        <GoLiveModal
          isOpen={goLiveOpen}
          onClose={() => setGoLiveOpen(false)}
          onStart={handleStartStream}
        />
      </div>
    </ErrorBoundary>
  );
}
