'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: string[];
  myWallet: string;
  displayNames: Map<string, string>;
  mutedState: Map<string, { audio: boolean; video: boolean }>;
  type: 'audio' | 'video';
}

/* ─── Video Grid ───────────────────────────────────────────────────── */

export function VideoGrid({
  localStream, remoteStreams, participants, myWallet,
  displayNames, mutedState, type,
}: VideoGridProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    remoteStreams.forEach((stream, peerId) => {
      const videoEl = remoteVideoRefs.current.get(peerId);
      if (videoEl && videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  const gridCols = useMemo(() => {
    const total = participants.length + 1;
    if (total <= 2) return 2;
    if (total <= 4) return 2;
    if (total <= 6) return 3;
    if (total <= 9) return 3;
    return 4;
  }, [participants.length]);

  const setRemoteRef = useCallback((peerId: string) => (el: HTMLVideoElement | null) => {
    if (el) remoteVideoRefs.current.set(peerId, el);
    else remoteVideoRefs.current.delete(peerId);
  }, []);

  const shortAddr = useCallback((addr: string) => {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
  }, []);

  return (
    <div
      className="flex-1 overflow-y-auto p-2"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: '0.5rem' }}
    >
      {/* Local video */}
      <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-900">
        {type === 'video' ? (
          <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-degen-500/20 text-lg font-bold text-degen-400">
              {shortAddr(myWallet).charAt(0)}
            </div>
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white">
          You {mutedState.get(myWallet)?.audio ? '\u{1F507}' : ''}
        </div>
      </div>

      {/* Remote participants */}
      {participants
        .filter((p) => p !== myWallet)
        .map((peerId) => {
          const stream = remoteStreams.get(peerId);
          const muted = mutedState.get(peerId);
          return (
            <div key={peerId} className="relative aspect-video overflow-hidden rounded-xl bg-gray-900">
              {stream ? (
                <video ref={setRemoteRef(peerId)} autoPlay playsInline className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white">
                    {shortAddr(displayNames.get(peerId) || peerId).charAt(0)}
                  </div>
                </div>
              )}
              <div className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white">
                {shortAddr(displayNames.get(peerId) || peerId)}
                {muted?.audio ? ' \u{1F507}' : ''}
                {muted?.video ? ' \u{1F4F7}' : ''}
              </div>
            </div>
          );
        })}
    </div>
  );
}
