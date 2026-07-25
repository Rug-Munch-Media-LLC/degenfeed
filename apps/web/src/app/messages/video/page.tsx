'use client';

/**
 * Video Rooms — Zoom/Discord-style video chat
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { retryFetchJson } from '../../../lib/retryFetch';
import { CreateVideoRoomModal } from './_components/CreateVideoRoomModal';
import { VideoRoomView } from './_components/VideoRoomView';
import { timeAgo } from './helpers';
import type { VideoRoomSummary } from './types';

export default function VideoPage() {
  const { ready, signedInProtocols } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);

  const [rooms, setRooms] = useState<VideoRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    if (!hasSignedIn) return;
    setLoading(true);
    try {
      const data = await retryFetchJson<{ rooms: VideoRoomSummary[] }>(
        '/api/voice/active?type=video',
        { maxRetries: 2 },
      );
      setRooms(data.rooms ?? []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [hasSignedIn]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    if (!selectedRoomId) {
      const interval = setInterval(fetchRooms, 15000);
      return () => clearInterval(interval);
    }
  }, [fetchRooms, selectedRoomId]);

  if (!hasSignedIn) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col items-center justify-center p-6 lg:h-[calc(100dvh-4rem)]">
        <span
          className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-3xl bg-[var(--color-overlay)] text-[var(--color-muted)]"
          aria-hidden="true"
        >
          📹
        </span>
        <p className="text-base font-semibold text-[var(--color-fg)]">Sign in to use Video Rooms</p>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">
          Real-time video chat with your community.
        </p>
      </div>
    );
  }

  if (selectedRoomId) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
        <VideoRoomView roomId={selectedRoomId} onLeave={() => setSelectedRoomId(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-glass-bg)] px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">
            📹
          </span>
          <div>
            <h1 className="text-base font-bold text-[var(--color-fg)] leading-tight">
              Video Rooms
            </h1>
            <p className="text-[10px] text-[var(--color-muted)]">
              {rooms.length} active room{rooms.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl bg-degen-500 px-3 py-2 text-xs font-bold text-black hover:bg-degen-400 transition-all"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Start Video
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading && rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <span className="mb-4 text-4xl opacity-30" aria-hidden="true">
              📹
            </span>
            <p className="text-sm font-medium text-[var(--color-fg)]">No active video rooms</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Start a video room and invite others to join.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 rounded-xl bg-degen-500 px-4 py-2 text-xs font-bold text-black hover:bg-degen-400 transition-all"
            >
              Start Your First Video
            </button>
          </div>
        )}

        {rooms.map((room) => (
          <button
            key={room.id}
            type="button"
            onClick={() => {
              retryFetchJson(`/api/voice/${room.id}/join`, {
                fetchOptions: {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  credentials: 'include',
                },
              })
                .then(() => setSelectedRoomId(room.id))
                .catch(() => {});
            }}
            className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-4 py-3.5 text-left hover:bg-[var(--color-overlay)] transition-colors"
          >
            <div className="relative shrink-0">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${room.participantCount > 0 ? 'bg-degen-500/15' : 'bg-[var(--color-overlay)]'}`}
              >
                📹
              </span>
              {room.participantCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-degen-500 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-degen-500" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-fg)] truncate">{room.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-[var(--color-muted)]">
                  {room.participantCount} participant{room.participantCount !== 1 ? 's' : ''}
                </span>
                <span className="text-[var(--color-muted)]">·</span>
                <span className="text-[10px] text-[var(--color-muted)]">
                  {timeAgo(room.lastActivity)}
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <span className="rounded-lg bg-degen-500/10 px-2 py-1 text-[10px] font-medium text-degen-400">
                Join
              </span>
            </div>
          </button>
        ))}
      </div>

      <CreateVideoRoomModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => setSelectedRoomId(id)}
      />
    </div>
  );
}
