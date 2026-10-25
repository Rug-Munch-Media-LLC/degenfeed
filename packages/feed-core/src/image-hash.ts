// ─── Perceptual image fingerprint ─────────────────────────────────────

import type { UnifiedPost } from '@degenfeed/types';

export function imagePerceptualFingerprint(post: UnifiedPost): string | null {
  const images = post.embeds.filter((e) => e.kind === 'image');
  if (images.length === 0) return null;

  const fingerprints: string[] = [];
  for (const img of images) {
    try {
      const u = new URL(img.url);
      // Strip query params, protocol, and common CDN variations
      const path = u.pathname.replace(/\/+$/, '');
      const ext = path.split('.').pop()?.toLowerCase() || '';
      // Only process image-like extensions
      if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp'].includes(ext)) continue;

      // Use path name (filename without extension) as base fingerprint
      const name =
        path
          .split('/')
          .pop()
          ?.replace(/\.[^.]+$/, '') || '';
      // Check for resized variants (common CDN pattern: /resize/ or _small, _thumb)
      const strippedName = name
        .replace(/[-_]?(small|thumb|tiny|medium|large|original|full|resize|crop)[-_]?/gi, '')
        .replace(/[_-]?\d+x\d+[_-]?/gi, ''); // Strip dimension suffixes like "300x200"

      if (strippedName && strippedName.length > 3) {
        // Use the image dimensions from metadata if available
        const meta = img.meta as unknown as Record<string, unknown> | undefined;
        const dims = meta?.width && meta?.height ? `${meta.width}x${meta.height}` : '';
        fingerprints.push(`phash:${strippedName.toLowerCase()}|${dims}`);
      } else {
        // Fallback: use full path minus query
        fingerprints.push(`phash:${u.hostname}${path.toLowerCase()}`);
      }
    } catch {
      fingerprints.push(`phash:${img.url}`);
    }
  }

  return fingerprints.length > 0 ? fingerprints.sort().join('||') : null;
}

/**
 * Cross-poster detection: identify when the same user posts identical
 * or near-identical content across multiple protocols (our own users
 * using the DegenFeed cross-poster, or manual cross-posting).
 */
