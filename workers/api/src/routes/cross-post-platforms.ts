/**
 * @degenfeed/api-worker — Cross-Post Platform Handlers
 *
 * Platform-specific publishing functions for centralized platforms:
 * Medium, Substack, YouTube, TikTok, Instagram, LinkedIn, Reddit, Pinterest.
 */

import type { Env } from '../index';
import type { CrossPostInput, CrossPostResult } from './cross-post-types';

// ═══════════════════════════════════════════════════════════════════════════
// MEDIUM
// ═══════════════════════════════════════════════════════════════════════════

export async function publishToMedium(
  input: CrossPostInput,
  account: { accessToken: string; platformUserId: string; label: string },
): Promise<CrossPostResult> {
  try {
    const userId = account.platformUserId;
    const body = {
      title: input.title || input.text.slice(0, 100),
      contentFormat: 'markdown',
      content: input.text,
      tags: input.tags?.slice(0, 5),
      publishStatus: input.visibility === 'private' ? 'draft' : 'public',
    };

    const resp = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await resp.json()) as {
      data?: { id?: string; url?: string };
      errors?: Array<{ message?: string }>;
    };

    if (!resp.ok) {
      return { ok: false, platform: 'medium', error: data.errors?.[0]?.message || `HTTP ${resp.status}` };
    }

    return { ok: true, platform: 'medium', nativeId: data.data?.id, nativeUrl: data.data?.url };
  } catch (err) {
    return { ok: false, platform: 'medium', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUBSTACK
// ═══════════════════════════════════════════════════════════════════════════

export async function publishToSubstack(
  _input: CrossPostInput,
  account: { platformUserId: string; metadata?: Record<string, string> },
): Promise<CrossPostResult> {
  const emailToPost = account.metadata?.emailToPost;
  if (!emailToPost) {
    return {
      ok: false,
      platform: 'substack',
      error: 'No email-to-post address configured. Update your Substack connection with your email-to-post address from Substack Settings.',
    };
  }

  return { ok: true, platform: 'substack', nativeId: 'email-to-post', nativeUrl: account.metadata?.substackUrl || undefined };
}

// ═══════════════════════════════════════════════════════════════════════════
// YOUTUBE
// ═══════════════════════════════════════════════════════════════════════════

export async function publishToYouTube(
  input: CrossPostInput,
  account: { accessToken: string; platformUserId: string; label: string },
  _env: Env,
): Promise<CrossPostResult> {
  try {
    if (!input.videoUrl && !input.videoBase64) {
      return { ok: false, platform: 'youtube', error: 'videoUrl or videoBase64 required for YouTube publishing' };
    }

    let videoContent: ArrayBuffer | null = null;
    let mimeType = input.videoMimeType || 'video/mp4';

    if (input.videoBase64) {
      const binaryString = atob(input.videoBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      videoContent = bytes.buffer;
    } else if (input.videoUrl) {
      const videoResp = await fetch(input.videoUrl);
      if (!videoResp.ok) return { ok: false, platform: 'youtube', error: `Failed to fetch video: HTTP ${videoResp.status}` };
      videoContent = await videoResp.arrayBuffer();
      mimeType = videoResp.headers.get('content-type')?.split(';')[0] || mimeType;
    }

    if (!videoContent) return { ok: false, platform: 'youtube', error: 'Could not obtain video content' };

    // Step 1: Create resumable upload session
    const metadata = {
      snippet: { title: input.title || input.text.slice(0, 100), description: input.text, tags: input.tags },
      status: { privacyStatus: input.visibility || 'public', selfDeclaredMadeForKids: false },
    };

    const uploadUrl = new URL('https://www.googleapis.com/upload/youtube/v3/videos');
    uploadUrl.searchParams.set('part', 'snippet,status');
    uploadUrl.searchParams.set('uploadType', 'resumable');

    const initResp = await fetch(uploadUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(videoContent.byteLength),
      },
      body: JSON.stringify(metadata),
    });

    if (!initResp.ok) {
      const errBody = await initResp.text();
      return { ok: false, platform: 'youtube', error: `Upload session creation failed: HTTP ${initResp.status} — ${errBody}` };
    }

    const uploadLocation = initResp.headers.get('Location');
    if (!uploadLocation) return { ok: false, platform: 'youtube', error: 'No upload location in response' };

    // Step 2: Upload video binary
    const uploadResp = await fetch(uploadLocation, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType, 'Content-Length': String(videoContent.byteLength) },
      body: videoContent,
    });

    if (!uploadResp.ok) {
      const errBody = await uploadResp.text();
      return { ok: false, platform: 'youtube', error: `Video upload failed: HTTP ${uploadResp.status} — ${errBody}` };
    }

    const result = (await uploadResp.json()) as { id?: string; snippet?: { title?: string } };
    return { ok: true, platform: 'youtube', nativeId: result.id, nativeUrl: result.id ? `https://www.youtube.com/watch?v=${result.id}` : undefined };
  } catch (err) {
    return { ok: false, platform: 'youtube', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TIKTOK
// ═══════════════════════════════════════════════════════════════════════════

export async function publishToTikTok(
  input: CrossPostInput,
  account: { accessToken: string; platformUserId: string; label: string },
  _env: Env,
): Promise<CrossPostResult> {
  try {
    if (!input.videoUrl && !input.videoBase64) {
      return { ok: false, platform: 'tiktok', error: 'videoUrl or videoBase64 required for TikTok publishing' };
    }

    // Step 1: Initialize upload
    const initResp = await fetch('https://open.tiktokapis.com/v2/video/upload/init/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        source_info: { source: 'FILE_UPLOAD', video_size: 0, chunk_size: 0, total_chunk_count: 1 },
      }),
    });

    if (!initResp.ok) {
      const errBody = await initResp.text();
      return { ok: false, platform: 'tiktok', error: `TikTok init failed: HTTP ${initResp.status} — ${errBody}` };
    }

    const initData = (await initResp.json()) as { data?: { upload_url?: string; publish_id?: string } };
    const uploadUrl = initData?.data?.upload_url;
    if (!uploadUrl) return { ok: false, platform: 'tiktok', error: 'No upload URL from TikTok init' };

    // Step 2: Upload video
    let videoBody: BodyInit | null = null;
    if (input.videoBase64) {
      const binaryString = atob(input.videoBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      videoBody = bytes;
    } else if (input.videoUrl) {
      const videoResp = await fetch(input.videoUrl);
      if (!videoResp.ok) return { ok: false, platform: 'tiktok', error: `Failed to fetch video: HTTP ${videoResp.status}` };
      videoBody = await videoResp.arrayBuffer();
    }

    if (!videoBody) return { ok: false, platform: 'tiktok', error: 'Could not obtain video content' };

    const uploadResp = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: videoBody });
    if (!uploadResp.ok) return { ok: false, platform: 'tiktok', error: `TikTok upload failed: HTTP ${uploadResp.status}` };

    // Step 3: Publish
    const publishResp = await fetch('https://open.tiktokapis.com/v2/video/publish/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        post_info: { title: input.text.slice(0, 2200), privacy_level: input.visibility === 'private' ? 'PRIVATE' : 'PUBLIC_TO_EVERYONE' },
        source_info: { source: 'FILE_UPLOAD', video_size: 0, chunk_size: 0, total_chunk_count: 1 },
      }),
    });

    const publishData = (await publishResp.json()) as { data?: { publish_id?: string } };
    if (!publishResp.ok) return { ok: false, platform: 'tiktok', error: `TikTok publish failed: HTTP ${publishResp.status}` };
    return { ok: true, platform: 'tiktok', nativeId: publishData?.data?.publish_id };
  } catch (err) {
    return { ok: false, platform: 'tiktok', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTAGRAM
// ═══════════════════════════════════════════════════════════════════════════

export async function publishToInstagram(
  input: CrossPostInput,
  account: { accessToken: string; platformUserId: string; label: string },
  _env: Env,
): Promise<CrossPostResult> {
  try {
    const igUserId = account.platformUserId;
    const accessToken = account.accessToken;

    if (!input.images || input.images.length === 0) {
      return { ok: false, platform: 'instagram', error: 'Instagram requires at least one image.' };
    }

    // Step 1: Create media containers
    const mediaIds: string[] = [];
    for (const imageUrl of input.images.slice(0, 10)) {
      const createResp = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, caption: input.text.slice(0, 2200), access_token: accessToken }),
      });
      const createData = (await createResp.json()) as { id?: string; error?: { message?: string } };
      if (!createResp.ok || !createData.id) {
        return { ok: false, platform: 'instagram', error: `Failed to create media: ${createData.error?.message || `HTTP ${createResp.status}`}` };
      }
      mediaIds.push(createData.id);
    }

    if (mediaIds.length === 0) return { ok: false, platform: 'instagram', error: 'No media created' };

    // Step 2: Publish (carousel or single)
    const publishId = mediaIds.length === 1 ? mediaIds[0]! : (() => { throw new Error('Need carousel'); })();

    if (mediaIds.length > 1) {
      const carouselResp = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_type: 'CAROUSEL', children: mediaIds, caption: input.text.slice(0, 2200), access_token: accessToken }),
      });
      const carouselData = (await carouselResp.json()) as { id?: string; error?: { message?: string } };
      if (!carouselResp.ok || !carouselData.id) {
        return { ok: false, platform: 'instagram', error: `Failed to create carousel: ${carouselData.error?.message || `HTTP ${carouselResp.status}`}` };
      }
      const publishResp = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: carouselData.id, access_token: accessToken }),
      });
      const publishData = (await publishResp.json()) as { id?: string; error?: { message?: string } };
      if (!publishResp.ok) return { ok: false, platform: 'instagram', error: `Failed to publish: ${publishData.error?.message || `HTTP ${publishResp.status}`}` };
      return { ok: true, platform: 'instagram', nativeId: publishData.id, nativeUrl: `https://www.instagram.com/p/${publishData.id}/` };
    }

    const publishResp = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: publishId, access_token: accessToken }),
    });
    const publishData = (await publishResp.json()) as { id?: string; error?: { message?: string } };
    if (!publishResp.ok) return { ok: false, platform: 'instagram', error: `Failed to publish: ${publishData.error?.message || `HTTP ${publishResp.status}`}` };
    return { ok: true, platform: 'instagram', nativeId: publishData.id, nativeUrl: `https://www.instagram.com/p/${publishData.id}/` };
  } catch (err) {
    return { ok: false, platform: 'instagram', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LINKEDIN
// ═══════════════════════════════════════════════════════════════════════════

export async function publishToLinkedIn(
  input: CrossPostInput,
  account: { accessToken: string; platformUserId: string; label: string },
): Promise<CrossPostResult> {
  try {
    const author = `urn:li:person:${account.platformUserId}`;
    const body: Record<string, unknown> = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': { shareCommentary: { text: input.text.slice(0, 3000) }, shareMediaCategory: 'NONE' },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': input.visibility === 'private' ? 'CONTAINER' : 'PUBLIC' },
    };

    if (input.images && input.images.length > 0) {
      const media: Array<{ status: string; description?: { text: string }; media: string }> = [];
      for (const imageUrl of input.images.slice(0, 9)) {
        const registerResp = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ registerUploadRequest: { recipes: ['urn:li:digitalmediaRecipe:feedshare-image'], owner: author, serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }] } }),
        });
        const registerData = (await registerResp.json()) as { value?: { uploadMechanism?: { 'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'?: { uploadUrl?: string } }; asset?: string } };
        const uploadUrl = registerData?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
        if (uploadUrl) {
          const imgResp = await fetch(imageUrl);
          if (imgResp.ok) await fetch(uploadUrl, { method: 'PUT', body: await imgResp.arrayBuffer() });
          if (registerData?.value?.asset) media.push({ status: 'READY', description: { text: '' }, media: registerData.value.asset });
        }
      }
      if (media.length > 0) {
        (body.specificContent as Record<string, unknown>)['com.linkedin.ugc.ShareContent'] = {
          shareCommentary: { text: input.text.slice(0, 3000) }, shareMediaCategory: 'IMAGE', media,
        };
      }
    }

    const resp = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
      body: JSON.stringify(body),
    });

    const data = (await resp.json()) as { id?: string; message?: string };
    if (!resp.ok) return { ok: false, platform: 'linkedin', error: data.message || `HTTP ${resp.status}` };
    return { ok: true, platform: 'linkedin', nativeId: data.id, nativeUrl: data.id ? `https://www.linkedin.com/feed/update/${data.id}` : undefined };
  } catch (err) {
    return { ok: false, platform: 'linkedin', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REDDIT
// ═══════════════════════════════════════════════════════════════════════════

export async function publishToReddit(
  input: CrossPostInput,
  account: { accessToken: string; platformUserId: string; label: string },
): Promise<CrossPostResult> {
  try {
    if (!input.title) return { ok: false, platform: 'reddit', error: 'title is required for Reddit posts' };

    const body = new URLSearchParams({ api_type: 'json', title: input.title, text: input.text, kind: 'self', sr: input.tags?.[0] || 'test' });
    if (input.images && input.images.length > 0) { body.set('kind', 'image'); if (input.images[0]) body.set('url', input.images[0]); }
    const subredditTag = input.tags?.find((t) => t.startsWith('r/'));
    if (subredditTag) body.set('sr', subredditTag.replace('r/', ''));
    if (input.videoUrl) { body.set('kind', 'link'); body.set('url', input.videoUrl); body.delete('text'); }

    const resp = await fetch('https://oauth.reddit.com/api/submit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'degenfeed:centralized-poster:1.0 (by /u/degenfeed)' },
      body: body.toString(),
    });

    const data = (await resp.json()) as { json?: { errors?: Array<unknown>; data?: { id?: string; url?: string; name?: string } }; message?: string };
    if (!resp.ok || data.json?.errors?.length) return { ok: false, platform: 'reddit', error: data.message || (data.json?.errors?.[0] ? JSON.stringify(data.json.errors[0]) : `HTTP ${resp.status}`) };
    const postData = data.json?.data;
    return { ok: true, platform: 'reddit', nativeId: postData?.id || postData?.name, nativeUrl: postData?.url || `https://reddit.com${postData?.name || ''}` };
  } catch (err) {
    return { ok: false, platform: 'reddit', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PINTEREST
// ═══════════════════════════════════════════════════════════════════════════

export async function publishToPinterest(
  input: CrossPostInput,
  account: { accessToken: string; platformUserId: string; label: string },
): Promise<CrossPostResult> {
  try {
    if (!input.images || input.images.length === 0) return { ok: false, platform: 'pinterest', error: 'At least one image is required for Pinterest pins' };

    const body = { title: input.title || input.text.slice(0, 100), description: input.text.slice(0, 500), alt_text: '', link: input.tags?.find((t) => t.startsWith('http')) || undefined, media_source: { source_type: 'image_url', url: input.images[0] } };

    const resp = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await resp.json()) as { id?: string; link?: string; message?: string };
    if (!resp.ok) return { ok: false, platform: 'pinterest', error: data.message || `HTTP ${resp.status}` };
    return { ok: true, platform: 'pinterest', nativeId: data.id, nativeUrl: data.link };
  } catch (err) {
    return { ok: false, platform: 'pinterest', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
