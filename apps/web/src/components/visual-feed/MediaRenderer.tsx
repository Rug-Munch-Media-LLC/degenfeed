'use client';

/**
 * MediaRenderer — Image/video/NFT renderer with blur-up loading,
 * aspect ratio containers, and play button overlay for videos.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface MediaRendererProps {
  imageUrl: string;
  videoUrl?: string;
  alt: string;
  aspectRatio: number;
  mediaType: 'image' | 'video' | 'gif' | 'nft_image' | 'nft_video';
  blurHash?: string;
  isNFT: boolean;
  onLoad?: () => void;
  className?: string;
}

export function MediaRenderer({
  imageUrl,
  videoUrl,
  alt,
  aspectRatio,
  mediaType,
  blurHash,
  isNFT,
  onLoad,
  className = '',
}: MediaRendererProps) {
  const [loaded, setLoaded] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const toggleVideo = useCallback(() => {
    if (!videoRef.current) return;
    if (videoPlaying) {
      videoRef.current.pause();
    } else {
      void videoRef.current.play();
    }
    setVideoPlaying(!videoPlaying);
  }, [videoPlaying]);

  // Cleanup video on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
      }
    };
  }, []);

  const isVideo = mediaType === 'video' || mediaType === 'gif' || mediaType === 'nft_video';

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: `${aspectRatio}`, maxHeight: '80vh' }}
    >
      {/* Blur-up placeholder */}
      {!loaded && blurHash && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundColor: '#1a1a2e',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
          }}
        />
      )}

      {!loaded && !blurHash && (
        <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: 'var(--color-muted)' }} />
      )}

      {/* Image */}
      {!isVideo && (
        <img
          src={imageUrl}
          alt={alt}
          loading="lazy"
          onLoad={handleLoad}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundColor: 'var(--color-card-bg)' }}
        />
      )}

      {/* Video / GIF */}
      {isVideo && videoUrl && (
        <div className="group relative h-full w-full">
          {/* Poster frame */}
          <img
            src={imageUrl}
            alt={alt}
            loading="lazy"
            onLoad={handleLoad}
            className={`h-full w-full object-cover transition-opacity duration-500 ${
              loaded && !videoPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <video
            ref={videoRef}
            src={videoUrl}
            loop
            muted
            playsInline
            preload="none"
            onLoadedData={handleLoad}
            className={`absolute inset-0 h-full w-full object-cover ${
              videoPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Play button overlay */}
          {!videoPlaying && (
            <button
              type="button"
              onClick={toggleVideo}
              className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Play video"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black shadow-xl backdrop-blur-sm transition-transform hover:scale-105">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </button>
          )}

          {/* Pause overlay */}
          {videoPlaying && (
            <button
              type="button"
              onClick={toggleVideo}
              className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 hover:opacity-100 transition-opacity"
              aria-label="Pause video"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-black backdrop-blur-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              </span>
            </button>
          )}
        </div>
      )}

      {/* NFT badge */}
      {isNFT && (
        <div className="absolute left-2 top-2 z-10">
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            NFT
          </span>
        </div>
      )}
    </div>
  );
}
