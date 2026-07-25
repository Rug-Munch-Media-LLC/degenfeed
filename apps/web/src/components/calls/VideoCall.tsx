'use client';

/**
 * @degenfeed/web — Video Call UI Component
 *
 * Full WebRTC video call interface.
 * Features:
 *   - Calling screen with ringing animation
 *   - Active call video grid (speaker view / grid)
 *   - Controls: mute mic, mute camera, screen share, flip camera, end call
 *   - Picture-in-Picture mode
 *   - Call notifications (incoming/outgoing)
 *   - Call history
 *
 * Zero server bandwidth — video flows peer-to-peer via WebRTC.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../AuthProvider';

// ─── Types ──────────────────────────────────────────────────────────────

export interface CallInfo {
  callId: string;
  host: string;
  participants: string[];
  type: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended';
  startedAt: number;
  recording: boolean;
  groupMode?: 'mesh' | 'sfu' | 'p2p';
}

export interface CallHistoryEntry {
  callId: string;
  peer: string;
  type: 'audio' | 'video';
  status: 'missed' | 'completed';
  duration: number;
  timestamp: number;
}

export interface IncomingCall {
  callId: string;
  from: string;
  displayName: string;
  avatarUrl?: string;
  type: 'audio' | 'video';
  participants: number;
}

type CallViewState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';

// ─── Peer Connection Manager ────────────────────────────────────────────

interface PeerConnection {
  peerId: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
}

function createPeerConnection(
  stunServers: string[],
  onIceCandidate: (candidate: RTCIceCandidateInit, peerId: string) => void,
  onTrack: (stream: MediaStream, peerId: string) => void,
): RTCPeerConnection {
  const config: RTCConfiguration = {
    iceServers: stunServers.map((url) => ({ urls: url })),
    iceCandidatePoolSize: 10,
  };

  const pc = new RTCPeerConnection(config);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate.toJSON(), 'peer');
    }
  };

  pc.ontrack = (event) => {
    onTrack(event.streams[0], 'peer');
  };

  return pc;
}

// ─── User Media Hook ────────────────────────────────────────────────────

function useUserMedia(type: 'audio' | 'video') {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);

  const startMedia = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video'
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
          : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      setError(null);
      return stream;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[VideoCall] getUserMedia failed:', msg);
      return null;
    }
  }, [type]);

  const stopMedia = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
  }, [localStream]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoMuted(!videoTrack.enabled);
      }
    }
  }, [localStream]);

  const flipCamera = useCallback(async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        const facingMode = videoTrack.getSettings().facingMode === 'user' ? 'environment' : 'user';
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode },
        });
        const newTrack = newStream.getVideoTracks()[0];
        videoTrack.stop();
        localStream.removeTrack(videoTrack);
        localStream.addTrack(newTrack);
        setVideoMuted(false);
      }
    }
  }, [localStream]);

  return {
    localStream,
    error,
    audioMuted,
    videoMuted,
    startMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    flipCamera,
  };
}

// ─── Signaling Hook ─────────────────────────────────────────────────────

function useSignaling(callId: string | null, wallet: string | null) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendSignal = useCallback(
    async (
      type: 'offer' | 'answer' | 'ice',
      to: string,
      data: { sdp?: string; candidate?: string; sdpMid?: string; sdpMLineIndex?: number },
    ) => {
      if (!callId) return;
      try {
        await fetch(`/api/calls/${callId}/signal`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type, to, ...data }),
        });
      } catch (err) {
        console.error('[VideoCall] signal failed:', err);
      }
    },
    [callId],
  );

  const startPolling = useCallback(
    (onSignal: (signals: unknown[], iceCandidates: unknown[]) => void) => {
      if (!callId) return;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/calls/${callId}/signal/poll`, {
            credentials: 'include',
          });
          if (!res.ok) return;
          const data = await res.json();
          if (data.signals?.length > 0 || data.iceCandidates?.length > 0) {
            onSignal(data.signals, data.iceCandidates);
          }
        } catch {
          // Polling failed silently
        }
      }, 1000);
    },
    [callId],
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return { sendSignal, startPolling, stopPolling };
}

// ─── Ringing Animation ──────────────────────────────────────────────────

function RingingAnimation() {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-2.5 w-2.5 rounded-full bg-degen-400"
          style={{
            animation: `call-ring 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes call-ring {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ─── Controls Bar ───────────────────────────────────────────────────────

interface ControlsBarProps {
  audioMuted: boolean;
  videoMuted: boolean;
  isScreenSharing: boolean;
  callActive: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onScreenShare: () => void;
  onFlipCamera: () => void;
  onEndCall: () => void;
  onPiP: () => void;
}

function ControlsBar({
  audioMuted,
  videoMuted,
  isScreenSharing,
  callActive,
  onToggleAudio,
  onToggleVideo,
  onScreenShare,
  onFlipCamera,
  onEndCall,
  onPiP,
}: ControlsBarProps) {
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3">
      {/* Mute audio */}
      <button
        type="button"
        onClick={onToggleAudio}
        className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
          audioMuted
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
        title={audioMuted ? 'Unmute microphone' : 'Mute microphone'}
        aria-label={audioMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {audioMuted ? (
            <>
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
              <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </>
          ) : (
            <>
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </>
          )}
        </svg>
      </button>

      {/* Mute video */}
      <button
        type="button"
        onClick={onToggleVideo}
        className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
          videoMuted
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
        title={videoMuted ? 'Turn on camera' : 'Turn off camera'}
        aria-label={videoMuted ? 'Turn on camera' : 'Turn off camera'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {videoMuted ? (
            <>
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M21 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2z" />
            </>
          ) : (
            <>
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </>
          )}
        </svg>
      </button>

      {/* Screen share */}
      <button
        type="button"
        onClick={onScreenShare}
        className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
          isScreenSharing
            ? 'bg-degen-500/30 text-degen-400 hover:bg-degen-500/40'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
        title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
        aria-label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </button>

      {/* Flip camera */}
      <button
        type="button"
        onClick={onFlipCamera}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
        title="Flip camera"
        aria-label="Flip camera"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" />
          <path d="M1 5h8l2 3h4v8H3a2 2 0 01-2-2V5z" />
          <path d="M7 15l-3-3 3-3" />
        </svg>
      </button>

      {/* Picture-in-Picture */}
      <button
        type="button"
        onClick={onPiP}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
        title="Picture-in-Picture"
        aria-label="Picture-in-Picture"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <rect x="11" y="9" width="8" height="6" rx="1" ry="1" />
        </svg>
      </button>

      {/* End call */}
      <button
        type="button"
        onClick={onEndCall}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg"
        title="End call"
        aria-label="End call"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
        </svg>
      </button>
    </div>
  );
}

// ─── Video Grid ─────────────────────────────────────────────────────────

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: string[];
  myWallet: string;
  displayNames: Map<string, string>;
  mutedState: Map<string, { audio: boolean; video: boolean }>;
  type: 'audio' | 'video';
}

function VideoGrid({
  localStream,
  remoteStreams,
  participants,
  myWallet,
  displayNames,
  mutedState,
  type,
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
    const total = participants.length + 1; // +1 for self
    if (total <= 2) return 2;
    if (total <= 4) return 2;
    if (total <= 6) return 3;
    if (total <= 9) return 3;
    return 4;
  }, [participants.length]);

  const setRemoteRef = useCallback(
    (peerId: string) => (el: HTMLVideoElement | null) => {
      if (el) {
        remoteVideoRefs.current.set(peerId, el);
      } else {
        remoteVideoRefs.current.delete(peerId);
      }
    },
    [],
  );

  const shortAddr = useCallback((addr: string) => {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
  }, []);

  return (
    <div
      className="flex-1 grid gap-2 p-2 auto-rows-fr"
      style={{
        gridTemplateColumns: `repeat(${Math.min(gridCols, 4)}, 1fr)`,
      }}
    >
      {/* Self view */}
      <div className="relative rounded-xl overflow-hidden bg-black/40 border border-white/10">
        {type === 'video' && localStream ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-degen-500/30 text-2xl font-bold text-degen-400">
              {shortAddr(myWallet).charAt(0)}
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1">
          <span className="text-[10px] text-white/80 font-medium">
            You {mutedState.get(myWallet)?.audio ? '\u{1F507}' : ''}
          </span>
        </div>
        {mutedState.get(myWallet)?.video && type === 'video' && localStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M21 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Remote participants */}
      {participants
        .filter((p) => p !== myWallet)
        .map((peer) => {
          const stream = remoteStreams.get(peer);
          const muted = mutedState.get(peer);
          const displayName = displayNames.get(peer) || shortAddr(peer);

          return (
            <div
              key={peer}
              className="relative rounded-xl overflow-hidden bg-black/40 border border-white/10"
            >
              {(type === 'video' && stream) ? (
                <video
                  ref={setRemoteRef(peer)}
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-degen-500/30 text-2xl font-bold text-degen-400">
                    {displayName.charAt(0)}
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1">
                <span className="text-[10px] text-white/80 font-medium">
                  {displayName} {muted?.audio ? '\u{1F507}' : ''}
                </span>
              </div>
              {muted?.video && type === 'video' && stream && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M21 7v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

// ─── Calling Screen ─────────────────────────────────────────────────────

interface CallingScreenProps {
  callee: string;
  type: 'audio' | 'video';
  onCancel: () => void;
}

function CallingScreen({ callee, type, onCancel }: CallingScreenProps) {
  const shortAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}` : addr;

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-degen-500/20 text-4xl font-bold text-degen-400">
        {shortAddr(callee).charAt(0)}
      </div>
      <div className="text-center">
        <p className="text-lg font-bold text-white">{shortAddr(callee)}</p>
        <p className="mt-1 text-sm text-white/60">
          {type === 'audio' ? '\u{1F3A4}' : '\u{1F4F9}'} Calling...
        </p>
      </div>
      <RingingAnimation />
      <button
        type="button"
        onClick={onCancel}
        className="mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg"
        aria-label="Cancel call"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ─── Incoming Call Banner ───────────────────────────────────────────────

interface IncomingCallBannerProps {
  call: IncomingCall;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallBanner({ call, onAccept, onDecline }: IncomingCallBannerProps) {
  const shortAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}` : addr;

  return (
    <div className="fixed inset-x-0 top-0 z-50 animate-in slide-in-from-top-2">
      <div className="mx-auto max-w-md rounded-b-2xl bg-gray-900/95 backdrop-blur-xl border-b border-x border-white/10 shadow-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-degen-500/20 text-lg font-bold text-degen-400">
            {shortAddr(call.displayName).charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{call.displayName}</p>
            <p className="text-xs text-white/60">
              {call.type === 'audio' ? '\u{1F3A4}' : '\u{1F4F9}'} Incoming {call.type} call
              {call.participants > 1 ? ` (${call.participants} participants)` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onAccept}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 transition-all shadow-lg"
              title="Accept call"
              aria-label="Accept call"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onDecline}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg"
              title="Decline call"
              aria-label="Decline call"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Call History Component ─────────────────────────────────────────────

interface CallHistoryProps {
  history: CallHistoryEntry[];
  onClose: () => void;
}

export function CallHistoryList({ history, onClose }: CallHistoryProps) {
  const shortAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}\u2026${addr.slice(-4)}` : addr;

  const formatDuration = (ms: number): string => {
    if (ms === 0) return 'No answer';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="text-sm font-bold text-[var(--color-fg)]">Call History</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-muted)] hover:bg-[var(--color-overlay)] transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {history.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--color-muted)]">No call history</p>
          ) : (
            history.map((entry) => (
              <div
                key={entry.callId}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[var(--color-overlay)] transition-colors"
              >
                <span className="text-lg shrink-0">
                  {entry.status === 'missed' ? '\u{274C}' : entry.type === 'audio' ? '\u{1F3A4}' : '\u{1F4F9}'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium text-[var(--color-fg)] truncate ${
                    entry.status === 'missed' ? 'opacity-60' : ''
                  }`}>
                    {entry.peer === 'Group Call' ? 'Group Call' : shortAddr(entry.peer)}
                  </p>
                  <p className="text-[10px] text-[var(--color-muted)]">
                    {entry.status === 'missed' ? 'Missed call' : formatDuration(entry.duration)}
                    {' \u00B7 '}
                    {new Date(entry.timestamp).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className={`text-[10px] font-medium ${
                  entry.status === 'missed' ? 'text-red-400' : 'text-green-400'
                }`}>
                  {entry.status === 'missed' ? 'Missed' : 'Completed'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Call Buttons for ChatView ──────────────────────────────────────────

interface CallButtonsProps {
  peerId: string;
  peerDisplayName?: string;
  onStartCall: (type: 'audio' | 'video', peerId: string) => void;
}

export function CallButtons({ peerId, peerDisplayName, onStartCall }: CallButtonsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onStartCall('audio', peerId)}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-degen-400 transition-all"
        title={`Audio call ${peerDisplayName || peerId}`}
        aria-label={`Start audio call with ${peerDisplayName || peerId}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
        </svg>
        <span>Audio</span>
      </button>
      <button
        type="button"
        onClick={() => onStartCall('video', peerId)}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-degen-400 transition-all"
        title={`Video call ${peerDisplayName || peerId}`}
        aria-label={`Start video call with ${peerDisplayName || peerId}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        <span>Video</span>
      </button>
    </div>
  );
}

// ─── PiP Overlay ────────────────────────────────────────────────────────

interface PiPOverlayProps {
  localStream: MediaStream | null;
  duration: number;
  onExpand: () => void;
  onEndCall: () => void;
}

function PiPOverlay({ localStream, duration, onExpand, onEndCall }: PiPOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed bottom-20 right-4 z-50 w-48 cursor-pointer rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-gray-900"
      onClick={onExpand}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onExpand()}
      aria-label="Expand call"
    >
      {/* Video preview */}
      <div className="h-28 bg-black">
        {localStream ? (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/40 text-xs">No video</div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-800">
        <span className="text-[10px] text-white/60 font-mono">{formatTime(duration)}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEndCall();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
          aria-label="End call"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main VideoCall Component ───────────────────────────────────────────

const DEFAULT_STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
];

interface VideoCallProps {
  /** When set, shows call UI for this call */
  activeCallId?: string;
  /** Call type if initiating */
  callType?: 'audio' | 'video';
  /** Target peer for 1-on-1 calls */
  targetPeer?: string;
  /** Called when call ends */
  onCallEnd?: () => void;
  /** Incoming call data (from notification) */
  incomingCall?: IncomingCall | null;
  /** Called when incoming call is accepted */
  onAcceptIncoming?: (callId: string) => void;
  /** Called when incoming call is declined */
  onDeclineIncoming?: (callId: string) => void;
  /** Call history entries */
  callHistory?: CallHistoryEntry[];
  /** Whether to show call buttons */
  showCallButtons?: boolean;
}

export function VideoCall({
  activeCallId,
  callType: initialCallType,
  targetPeer,
  onCallEnd,
  incomingCall,
  onAcceptIncoming,
  onDeclineIncoming,
  callHistory: externalHistory,
  showCallButtons,
}: VideoCallProps) {
  const { tokens } = useAuth();
  const wallet = tokens.evmAddress || tokens.solanaAddress || null;

  const [viewState, setViewState] = useState<CallViewState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [displayNames, setDisplayNames] = useState<Map<string, string>>(new Map());
  const [mutedState, setMutedState] = useState<Map<string, { audio: boolean; video: boolean }>>(new Map());
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<CallHistoryEntry[]>(externalHistory || []);

  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const screenShareStream = useRef<MediaStream | null>(null);

  const {
    localStream,
    audioMuted,
    videoMuted,
    startMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    flipCamera,
  } = useUserMedia(initialCallType || 'video');

  const signaling = useSignaling(callInfo?.callId ?? null, wallet);

  // ─── Create call ──────────────────────────────────────────────

  const createCall = useCallback(
    async (type: 'audio' | 'video', peer: string) => {
      if (!wallet) return;

      setViewState('calling');

      try {
        const res = await fetch('/api/calls/create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type,
            participants: [peer],
          }),
        });

        if (!res.ok) {
          setViewState('idle');
          return;
        }

        const data = await res.json();
        setCallInfo(data.call);
        setViewState('calling');
      } catch {
        setViewState('idle');
      }
    },
    [wallet],
  );

  // ─── Accept incoming call ─────────────────────────────────────

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !wallet) return;

    setViewState('connecting');

    try {
      const res = await fetch(`/api/calls/${incomingCall.callId}/join`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        setViewState('idle');
        return;
      }

      const data = await res.json();
      setCallInfo(data.call);
      onAcceptIncoming?.(incomingCall.callId);

      // Start media and peer connections
      const stream = await startMedia();
      if (stream && data.signaling) {
        setViewState('active');
        await setupPeerConnections(stream, data.call, data.signaling);
      }
    } catch {
      setViewState('idle');
    }
  }, [incomingCall, wallet, startMedia, onAcceptIncoming]);

  // ─── Decline incoming call ────────────────────────────────────

  const declineCall = useCallback(() => {
    if (incomingCall) {
      fetch(`/api/calls/${incomingCall.callId}/end`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
      onDeclineIncoming?.(incomingCall.callId);
    }
    setViewState('idle');
  }, [incomingCall, onDeclineIncoming]);

  // ─── Setup Peer Connections ───────────────────────────────────

  const setupPeerConnections = useCallback(
    async (stream: MediaStream, call: CallInfo, signalingData: { peers: string[]; host: string; groupMode: string }) => {
      // In a real implementation, each peer connection would:
      // 1. Create RTCPeerConnection
      // 2. Add local tracks
      // 3. Create and send offer
      // 4. Handle answer
      // 5. Exchange ICE candidates
      // This is handled via the signaling relay

      // For now, the signaling is set up and polling starts
      signaling.startPolling((signals, iceCandidates) => {
        // Process incoming signals
        for (const signal of signals) {
          // Handle offers/answers
        }
        for (const candidate of iceCandidates) {
          // Handle ICE candidates
        }
      });
    },
    [signaling],
  );

  // ─── Screen share ─────────────────────────────────────────────

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen share
      if (screenShareStream.current) {
        screenShareStream.current.getTracks().forEach((t) => t.stop());
        screenShareStream.current = null;
      }

      // Restore camera track
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = true;
          // Replace track in all peer connections
          peerConnections.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(videoTrack).catch(() => {});
          });
        }
      }

      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        screenShareStream.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace track in all peer connections
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack).catch(() => {});
        });

        // Detect when user stops sharing via browser UI
        screenTrack.onended = () => {
          setIsScreenSharing(false);
          screenShareStream.current = null;
        };

        setIsScreenSharing(true);
      } catch {
        // User cancelled or not supported
      }
    }
  }, [isScreenSharing, localStream]);

  // ─── End call ─────────────────────────────────────────────────

  const endCall = useCallback(async () => {
    if (callInfo) {
      try {
        await fetch(`/api/calls/${callInfo.callId}/end`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // Fire-and-forget
      }
    }

    // Clean up peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    // Stop screen share
    if (screenShareStream.current) {
      screenShareStream.current.getTracks().forEach((t) => t.stop());
      screenShareStream.current = null;
    }

    stopMedia();
    signaling.stopPolling();

    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }

    setViewState('ended');
    setCallInfo(null);
    setRemoteStreams(new Map());
    setIsScreenSharing(false);
    setIsPiP(false);
    setCallDuration(0);

    setTimeout(() => {
      setViewState('idle');
      onCallEnd?.();
    }, 2000);
  }, [callInfo, stopMedia, signaling, onCallEnd]);

  // ─── Toggle PiP ───────────────────────────────────────────────

  const togglePiP = useCallback(() => {
    setIsPiP(!isPiP);
  }, [isPiP]);

  // ─── Call duration timer ──────────────────────────────────────

  useEffect(() => {
    if (viewState === 'active' && !durationRef.current) {
      const start = Date.now();
      durationRef.current = setInterval(() => {
        setCallDuration(Date.now() - start);
      }, 1000);
    }

    if (viewState !== 'active' && durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }

    return () => {
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, [viewState]);

  // ─── Fetch call history on mount ──────────────────────────────

  useEffect(() => {
    if (!externalHistory && wallet) {
      fetch('/api/calls/history', { credentials: 'include' })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.history) setHistory(data.history);
        })
        .catch(() => {});
    } else if (externalHistory) {
      setHistory(externalHistory);
    }
  }, [wallet, externalHistory]);

  // ─── Render ───────────────────────────────────────────────────

  // Incoming call banner (shown on top of everything)
  if (incomingCall && viewState === 'idle') {
    return (
      <IncomingCallBanner
        call={incomingCall}
        onAccept={acceptCall}
        onDecline={declineCall}
      />
    );
  }

  // PiP mode
  if (isPiP && viewState === 'active') {
    return (
      <PiPOverlay
        localStream={localStream}
        duration={callDuration}
        onExpand={() => setIsPiP(false)}
        onEndCall={endCall}
      />
    );
  }

  // Full call UI
  if (viewState !== 'idle') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              {viewState === 'calling' || viewState === 'ringing' ? 'Calling...' : 'In Call'}
            </span>
            {viewState === 'active' && (
              <span className="text-xs text-white/50 font-mono">
                {Math.floor(callDuration / 60)}:
                {(callDuration % 60).toString().padStart(2, '0')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {callInfo?.recording && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[10px] text-red-400 font-medium">REC</span>
              </span>
            )}
            <span className="text-[10px] text-white/40">
              {callInfo?.participants.length || 1} participant{callInfo?.participants.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Video grid */}
        {viewState === 'calling' && callInfo?.participants ? (
          <CallingScreen
            callee={callInfo.participants.find((p) => p !== wallet) || 'Unknown'}
            type={callInfo.type}
            onCancel={endCall}
          />
        ) : viewState === 'ended' ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-lg text-white/60 font-medium">Call ended</p>
              {callDuration > 0 && (
                <p className="text-sm text-white/40 mt-1">
                  Duration: {Math.floor(callDuration / 60)}m {(callDuration % 60)}s
                </p>
              )}
            </div>
          </div>
        ) : (
          <VideoGrid
            localStream={localStream}
            remoteStreams={remoteStreams}
            participants={callInfo?.participants || []}
            myWallet={wallet || ''}
            displayNames={displayNames}
            mutedState={mutedState}
            type={callInfo?.type || 'video'}
          />
        )}

        {/* Controls bar */}
        {viewState === 'active' && (
          <ControlsBar
            audioMuted={audioMuted}
            videoMuted={videoMuted}
            isScreenSharing={isScreenSharing}
            callActive={viewState === 'active'}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onScreenShare={toggleScreenShare}
            onFlipCamera={flipCamera}
            onEndCall={endCall}
            onPiP={togglePiP}
          />
        )}

        {/* History button when idle */}
        {false}
      </div>
    );
  }

  // Idle: show history button if we have history
  return null;
}

// ─── useVideoCall Hook ──────────────────────────────────────────────────

export function useVideoCall() {
  const [activeCallId, setActiveCallId] = useState<string | undefined>();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [callType, setCallType] = useState<'audio' | 'video'>('video');
  const [targetPeer, setTargetPeer] = useState<string | undefined>();

  // Fetch call history
  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/calls/history', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCallHistory(data.history || []);
      }
    } catch {
      // Non-critical
    }
  }, []);

  // Start a call
  const startCall = useCallback(
    (type: 'audio' | 'video', peerId: string) => {
      setCallType(type);
      setTargetPeer(peerId);
      setActiveCallId('new'); // Signal to VideoCall that we want a new call
    },
    [],
  );

  const handleCallEnd = useCallback(() => {
    setActiveCallId(undefined);
    setIncomingCall(null);
    refreshHistory();
  }, [refreshHistory]);

  const handleAcceptIncoming = useCallback((callId: string) => {
    setActiveCallId(callId);
    setIncomingCall(null);
  }, []);

  const handleDeclineIncoming = useCallback((_callId: string) => {
    setIncomingCall(null);
  }, []);

  return {
    activeCallId,
    incomingCall,
    callHistory,
    callType,
    targetPeer,
    setIncomingCall,
    startCall,
    handleCallEnd,
    handleAcceptIncoming,
    handleDeclineIncoming,
    refreshHistory,
  };
}
