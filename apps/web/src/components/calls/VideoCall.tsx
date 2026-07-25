'use client';

/**
 * @degenfeed/web — Video Call UI Component
 *
 * Full WebRTC video call interface. Orchestrator component that
 * delegates UI to sub-components and hooks.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../AuthProvider';
import type { CallInfo, CallHistoryEntry, CallViewState, IncomingCall } from './types';
import { ControlsBar, CallingScreen, PiPOverlay } from './Controls';
import { VideoGrid } from './Participants';
import IncomingCallBanner, { CallHistoryList, CallButtons } from './IncomingCall';

// ─── Re-exported types ──────────────────────────────────────────────

export type { CallInfo, CallHistoryEntry, IncomingCall, CallViewState } from './types';

// ─── Peer Connection Manager ────────────────────────────────────────

function _createPeerConnection(
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
    if (event.candidate) onIceCandidate(event.candidate.toJSON(), 'peer');
  };
  pc.ontrack = (event) => {
    onTrack(event.streams[0], 'peer');
  };
  return pc;
}

// ─── User Media Hook ────────────────────────────────────────────────

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
      if (audioTrack) { audioTrack.enabled = !audioTrack.enabled; setAudioMuted(!audioTrack.enabled); }
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) { videoTrack.enabled = !videoTrack.enabled; setVideoMuted(!videoTrack.enabled); }
    }
  }, [localStream]);

  const flipCamera = useCallback(async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        const facingMode = videoTrack.getSettings().facingMode === 'user' ? 'environment' : 'user';
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode } });
        const newTrack = newStream.getVideoTracks()[0];
        videoTrack.stop();
        localStream.removeTrack(videoTrack);
        localStream.addTrack(newTrack);
        setVideoMuted(false);
      }
    }
  }, [localStream]);

  return { localStream, error, audioMuted, videoMuted, startMedia, stopMedia, toggleAudio, toggleVideo, flipCamera };
}

// ─── Signaling Hook ─────────────────────────────────────────────────

function useSignaling(callId: string | null, _wallet: string | null) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendSignal = useCallback(async (
    type: 'offer' | 'answer' | 'ice',
    to: string,
    data: { sdp?: string; candidate?: string; sdpMid?: string; sdpMLineIndex?: number },
  ) => {
    if (!callId) return;
    try {
      await fetch(`/api/calls/${callId}/signal`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ type, to, ...data }),
      });
    } catch (err) { console.error('[VideoCall] signal failed:', err); }
  }, [callId]);

  const startPolling = useCallback((onSignal: (signals: unknown[], iceCandidates: unknown[]) => void) => {
    if (!callId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/calls/${callId}/signal/poll`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.signals?.length > 0 || data.iceCandidates?.length > 0) {
          onSignal(data.signals, data.iceCandidates);
        }
      } catch { /* Polling failed silently */ }
    }, 1000);
  }, [callId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { sendSignal, startPolling, stopPolling };
}



// ─── Main VideoCall Props ────────────────────────────────────────────

interface VideoCallProps {
  activeCallId?: string;
  callType?: 'audio' | 'video';
  targetPeer?: string;
  onCallEnd?: () => void;
  incomingCall?: IncomingCall | null;
  onAcceptIncoming?: (callId: string) => void;
  onDeclineIncoming?: (callId: string) => void;
  callHistory?: CallHistoryEntry[];
  showCallButtons?: { peerId: string; peerDisplayName?: string }[];
}

// ═════════════════════════════════════════════════════════════════════
// Main VideoCall Component
// ═════════════════════════════════════════════════════════════════════

export function VideoCall({
  activeCallId, callType: initialCallType, targetPeer, onCallEnd,
  incomingCall, onAcceptIncoming, onDeclineIncoming,
  callHistory: externalHistory, showCallButtons,
}: VideoCallProps) {
  const { tokens } = useAuth();
  const wallet = tokens.evmAddress || tokens.solanaAddress || null;

  const [viewState, setViewState] = useState<CallViewState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [displayNames, _setDisplayNames] = useState<Map<string, string>>(new Map());
  const [mutedState, _setMutedState] = useState<Map<string, { audio: boolean; video: boolean }>>(new Map());
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [_showHistory, _setShowHistory] = useState(false);
  const [_history, setHistory] = useState<CallHistoryEntry[]>(externalHistory || []);

  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const screenShareStream = useRef<MediaStream | null>(null);

  const { localStream, audioMuted, videoMuted, startMedia, stopMedia, toggleAudio, toggleVideo, flipCamera } =
    useUserMedia(initialCallType || 'video');
  const signaling = useSignaling(callInfo?.callId ?? null, wallet);

  const _createCall = useCallback(async (type: 'audio' | 'video', peer: string) => {
    if (!wallet) return;
    setViewState('calling');
    try {
      const res = await fetch('/api/calls/create', {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ type, participants: [peer] }),
      });
      if (!res.ok) { setViewState('idle'); return; }
      const data = await res.json();
      setCallInfo(data.call);
      setViewState('calling');
    } catch { setViewState('idle'); }
  }, [wallet]);

  const setupPeerConnections = useCallback(async (
    _stream: MediaStream, _call: CallInfo, _signalingData: { peers: string[]; host: string; groupMode: string },
  ) => {
    signaling.startPolling((signals, iceCandidates) => {
      for (const _signal of signals) { /* Handle offers/answers */ }
      for (const _candidate of iceCandidates) { /* Handle ICE candidates */ }
    });
  }, [signaling]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !wallet) return;
    setViewState('connecting');
    try {
      const res = await fetch(`/api/calls/${incomingCall.callId}/join`, { method: 'POST', credentials: 'include' });
      if (!res.ok) { setViewState('idle'); return; }
      const data = await res.json();
      setCallInfo(data.call);
      onAcceptIncoming?.(incomingCall.callId);
      const stream = await startMedia();
      if (stream && data.signaling) {
        setViewState('active');
        await setupPeerConnections(stream, data.call, data.signaling);
      }
    } catch { setViewState('idle'); }
  }, [incomingCall, wallet, startMedia, onAcceptIncoming, setupPeerConnections]);

  const declineCall = useCallback(() => {
    if (incomingCall) {
      fetch(`/api/calls/${incomingCall.callId}/end`, { method: 'POST', credentials: 'include' }).catch(() => {});
      onDeclineIncoming?.(incomingCall.callId);
    }
    setViewState('idle');
  }, [incomingCall, onDeclineIncoming]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (screenShareStream.current) {
        screenShareStream.current.getTracks().forEach((t) => t.stop());
        screenShareStream.current = null;
      }
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = true;
          peerConnections.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(videoTrack).catch(() => {});
          });
        }
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenShareStream.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack).catch(() => {});
        });
        screenTrack.onended = () => { setIsScreenSharing(false); screenShareStream.current = null; };
        setIsScreenSharing(true);
      } catch { /* User cancelled */ }
    }
  }, [isScreenSharing, localStream]);

  const endCall = useCallback(async () => {
    if (callInfo) {
      try { await fetch(`/api/calls/${callInfo.callId}/end`, { method: 'POST', credentials: 'include' }); } catch { }
    }
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    if (screenShareStream.current) { screenShareStream.current.getTracks().forEach((t) => t.stop()); screenShareStream.current = null; }
    stopMedia();
    signaling.stopPolling();
    if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
    setViewState('ended');
    setCallInfo(null);
    setRemoteStreams(new Map());
    setIsScreenSharing(false);
    setIsPiP(false);
    setCallDuration(0);
    setTimeout(() => { setViewState('idle'); onCallEnd?.(); }, 2000);
  }, [callInfo, stopMedia, signaling, onCallEnd]);

  const togglePiP = useCallback(() => setIsPiP(!isPiP), [isPiP]);

  useEffect(() => {
    if (viewState === 'active' && !durationRef.current) {
      const start = Date.now();
      durationRef.current = setInterval(() => setCallDuration(Date.now() - start), 1000);
    }
    if (viewState !== 'active' && durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
    return () => { if (durationRef.current) clearInterval(durationRef.current); };
  }, [viewState]);

  useEffect(() => {
    if (!externalHistory && wallet) {
      fetch('/api/calls/history', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => { if (data?.history) setHistory(data.history); })
        .catch(() => {});
    } else if (externalHistory) { setHistory(externalHistory); }
  }, [wallet, externalHistory]);

  // ─── Render ─────────────────────────────────────────────────
  if (incomingCall && viewState === 'idle') {
    return <IncomingCallBanner call={incomingCall} onAccept={acceptCall} onDecline={declineCall} />;
  }

  if (isPiP && viewState === 'active') {
    return <PiPOverlay localStream={localStream} duration={callDuration} onExpand={() => setIsPiP(false)} onEndCall={endCall} />;
  }

  if (viewState !== 'idle') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              {viewState === 'calling' || viewState === 'ringing' ? 'Calling...' : 'In Call'}
            </span>
            {viewState === 'active' && (
              <span className="text-xs text-white/50 font-mono">
                {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
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

        {viewState === 'calling' && callInfo?.participants ? (
          <CallingScreen callee={callInfo.participants.find((p) => p !== wallet) || 'Unknown'}
            type={callInfo.type} onCancel={endCall} />
        ) : viewState === 'ended' ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-lg text-white/60 font-medium">Call ended</p>
              {callDuration > 0 && <p className="text-sm text-white/40 mt-1">Duration: {Math.floor(callDuration / 60)}m {callDuration % 60}s</p>}
            </div>
          </div>
        ) : (
          <VideoGrid localStream={localStream} remoteStreams={remoteStreams}
            participants={callInfo?.participants || []} myWallet={wallet || ''}
            displayNames={displayNames} mutedState={mutedState} type={callInfo?.type || 'video'} />
        )}

        {viewState === 'active' && (
          <ControlsBar audioMuted={audioMuted} videoMuted={videoMuted}
            isScreenSharing={isScreenSharing} callActive={viewState === 'active'}
            onToggleAudio={toggleAudio} onToggleVideo={toggleVideo}
            onScreenShare={toggleScreenShare} onFlipCamera={flipCamera}
            onEndCall={endCall} onPiP={togglePiP} />
        )}
      </div>
    );
  }

  return null;
}

// ─── useVideoCall Hook ──────────────────────────────────────────────

export function useVideoCall() {
  const [activeCallId, setActiveCallId] = useState<string | undefined>();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [callType, setCallType] = useState<'audio' | 'video'>('video');
  const [targetPeer, setTargetPeer] = useState<string | undefined>();

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/calls/history', { credentials: 'include' });
      if (res.ok) { const data = await res.json(); setCallHistory(data.history || []); }
    } catch { /* Non-critical */ }
  }, []);

  const startCall = useCallback((type: 'audio' | 'video', peerId: string) => {
    setCallType(type); setTargetPeer(peerId); setActiveCallId('new');
  }, []);

  const handleCallEnd = useCallback(() => {
    setActiveCallId(undefined); setIncomingCall(null); refreshHistory();
  }, [refreshHistory]);

  const handleAcceptIncoming = useCallback((callId: string) => {
    setActiveCallId(callId); setIncomingCall(null);
  }, []);

  const handleDeclineIncoming = useCallback((_callId: string) => { setIncomingCall(null); }, []);

  return { activeCallId, incomingCall, callHistory, callType, targetPeer,
    setIncomingCall, startCall, handleCallEnd, handleAcceptIncoming, handleDeclineIncoming, refreshHistory };
}
