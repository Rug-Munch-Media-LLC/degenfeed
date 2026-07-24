/**
 * Pixelfed Write Provider
 *
 * Posts photos with captions to Pixelfed using Mastodon-compatible API.
 *
 * Flow:
 *   1. Start with a PIXELFED_ACCESS_TOKEN (generated via artisan tinker)
 *   2. Upload media files via POST /api/v1/media
 *   3. Create status with media attachments via POST /api/v1/statuses
 *
 * Token generation:
 *   docker exec degenfeed-pixelfed php artisan tinker --execute="
 *     \$u = \App\User::where('username','photos_admin')->first();
 *     echo \$u->createToken('Bridge', ['read','write','follow','push'])->accessToken;
 *   "
 */

import type { UnifiedPost } from '../server/types';

const PIXELFED_BASE = process.env.PIXELFED_BASE_URL || 'http://127.0.0.1:8087';
const PIXELFED_ACCESS_TOKEN = process.env.PIXELFED_ACCESS_TOKEN || '';

// ─── Types ──────────────────────────────────────────────────────────────

export interface PixelfedMediaResult {
  id: string;
  type: string;
  url: string;
  preview_url: string;
  description?: string;
}

export interface PixelfedStatusResult {
  id: string;
  url: string;
  uri: string;
  content: string;
  created_at: string;
  media_attachments: PixelfedMediaResult[];
}

export interface PixelfedPublishResult {
  ok: boolean;
  status?: PixelfedStatusResult;
  error?: string;
}

// ─── API Client ─────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; data?: T; error?: string }> {
  if (!PIXELFED_ACCESS_TOKEN) {
    return { ok: false, error: 'PIXELFED_ACCESS_TOKEN not configured' };
  }

  const url = `${PIXELFED_BASE}${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add auth if not already present on multipart form
  if (!headers.Authorization) {
    headers.Authorization = `Bearer ${PIXELFED_ACCESS_TOKEN}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let errorMsg = `HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(text);
        errorMsg = errJson.error || errorMsg;
      } catch {
        errorMsg = text.slice(0, 200) || errorMsg;
      }
      return { ok: false, error: errorMsg };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─── Media Upload ──────────────────────────────────────────────────────

/**
 * Upload an image to Pixelfed.
 *
 * @param imageBuffer - Raw image bytes (JPEG, PNG, or GIF)
 * @param filename - Original filename (e.g. "photo.jpg")
 * @param description - Alt text / description for the image
 * @returns Media attachment result with ID
 */
export async function uploadMedia(
  imageBuffer: Buffer | Uint8Array,
  filename: string,
  description?: string,
): Promise<{ ok: boolean; mediaId?: string; error?: string }> {
  const boundary = `----FormBoundary${Math.random().toString(36).slice(2, 10)}`;
  const CRLF = '\r\n';
  const mimeType = filename.endsWith('.png')
    ? 'image/png'
    : filename.endsWith('.gif')
      ? 'image/gif'
      : 'image/jpeg';

  // Build multipart body manually
  let body = '';
  body += `--${boundary}${CRLF}`;
  body += `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}`;
  body += `Content-Type: ${mimeType}${CRLF}${CRLF}`;

  const textEncoder = new TextEncoder();
  const _prefix = textEncoder.encode(body);
  const _suffix = textEncoder.encode(`${CRLF}--${boundary}${CRLF}`);

  if (description) {
    const _descPart = `Content-Disposition: form-data; name="description"${CRLF}${CRLF}${description}${CRLF}--${boundary}--${CRLF}`;
    // We can't easily construct this with raw bytes and string intermixed
    // Let's use a simpler approach: fetch with FormData-like body
  }

  // Use native Fetch's FormData support
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: mimeType });
  formData.append('file', blob, filename);
  if (description) {
    formData.append('description', description);
  }

  try {
    const res = await fetch(`${PIXELFED_BASE}/api/v1/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PIXELFED_ACCESS_TOKEN}`,
        Accept: 'application/json',
      },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `Upload HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = (await res.json()) as PixelfedMediaResult;
    if (!data?.id) {
      return { ok: false, error: 'Media upload returned no ID' };
    }

    console.log(`[pixelfed-write] ✓ Uploaded media ${data.id}: ${data.url}`);
    return { ok: true, mediaId: data.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─── Post to Pixelfed ─────────────────────────────────────────────────

/**
 * Post a status (photo with caption) to Pixelfed.
 *
 * @param status - Text content / caption
 * @param mediaIds - Array of media attachment IDs from uploadMedia()
 * @param visibility - 'public' | 'unlisted' | 'private'
 * @returns Publish result with status data
 */
export async function postToPixelfed(
  status: string,
  mediaIds: string[],
  visibility: 'public' | 'unlisted' | 'private' = 'public',
  spoilerText?: string,
): Promise<PixelfedPublishResult> {
  if (mediaIds.length === 0) {
    return { ok: false, error: 'Pixelfed requires at least one media attachment' };
  }

  const body: Record<string, unknown> = {
    status,
    media_ids: mediaIds,
    visibility,
  };

  if (spoilerText) {
    body.spoiler_text = spoilerText;
    body.sensitive = true;
  }

  const result = await apiFetch<PixelfedStatusResult>('/api/v1/statuses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (result.ok && result.data) {
    console.log(`[pixelfed-write] ✓ Posted: ${result.data.url}`);
    return { ok: true, status: result.data };
  }

  return { ok: false, error: result.error || 'Unknown error posting to Pixelfed' };
}

// ─── Unified Post Mapping ──────────────────────────────────────────────

/**
 * Map a UnifiedPost to a Pixelfed post.
 * Extracts images from embeds and posts them with the caption text.
 *
 * @param post - Unified post from any protocol
 * @returns Pixelfed publish result
 */
export async function publishUnifiedPost(post: UnifiedPost): Promise<PixelfedPublishResult> {
  const imageEmbeds = post.embeds.filter((e) => e.kind === 'image' && e.url);

  if (imageEmbeds.length === 0) {
    return { ok: false, error: 'No images to post to Pixelfed' };
  }

  // Build caption: include source attribution
  const caption =
    post.text.length > 0
      ? `${post.text}\n\n— ${post.author.displayName} (${post.protocol})`
      : `Photo from ${post.author.displayName} (${post.protocol})`;

  // Pixelfed max caption length is 500 chars
  const truncatedCaption = caption.length > 497 ? `${caption.slice(0, 494)}...` : caption;

  const uploadedIds: string[] = [];

  for (let i = 0; i < Math.min(imageEmbeds.length, 4); i++) {
    const embed = imageEmbeds[i];
    try {
      // Download the image
      const imgRes = await fetch(embed.url, { signal: AbortSignal.timeout(10000) });
      if (!imgRes.ok) {
        console.log(`[pixelfed-write] ✗ Failed to fetch image ${embed.url}: HTTP ${imgRes.status}`);
        continue;
      }

      const imgBuffer = await imgRes.arrayBuffer();
      const ext = embed.url.split('.').pop()?.toLowerCase() || 'jpg';
      const filename = `bridge-${Date.now()}-${i}.${ext}`;

      const uploadResult = await uploadMedia(
        new Uint8Array(imgBuffer),
        filename,
        `Photo ${i + 1} from ${post.author.displayName}`,
      );

      if (uploadResult.ok && uploadResult.mediaId) {
        uploadedIds.push(uploadResult.mediaId);
      } else {
        console.log(`[pixelfed-write] ✗ Media upload failed: ${uploadResult.error}`);
      }
    } catch (err) {
      console.log(`[pixelfed-write] ✗ Image fetch/upload failed: ${(err as Error).message}`);
    }
  }

  if (uploadedIds.length === 0) {
    return { ok: false, error: 'Failed to upload any images to Pixelfed' };
  }

  return postToPixelfed(truncatedCaption, uploadedIds);
}

export default {
  uploadMedia,
  postToPixelfed,
  publishUnifiedPost,
};
