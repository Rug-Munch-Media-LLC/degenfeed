'use client';

/**
 * @degenfeed/ui — ImageBlurUp
 *
 * Progressive image loading: renders a tiny blurred placeholder
 * immediately and crossfades to the full-resolution image on load.
 * Uses the LQIP (Low-Quality Image Placeholder) technique.
 *
 * Also provides connection-aware quality selection.
 */

import { type ImgHTMLAttributes, memo, useCallback, useEffect, useRef, useState } from 'react';

/* ─── Connection quality detection ─────────────────────────── */

export type ConnectionQuality = 'slow' | 'medium' | 'fast';

const THRESHOLDS = {
  slow: 1.5, // Mbps
  medium: 5, // Mbps
};

/**
 * Hook: returns estimated connection quality based on navigator.connection.
 * Falls back to 'fast' when the API is unavailable.
 */
export function useConnectionQuality(): ConnectionQuality {
  const [quality, setQuality] = useState<ConnectionQuality>('fast');

  useEffect(() => {
    const conn = (navigator as any).connection as
      | {
          effectiveType?: string;
          downlink?: number;
          addEventListener?: (event: string, handler: () => void) => void;
          removeEventListener?: (event: string, handler: () => void) => void;
        }
      | undefined;

    if (!conn) return;

    const update = () => {
      if (conn.downlink !== undefined) {
        if (conn.downlink < THRESHOLDS.slow) {
          setQuality('slow');
        } else if (conn.downlink < THRESHOLDS.medium) {
          setQuality('medium');
        } else {
          setQuality('fast');
        }
      } else if (conn.effectiveType) {
        setQuality(
          conn.effectiveType === '4g' ? 'fast' : conn.effectiveType === '3g' ? 'medium' : 'slow',
        );
      }
    };

    update();
    conn.addEventListener?.('change', update);
    return () => conn.removeEventListener?.('change', update);
  }, []);

  return quality;
}

/* ─── ImageBlurUp Component ────────────────────────────────── */

export interface ImageBlurUpProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Low-quality placeholder (base64 or URL) */
  placeholder?: string;
  /** Connection quality override */
  connectionQuality?: ConnectionQuality;
  /** Whether to skip loading on slow connections */
  skipOnSlow?: boolean;
  /** Called when the full image loads */
  onLoaded?: () => void;
}

export const ImageBlurUp = memo(function ImageBlurUp({
  src,
  alt,
  placeholder,
  connectionQuality,
  skipOnSlow = true,
  onLoaded,
  className = '',
  style,
  ...imgProps
}: ImageBlurUpProps) {
  const detectedQuality = useConnectionQuality();
  const quality = connectionQuality ?? detectedQuality;
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const shouldSkip = skipOnSlow && quality === 'slow';

  const handleLoad = useCallback(() => {
    setLoaded(true);
    onLoaded?.();
  }, [onLoaded]);

  useEffect(() => {
    // Reset state when src changes
    setLoaded(false);
    setError(false);
  }, [src]);

  return (
    <div
      className={`image-blur-up ${className} ${loaded ? 'image-blur-up-loaded' : ''}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Placeholder */}
      {placeholder && !loaded && (
        <img
          src={placeholder}
          alt=""
          className="image-blur-up-placeholder"
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            opacity: 1,
            transition: 'opacity 0.4s ease',
          }}
        />
      )}

      {/* Main image */}
      {!shouldSkip && !error && (
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ''}
          className={`image-blur-up-full ${loaded ? 'image-blur-up-visible' : ''}`}
          loading="lazy"
          onLoad={handleLoad}
          onError={() => setError(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
          {...imgProps}
        />
      )}

      {/* Slow connection fallback */}
      {shouldSkip && (
        <div
          className="image-blur-up-skip"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-muted, #222)',
            color: 'var(--color-muted, #888)',
            fontSize: '0.75rem',
          }}
        >
          ⚡ Image skipped on slow connection
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          className="image-blur-up-error"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-muted, #222)',
            color: 'var(--color-muted, #888)',
            fontSize: '0.75rem',
          }}
        >
          Failed to load image
        </div>
      )}
    </div>
  );
});
