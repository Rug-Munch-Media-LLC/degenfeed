'use client';

import { useCallback, useRef } from 'react';

export interface ScreenShareState {
  isScreenSharing: boolean;
  toggleScreenShare: () => Promise<void>;
  cleanupScreenShare: () => void;
}

/**
 * Hook to manage screen sharing for video calls.
 * Replaces the video track in all peer connections with the screen share track.
 */
export function useScreenShare(
  localStream: MediaStream | null,
  peerConnections: React.MutableRefObject<Map<string, RTCPeerConnection>>,
  getIsScreenSharing: () => boolean,
  setIsScreenSharing: (v: boolean) => void,
): ScreenShareState {
  const screenShareStream = useRef<MediaStream | null>(null);

  const toggleScreenShare = useCallback(async () => {
    if (getIsScreenSharing()) {
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
        if (!screenTrack) {
          setIsScreenSharing(false);
          screenShareStream.current = null;
          return;
        }

        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack).catch(() => {});
        });

        screenTrack.onended = () => {
          setIsScreenSharing(false);
          screenShareStream.current = null;
        };
        setIsScreenSharing(true);
      } catch {
        // User cancelled or not supported
      }
    }
  }, [localStream, peerConnections, getIsScreenSharing, setIsScreenSharing]);

  const cleanupScreenShare = useCallback(() => {
    if (screenShareStream.current) {
      screenShareStream.current.getTracks().forEach((t) => t.stop());
      screenShareStream.current = null;
    }
  }, []);

  return { isScreenSharing: getIsScreenSharing(), toggleScreenShare, cleanupScreenShare };
}
