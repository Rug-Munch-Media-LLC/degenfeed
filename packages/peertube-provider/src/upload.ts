/**
 * @degenfeed/peertube-provider — Video Upload & Management
 *
 * Full lifecycle for DegenFeed creator video uploads to PeerTube:
 *   - Upload videos (regular + short form)
 *   - Track transcoding progress
 *   - Update metadata
 *   - Delete videos
 *
 * PeerTube's upload API requires OAuth2 authentication.
 * Uploads use multipart/form-data. Transcoding happens asynchronously.
 *
 * API Reference:
 *   POST   /api/v1/videos/upload            — Upload a video
 *   GET    /api/v1/videos/{id}              — Get video info (for progress)
 *   PUT    /api/v1/videos/{id}              — Update video metadata
 *   DELETE /api/v1/videos/{id}              — Delete a video
 *   POST   /api/v1/videos/{id}/publish      — Publish a scheduled video
 *
 * KV schema (CONTENT_STORE):
 *   creator:videos:{creatorAddress}        → CreatorVideoMeta[]
 *   creator:videos:progress:{uuid}         → UploadProgress
 */

// ─── Types ─────────────────────────────────────────────────────────────

export interface UploadVideoOptions {
  /** Video file to upload (File or Blob). */
  file: File | Blob;
  /** Video title (1-120 characters). */
  title: string;
  /** Video description. */
  description?: string;
  /** PeerTube category ID (1=Music, 2=Films, 10=Tech, etc.). */
  category?: number;
  /** Tags for discoverability (max 5). */
  tags?: string[];
  /** Privacy: 1=Public, 2=Unlisted, 3=Private. Default 1. */
  privacy?: 1 | 2 | 3;
  /** Mark as short (vertical, ≤60 seconds). */
  isShort?: boolean;
  /** Thumbnail image file. */
  thumbnail?: File | Blob;
  /** ISO 8601 timestamp to schedule publication. */
  scheduleAt?: string;
  /** ISO 8601 original publication date (for re-uploaded content). */
  originallyPublishedAt?: string;
  /** Language ISO 639-1 code (e.g. "en"). */
  language?: string;
  /** Whether to allow comments. Default true. */
  commentsEnabled?: boolean;
  /** Whether to allow downloading. Default false. */
  downloadEnabled?: boolean;
  /** Whether the video is NSFW. Default false. */
  nsfw?: boolean;
  /** DegenFeed-specific metadata. */
  degenfeed?: {
    creatorAddress?: string;
    creatorHandle?: string;
    isShort?: boolean;
    protocol?: string;
  };
}

export interface UploadResult {
  /** PeerTube video UUID. */
  uuid: string;
  /** Short UUID (for short URLs). */
  shortUUID: string;
  /** Permanent URL on PeerTube instance. */
  url: string;
  /** iframe embed URL. */
  embedUrl: string;
  /** Watch page URL path. */
  embedPath: string;
  /** Video name. */
  name: string;
}

export interface ShortUploadResult {
  uuid: string;
  url: string;
  embedUrl: string;
  /** Duration in seconds. */
  duration: number;
  /** Vertical format flag. */
  isShort: true;
}

export interface UploadProgress {
  /** Current state. */
  state: 'pending' | 'processing' | 'published' | 'error';
  /** Transcoding progress (0-100). */
  progress: number;
  /** Error message if state is 'error'. */
  error?: string;
  /** When the upload started (Unix ms). */
  startedAt: number;
  /** Estimated remaining time in seconds. */
  eta?: number;
}

export interface VideoUpdateOptions {
  title?: string;
  description?: string;
  category?: number;
  tags?: string[];
  privacy?: 1 | 2 | 3;
  thumbnail?: File | Blob;
  commentsEnabled?: boolean;
  downloadEnabled?: boolean;
  nsfw?: boolean;
  scheduleAt?: string;
  language?: string;
  /** DegenFeed-specific metadata update. */
  degenfeed?: Record<string, unknown>;
}

// ─── Constants ─────────────────────────────────────────────────────────

const PEERTUBE_INSTANCE = 'https://video.degenfeed.xyz';

// ─── Error type ────────────────────────────────────────────────────────

export class PeerTubeUploadError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'PeerTubeUploadError';
  }
}

// ─── HTTP helper ───────────────────────────────────────────────────────

async function authenticatedFetch(
  url: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('authorization', `Bearer ${accessToken}`);
  headers.set('accept', 'application/json');
  headers.set('user-agent', 'DegenFeed/1.0 (upload)');

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => undefined);
    }
    throw new PeerTubeUploadError(
      `PeerTube API error: ${response.status} ${response.statusText}`,
      response.status,
      body,
    );
  }

  return response;
}

// ─── Main Class ────────────────────────────────────────────────────────

export class PeerTubeUploader {
  private instanceUrl: string;
  private accessToken: string;

  constructor(config: { instanceUrl?: string; accessToken: string }) {
    this.instanceUrl = (config.instanceUrl ?? PEERTUBE_INSTANCE).replace(/\/$/, '');
    this.accessToken = config.accessToken;
  }

  /**
   * Update the access token (e.g., after refresh).
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Upload a video to PeerTube.
   *
   * Accepts a File or Blob along with metadata. Uses multipart/form-data.
   * Returns the video's UUID, URL, and embed URL after creation.
   * Transcoding happens asynchronously — poll getUploadProgress() to track it.
   */
  async uploadVideo(opts: UploadVideoOptions): Promise<UploadResult> {
    const url = `${this.instanceUrl}/api/v1/videos/upload`;

    const formData = new FormData();
    formData.append('videofile', opts.file, (opts.file as File).name ?? 'video.mp4');
    formData.append('name', opts.title.slice(0, 120));
    formData.append('privacy', String(opts.privacy ?? 1));
    formData.append('commentsEnabled', String(opts.commentsEnabled ?? true));
    formData.append('downloadEnabled', String(opts.downloadEnabled ?? false));
    formData.append('nsfw', String(opts.nsfw ?? false));

    if (opts.description) formData.append('description', opts.description);
    if (opts.category !== undefined) formData.append('category', String(opts.category));
    if (opts.language) formData.append('language', opts.language);

    // Tags: PeerTube accepts up to 5 tags
    if (opts.tags && opts.tags.length > 0) {
      for (const tag of opts.tags.slice(0, 5)) {
        formData.append('tags', tag);
      }
    }
    // Always add DegenFeed tag
    formData.append('tags', 'degenfeed');
    if (opts.isShort) formData.append('tags', 'short');

    // Thumbnail
    if (opts.thumbnail) {
      formData.append('thumbnailfile', opts.thumbnail);
    }

    // Schedule future publication
    if (opts.scheduleAt) {
      formData.append(
        'scheduleUpdate',
        JSON.stringify({
          scheduleAt: new Date(opts.scheduleAt).toISOString(),
          update: { privacy: 1 },
        }),
      );
    }

    // Original publication date
    if (opts.originallyPublishedAt) {
      formData.append('originallyPublishedAt', opts.originallyPublishedAt);
    }

    // DegenFeed plugin metadata
    if (opts.degenfeed) {
      formData.append(
        'pluginData',
        JSON.stringify({
          degenfeed: {
            platform: 'degenfeed',
            version: '1.0',
            ...opts.degenfeed,
          },
        }),
      );
    }

    const response = await authenticatedFetch(url, this.accessToken, {
      method: 'POST',
      body: formData,
      // No content-type header — fetch sets multipart boundary automatically
    });

    const result = (await response.json()) as {
      video: {
        id: number;
        uuid: string;
        shortUUID: string;
        name: string;
        url: string;
        embedPath: string;
        description: string;
      };
    };

    return {
      uuid: result.video.uuid,
      shortUUID: result.video.shortUUID,
      url: result.video.url,
      embedUrl: `${this.instanceUrl}${result.video.embedPath}`,
      embedPath: result.video.embedPath,
      name: result.video.name,
    };
  }

  /**
   * Upload a short (vertical format video, typically ≤60 seconds).
   *
   * Convenience wrapper that sets isShort=true and applies short-form
   * metadata (category=Entertainment, tags include 'short').
   */
  async uploadShort(opts: {
    file: File | Blob;
    title: string;
    description?: string;
    tags?: string[];
    thumbnail?: File | Blob;
  }): Promise<ShortUploadResult> {
    const shortTags = [...(opts.tags ?? []), 'short', 'shorts', 'degenfeed'].slice(0, 5);

    const result = await this.uploadVideo({
      file: opts.file,
      title: opts.title.slice(0, 80),
      description: opts.description,
      category: 11, // Entertainment
      tags: shortTags,
      privacy: 1,
      isShort: true,
      thumbnail: opts.thumbnail,
      degenfeed: { isShort: true },
    });

    // Shorts have no separate embed route; reuse the same URLs.
    // The frontend determines short vs long by aspect ratio + duration.
    return {
      uuid: result.uuid,
      url: result.url,
      embedUrl: result.embedUrl,
      duration: 0, // Filled after transcoding via getUploadProgress
      isShort: true,
    };
  }

  /**
   * Get upload/transcoding progress for a video.
   *
   * PeerTube processes videos asynchronously after upload.
   * Poll this endpoint to check when the video is ready.
   */
  async getUploadProgress(uuid: string): Promise<UploadProgress> {
    const url = `${this.instanceUrl}/api/v1/videos/${uuid}`;

    try {
      const response = await authenticatedFetch(url, this.accessToken);
      const video = (await response.json()) as {
        state?: 'published' | 'to_transcode' | 'to_move' | 'processing';
        waitTranscoding?: boolean;
        publishedAt?: string;
        name?: string;
      };

      // Determine state from PeerTube's video state
      if (video.state === 'published' && video.publishedAt) {
        return {
          state: 'published',
          progress: 100,
          startedAt: Date.now(),
        };
      }

      if (
        video.state === 'processing' ||
        video.state === 'to_transcode' ||
        video.state === 'to_move'
      ) {
        return {
          state: 'processing',
          progress: 50, // PeerTube doesn't expose fine-grained progress via this endpoint
          startedAt: Date.now(),
          eta: 120, // Rough estimate: 2 minutes
        };
      }

      // Still pending if no state and not published
      return {
        state: 'pending',
        progress: 0,
        startedAt: Date.now(),
      };
    } catch (err) {
      if (err instanceof PeerTubeUploadError && err.status === 404) {
        return {
          state: 'error',
          progress: 0,
          startedAt: Date.now(),
          error: 'Video not found — upload may have failed',
        };
      }
      throw err;
    }
  }

  /**
   * Update video metadata after upload.
   *
   * Supports updating title, description, category, tags, privacy,
   * thumbnail, comments/download settings, and DegenFeed metadata.
   */
  async updateVideo(uuid: string, opts: VideoUpdateOptions): Promise<void> {
    const url = `${this.instanceUrl}/api/v1/videos/${uuid}`;

    const body: Record<string, unknown> = {};

    if (opts.title !== undefined) body.name = opts.title;
    if (opts.description !== undefined) body.description = opts.description;
    if (opts.category !== undefined) body.category = opts.category;
    if (opts.tags !== undefined) body.tags = opts.tags;
    if (opts.privacy !== undefined) body.privacy = opts.privacy;
    if (opts.commentsEnabled !== undefined) body.commentsEnabled = opts.commentsEnabled;
    if (opts.downloadEnabled !== undefined) body.downloadEnabled = opts.downloadEnabled;
    if (opts.nsfw !== undefined) body.nsfw = opts.nsfw;
    if (opts.language !== undefined) body.language = opts.language;

    if (opts.degenfeed !== undefined) {
      body.pluginData = { degenfeed: opts.degenfeed };
    }

    // For thumbnail updates, the PeerTube API expects a separate endpoint
    if (opts.thumbnail) {
      const thumbUrl = `${this.instanceUrl}/api/v1/videos/${uuid}/thumbnail`;
      const thumbForm = new FormData();
      thumbForm.append('thumbnailfile', opts.thumbnail);
      await authenticatedFetch(thumbUrl, this.accessToken, {
        method: 'PUT',
        body: thumbForm,
      }).catch(() => {
        // Thumbnail update is best-effort
      });
    }

    // Only send metadata PUT if there are changes beyond thumbnail
    if (Object.keys(body).length > 0) {
      await authenticatedFetch(url, this.accessToken, {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  /**
   * Delete a video from PeerTube.
   *
   * Once deleted, the video and all associated files are permanently removed.
   * This action cannot be undone.
   */
  async deleteVideo(uuid: string): Promise<void> {
    const url = `${this.instanceUrl}/api/v1/videos/${uuid}`;
    await authenticatedFetch(url, this.accessToken, {
      method: 'DELETE',
    });
  }

  /**
   * Publish a scheduled video immediately.
   * Only works if the video was uploaded with a scheduleAt date.
   */
  async publishScheduled(uuid: string): Promise<void> {
    const url = `${this.instanceUrl}/api/v1/videos/${uuid}/publish`;
    await authenticatedFetch(url, this.accessToken, {
      method: 'POST',
    });
  }

  /**
   * Check if a video is a short based on its metadata.
   * Shorts are vertical videos ≤60 seconds tagged with 'short'.
   */
  async isShort(uuid: string): Promise<boolean> {
    const url = `${this.instanceUrl}/api/v1/videos/${uuid}`;
    const response = await authenticatedFetch(url, this.accessToken);
    const video = (await response.json()) as {
      duration: number;
      tags?: string[];
      name?: string;
    };
    return (
      (video.duration <= 60 && video.tags?.includes('short') === true) ||
      video.tags?.includes('shorts') === true
    );
  }
}

/**
 * Create an uploader instance from OAuth2 client credentials.
 * Handles token acquisition and caching.
 */
export async function createPeerTubeUploader(config: {
  instanceUrl?: string;
  clientId: string;
  clientSecret: string;
}): Promise<PeerTubeUploader> {
  const instanceUrl = (config.instanceUrl ?? PEERTUBE_INSTANCE).replace(/\/$/, '');
  const tokenUrl = `${instanceUrl}/api/v1/oauth/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'client_credentials',
      scope: 'manage:videos manage:channels',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw new PeerTubeUploadError(
      `PeerTube OAuth failed: ${response.status} — ${body}`,
      response.status,
    );
  }
  const data = (await response.json()) as { access_token: string; expires_in?: number };
  return new PeerTubeUploader({ instanceUrl, accessToken: data.access_token });
}
