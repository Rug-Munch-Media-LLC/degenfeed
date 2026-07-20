'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ErrorBoundary } from '@degenfeed/ui';
import { StreamPlayer } from '../../../components/stream/StreamPlayer';
import { StreamChat } from '../../../components/stream/StreamChat';
import { StreamInfo } from '../../../components/stream/StreamInfo';
import { StreamSchedule } from '../../../components/stream/StreamSchedule';
import { StreamVODs } from '../../../components/stream/StreamVODs';
import { StreamClips } from '../../../components/stream/StreamClips';
import { StreamMiniPlayer } from '../../../components/stream/StreamMiniPlayer';
import { generateMockStream, generateMockVODs, generateMockClips, generateMockSchedule } from '../../../components/stream/types';
import type { StreamExtended } from '../../../components/stream/types';

/* === Mock Creator Lookup ====================================== */
/* In production, this would use the route param to fetch stream data */

function useStreamData(id: string): StreamExtended {
  const [stream] = useMemo(() => generateMockStream(1), []);
  const base = stream!;
  return {
    ...base,
    id,
    title: id.includes('stream') ? base.title : `${id}'s Stream`,
    creatorHandle: id,
    creatorDisplayName: id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    creatorId: base.creatorId ?? id,
  };
}

/* === Stream Page ============================================== */

export default function StreamPage({ params }: { params: { creator: string } }) {
  const stream = useStreamData(params.creator);
  const [isTheater, setIsTheater] = useState(false);
  const [showMiniPlayer, setShowMiniPlayer] = useState(false);
  const [activeSection, setActiveSection] = useState<'about' | 'schedule' | 'vods' | 'clips'>('about');
  const [showSidebar, setShowSidebar] = useState(true);

  const vods = useMemo(() => generateMockVODs(6), []);
  const clips = useMemo(() => generateMockClips(8), []);
  const schedule = useMemo(() => generateMockSchedule(), []);

  const handleTheaterToggle = useCallback(() => {
    setIsTheater((v) => !v);
    setShowMiniPlayer(false);
  }, []);

  const handleClosePlayer = useCallback(() => {
    setShowMiniPlayer(true);
  }, []);

  const handleExpandMiniPlayer = useCallback(() => {
    setShowMiniPlayer(false);
  }, []);

  return (
    <ErrorBoundary>
      {/* == Back navigation == */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto max-w-[1800px] px-4 py-2">
          <div className="flex items-center gap-2 text-xs">
            <Link href="/live" className="text-white/40 hover:text-white/70 transition-colors">
              Live
            </Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-white/20">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="text-white/70 truncate">{stream.creatorDisplayName}</span>
          </div>
        </div>
      </div>

      {/* == Main content area == */}
      <div className="mx-auto max-w-[1800px]">
        <div className={`flex ${showSidebar ? 'flex-col lg:flex-row' : 'flex-col'}`}>
          {/* == Left: Player + Below content == */}
          <div className={`flex-1 min-w-0 ${showSidebar ? 'lg:mr-0' : ''}`}>
            {/* Player */}
            <StreamPlayer
              stream={stream}
              onClose={handleClosePlayer}
              onTheaterToggle={handleTheaterToggle}
              isTheater={isTheater}
            />

            {/* Below player content */}
            <div className="px-4 py-4 space-y-6">
              {/* Stream Info (title, creator, follow/subscribe, description) */}
              <StreamInfo stream={stream} />

              {/* Section tabs */}
              <div className="flex gap-1 border-b border-white/10" role="tablist">
                {[
                  { id: 'about' as const, label: 'About', icon: 'ℹ️' },
                  { id: 'schedule' as const, label: 'Schedule', icon: '📅' },
                  { id: 'vods' as const, label: 'VODs', icon: '📼' },
                  { id: 'clips' as const, label: 'Clips', icon: '✂️' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeSection === tab.id}
                    onClick={() => setActiveSection(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium capitalize transition-all border-b-2 ${
                      activeSection === tab.id
                        ? 'border-degen-500 text-degen-400'
                        : 'border-transparent text-white/40 hover:text-white/70'
                    }`}
                  >
                    <span aria-hidden="true" className="text-sm">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="animate-fade-in">
                {activeSection === 'about' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <h3 className="text-sm font-semibold text-white/80">About {stream.creatorDisplayName}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-white/50">
                        Welcome to the stream! We talk about crypto, DeFi, web3, and everything in between.
                        Make sure to follow and subscribe so you never miss a stream!
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/10 pt-3">
                        <div className="text-center">
                          <p className="text-xs font-bold text-white">{stream.stats.totalViews.toLocaleString()}</p>
                          <p className="text-[9px] text-white/40">Channel Views</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-white">{stream.stats.followers.toLocaleString()}</p>
                          <p className="text-[9px] text-white/40">Followers</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold text-white">{stream.stats.subscribers.toLocaleString()}</p>
                          <p className="text-[9px] text-white/40">Subscribers</p>
                        </div>
                      </div>
                    </div>

                    {/* Related channels placeholder */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <h3 className="text-sm font-semibold text-white/70">Related Channels</h3>
                      <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                        {['defi_degen', 'sol_whale', 'nft_collector', 'meme_lord'].map((handle) => (
                          <Link
                            key={handle}
                            href={`/live/${handle}`}
                            className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 transition-all hover:border-degen-500/20"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/30 to-purple-500/30 text-[8px] font-bold text-degen-400">
                              {(handle[0] ?? '?').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-white/70">@{handle}</p>
                              <p className="text-[9px] text-white/30">Live</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'schedule' && <StreamSchedule streams={schedule} />}
                {activeSection === 'vods' && <StreamVODs vods={vods} />}
                {activeSection === 'clips' && <StreamClips clips={clips} />}
              </div>
            </div>
          </div>

          {/* == Right: Chat sidebar == */}
          {showSidebar && (
            <div className="w-full lg:w-[380px] lg:min-w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10">
              <div className="h-full flex flex-col" style={{ maxHeight: 'calc(100vh - 48px)' }}>
                {/* Chat header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
                  <span className="text-xs font-semibold text-white/70">Stream Chat</span>
                  <button
                    type="button"
                    onClick={() => setShowSidebar(false)}
                    className="flex h-6 w-6 items-center justify-center rounded text-white/30 hover:text-white/60"
                    aria-label="Close chat"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                </div>
                {/* Chat messages */}
                <div className="flex-1 overflow-hidden">
                  <StreamChat streamId={stream.id} maxHeight="100%" />
                </div>
              </div>
            </div>
          )}

          {/* Sidebar toggle (when hidden) */}
          {!showSidebar && (
            <button
              type="button"
              onClick={() => setShowSidebar(true)}
              className="fixed right-4 top-20 z-40 flex items-center gap-1.5 rounded-lg bg-degen-500/20 border border-degen-500/30 px-3 py-2 text-xs font-medium text-degen-400 hover:bg-degen-500/30 transition-all"
              aria-label="Show chat"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              Show Chat
            </button>
          )}
        </div>
      </div>

      {/* == Mini Player (PiP-style) == */}
      {showMiniPlayer && (
        <StreamMiniPlayer
          title={stream.title}
          onClose={() => setShowMiniPlayer(false)}
          onExpand={handleExpandMiniPlayer}
        />
      )}
    </ErrorBoundary>
  );
}
