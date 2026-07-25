/**
 * @degenfeed/peertube-sdk — Complete PeerTube REST API Client
 *
 * Covers the full PeerTube REST API surface for the DegenFeed video platform.
 * Self-hosted instance: https://video.degenfeed.xyz (127.0.0.1:9011 internal).
 *
 * Sections:
 *   1. Videos       — list, get, upload, update, delete, rate
 *   2. Channels     — list, get, create, subscribe/unsubscribe
 *   3. Playlists    — list, get, create, add/remove videos
 *   4. Live Streams — create, start, stop, stream key, viewer count
 *   5. Comments     — list, create, reply, delete, report
 *   6. Accounts     — get profile, list videos, list channels
 *   7. Search       — unified search across videos, channels, playlists
 *   8. Federation   — following/followers list, instance blocklist
 *   9. Admin        — stats, users, abuse reports, config
 *
 * Usage:
 *   import { PeerTubeClient } from '@degenfeed/peertube-sdk';
 *   const client = new PeerTubeClient({ accessToken: '...' });
 *   const { data } = await client.videos.list({ limit: 20 });
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface PeerTubeClientConfig {
  /** PeerTube instance URL. Defaults to https://video.degenfeed.xyz */
  instanceUrl?: string;
  /** OAuth2 access token for authenticated requests. */
  accessToken?: string;
}

export interface PaginationParams {
  start?: number;
  count?: number;
  sort?: string;
}

export interface PaginatedResponse<T> {
  total: number;
  data: T[];
}

// 1. Videos ─────────────────────────────────────────────────────────

export interface VideoConstant {
  id: number;
  label: string;
}

export interface VideoFile {
  id: number;
  resolution: { id: number; label: string };
  size: number;
  fileUrl: string;
  torrentUrl: string;
  fileDownloadUrl: string;
  metadataUrl?: string;
}

export interface VideoStreamingPlaylist {
  id: number;
  type: number;
  playlistUrl: string;
  files: VideoFile[];
}

export interface VideoChannelInfo {
  id: number;
  name: string;
  displayName: string;
  url: string;
  avatar: { path: string } | null;
}

export interface VideoAccountInfo {
  id: number;
  name: string;
  displayName: string;
  url: string;
  avatar: { path: string } | null;
  host: string;
}

export interface PeerTubeVideo {
  id: number;
  uuid: string;
  shortUUID: string;
  name: string;
  description: string;
  shortDescription: string;
  isLive: boolean;
  duration: number;
  views: number;
  likes: number;
  dislikes: number;
  publishedAt: string;
  updatedAt: string;
  originallyPublishedAt: string | null;
  category: VideoConstant | null;
  licence: VideoConstant | null;
  language: VideoConstant | null;
  privacy: VideoConstant;
  nsfw: boolean;
  waitTranscoding: boolean;
  state: 'published' | 'to_transcode' | 'to_move' | 'processing' | 'ready';
  url: string;
  thumbnailPath: string | null;
  previewPath: string | null;
  embedPath: string;
  tags: string[];
  files: VideoFile[];
  streamingPlaylists: VideoStreamingPlaylist[];
  account: VideoAccountInfo | null;
  channel: VideoChannelInfo | null;
  commentsEnabled: boolean;
  downloadEnabled: boolean;
  trackerUrls: string[];
  liveInfo?: {
    viewerCount: number;
    health: 'good' | 'bad' | 'unknown';
    startedAt: string;
    state: 'waiting' | 'live' | 'ended' | 'error';
  };
  pluginData?: Record<string, unknown>;
}

export interface VideoListParams extends PaginationParams {
  categoryOneOf?: number[];
  languageOneOf?: string;
  tagsOneOf?: string;
  tagsAllOf?: string;
  isLive?: boolean;
  search?: string;
  channelId?: number;
  channelName?: string;
  nsfw?: boolean;
  hasHLSFiles?: boolean;
  hasWebVideoFiles?: boolean;
  include?: string[];
}

export interface VideoUploadOptions {
  file: File | Blob;
  name: string;
  description?: string;
  category?: number;
  licence?: number;
  language?: string;
  tags?: string[];
  nsfw?: boolean;
  waitTranscoding?: boolean;
  privacy?: 1 | 2 | 3;
  commentsEnabled?: boolean;
  downloadEnabled?: boolean;
  thumbnailfile?: File | Blob;
  previewfile?: File | Blob;
  scheduleUpdate?: {
    scheduleAt: string;
    update: Record<string, unknown>;
  };
  pluginData?: Record<string, unknown>;
}

export interface VideoUpdateOptions {
  name?: string;
  description?: string;
  category?: number;
  licence?: number;
  language?: string;
  tags?: string[];
  nsfw?: boolean;
  commentsEnabled?: boolean;
  downloadEnabled?: boolean;
  privacy?: 1 | 2 | 3;
  pluginData?: Record<string, unknown>;
}

export interface VideoRateOptions {
  rating: 'like' | 'dislike';
}

// 2. Channels ────────────────────────────────────────────────────────

export interface PeerTubeChannel {
  id: number;
  name: string;
  displayName: string;
  description: string;
  support: string;
  url: string;
  avatar: { path: string } | null;
  banner: { path: string } | null;
  ownerAccount: VideoAccountInfo | null;
  videosCount: number;
  viewsCount: number;
  followersCount: number;
  createdAt: string;
  updatedAt: string;
  pluginData?: Record<string, unknown>;
}

export interface ChannelCreateOptions {
  name: string;
  displayName: string;
  description?: string;
  support?: string;
  avatarfile?: File | Blob;
  bannerfile?: File | Blob;
}

export interface ChannelUpdateOptions {
  displayName?: string;
  description?: string;
  support?: string;
  avatarfile?: File | Blob;
  bannerfile?: File | Blob;
}

// 3. Playlists ───────────────────────────────────────────────────────

export interface PeerTubePlaylist {
  id: number;
  uuid: string;
  shortUUID: string;
  displayName: string;
  description: string;
  url: string;
  videosLength: number;
  type: 1 | 2; // 1=regular, 2=watch later
  channel: VideoChannelInfo | null;
  ownerAccount: VideoAccountInfo | null;
  createdAt: string;
  updatedAt: string;
  video?: PeerTubeVideo[];
}

export interface PlaylistCreateOptions {
  displayName: string;
  description?: string;
  type?: 1 | 2;
  videoIds?: number[];
}

export interface PlaylistUpdateOptions {
  displayName?: string;
  description?: string;
  videoIds?: number[];
}

// 4. Live Streams ────────────────────────────────────────────────────

export interface LiveStreamCreateOptions {
  channelId: number;
  name: string;
  description?: string;
  privacy?: 1 | 2 | 3;
  category?: number;
  tags?: string[];
  nsfw?: boolean;
  commentsEnabled?: boolean;
  downloadEnabled?: boolean;
  saveReplay?: boolean;
  pluginData?: Record<string, unknown>;
}

export interface LiveStreamCreateResult {
  video: {
    id: number;
    uuid: string;
    shortUUID: string;
    name: string;
    url: string;
    embedPath: string;
  };
  liveSession?: {
    id: number;
    rtmpUrl?: string;
    streamKey?: string;
  };
}

export interface LiveSessionResult {
  id: number;
  rtmpUrl: string;
  streamKey: string;
  viewerCount: number;
  health: 'good' | 'bad' | 'unknown';
  startedAt: string;
  state: 'waiting' | 'live' | 'ended' | 'error';
}

export interface LiveChatMessage {
  id: string;
  displayName: string;
  accountName: string;
  message: string;
  createdAt: string;
  isOwner: boolean;
}

// 5. Comments ────────────────────────────────────────────────────────

export interface PeerTubeComment {
  id: number;
  text: string;
  textHtml: string;
  createdAt: string;
  updatedAt: string;
  totalReplies: number;
  account: VideoAccountInfo | null;
  videoId: number;
  inlinePath: string;
  url: string;
  deleted: boolean;
  deletedAt?: string;
}

export interface CommentCreateOptions {
  text: string;
}

export interface CommentReportOptions {
  reason: string;
}

// 6. Accounts ────────────────────────────────────────────────────────

export interface PeerTubeAccount {
  id: number;
  name: string;
  displayName: string;
  description: string;
  url: string;
  host: string;
  avatar: { path: string } | null;
  banner: { path: string } | null;
  followingCount: number;
  followersCount: number;
  createdAt: string;
  updatedAt: string;
  userId?: number;
  pluginData?: Record<string, unknown>;
}

// 7. Search ─────────────────────────────────────────────────────────

export interface SearchParams extends PaginationParams {
  search: string;
  categoryOneOf?: number[];
  languageOneOf?: string;
  tagsOneOf?: string;
  isLive?: boolean;
  nsfw?: boolean;
  start?: number;
  count?: number;
  sort?: string;
}

export interface SearchResults {
  videos: PaginatedResponse<PeerTubeVideo>;
  channels: PaginatedResponse<PeerTubeChannel>;
  playlists: PaginatedResponse<PeerTubePlaylist>;
}

// 8. Federation ─────────────────────────────────────────────────────

export interface PeerTubeFollower {
  id: number;
  follower: {
    id: number;
    name: string;
    displayName: string;
    host: string;
    url: string;
    avatar: { path: string } | null;
  };
  state: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface PeerTubeFollowing {
  id: number;
  following: {
    id: number;
    name: string;
    displayName: string;
    host: string;
    url: string;
    avatar: { path: string } | null;
  };
  state: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface FederationHealthResult {
  status: 'up' | 'degraded' | 'down';
  following: number;
  followers: number;
  pendingFollows: number;
  reachablePercent: number;
  instancesReachable: number;
  instancesTotal: number;
  latencyMs: number;
  lastChecked: number;
  errors: string[];
}

// 9. Admin ──────────────────────────────────────────────────────────

export interface PeerTubeStats {
  totalUsers: number;
  totalActiveUsers: number;
  totalVideos: number;
  totalLocalVideos: number;
  totalViews: number;
  totalLocalViews: number;
  totalComments: number;
  totalLocalComments: number;
  totalChannels: number;
  totalLocalChannels: number;
  totalPlaylists: number;
  diskUsage: number;
  totalVideoFilesSize: number;
}

export interface PeerTubeUser {
  id: number;
  username: string;
  email: string | null;
  displayName: string;
  role: { id: number; label: string };
  autoPlayVideo: boolean;
  autoPlayNextVideo: boolean;
  createdAt: string;
  videosCount: number;
  videoQuota: number;
  videoQuotaUsed: number;
  blocked: boolean;
  pluginData?: Record<string, unknown>;
}

export interface AbuseReport {
  id: number;
  reason: string;
  reportedAccount: VideoAccountInfo | null;
  reportedVideo: PeerTubeVideo | null;
  reporterAccount: VideoAccountInfo | null;
  state: 'pending' | 'resolved' | 'rejected';
  createdAt: string;
  moderationComment?: string;
}

export interface AbuseReportCreateOptions {
  reason: string;
  videoId?: number;
  accountId?: number;
  commentId?: number;
  predefinedReason?: string;
}

// ─── API Error ─────────────────────────────────────────────────────

export class PeerTubeApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'PeerTubeApiError';
  }
}

// ─── HTTP Helpers ──────────────────────────────────────────────────

function buildUrl(
  base: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const url = new URL(`${base.replace(/\/$/, '')}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function apiFetch(
  baseUrl: string,
  path: string,
  options: RequestInit & { params?: Record<string, string | number | boolean | undefined> } = {},
  accessToken?: string,
): Promise<Response> {
  const url = buildUrl(baseUrl, path, options.params);
  const headers = new Headers(options.headers);

  headers.set('accept', 'application/json');
  headers.set('user-agent', 'DegenFeed-PeerTube-SDK/0.1');

  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  // Don't set content-type for FormData (browser sets boundary)
  if (options.body && typeof options.body === 'string' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => undefined);
    }
    throw new PeerTubeApiError(
      `PeerTube API error: ${response.status} ${response.statusText}`,
      response.status,
      body,
    );
  }

  return response;
}

// ─── Category Constants ────────────────────────────────────────────

export const PEERTUBE_CATEGORIES: Record<number, string> = {
  1: 'Music',
  2: 'Films',
  3: 'Comics',
  4: 'Books',
  5: 'Science & Technology',
  6: 'Sports',
  7: 'Lifestyle',
  8: 'Art',
  9: 'Gaming',
  10: 'Entertainment',
  11: 'News & Politics',
  12: 'Education',
  13: 'Tech',
  14: 'Crypto & Web3',
};

// ─── Main Client ───────────────────────────────────────────────────

export class PeerTubeClient {
  private instanceUrl: string;
  private accessToken?: string;

  constructor(config: PeerTubeClientConfig = {}) {
    this.instanceUrl = (config.instanceUrl ?? 'https://video.degenfeed.xyz').replace(/\/$/, '');
    this.accessToken = config.accessToken;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  getInstanceUrl(): string {
    return this.instanceUrl;
  }

  private fetch(
    path: string,
    options: RequestInit & { params?: Record<string, string | number | boolean | undefined> } = {},
  ): Promise<Response> {
    return apiFetch(this.instanceUrl, path, options, this.accessToken);
  }

  // ══════════════════════════════════════════════════════════════
  // 1. VIDEOS
  // ══════════════════════════════════════════════════════════════

  videos = {
    list: (params?: VideoListParams): Promise<PaginatedResponse<PeerTubeVideo>> =>
      this.fetch('/api/v1/videos', {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),

    get: (id: string): Promise<PeerTubeVideo> =>
      this.fetch(`/api/v1/videos/${id}`).then((r) => r.json()),

    upload: async (opts: VideoUploadOptions): Promise<{ video: PeerTubeVideo }> => {
      const formData = new FormData();
      formData.append('videofile', opts.file, (opts.file as File).name ?? 'video.mp4');
      formData.append('name', opts.name.slice(0, 120));
      formData.append('privacy', String(opts.privacy ?? 1));
      formData.append('commentsEnabled', String(opts.commentsEnabled ?? true));
      formData.append('downloadEnabled', String(opts.downloadEnabled ?? false));
      formData.append('nsfw', String(opts.nsfw ?? false));
      formData.append('waitTranscoding', String(opts.waitTranscoding ?? true));

      if (opts.description) formData.append('description', opts.description);
      if (opts.category) formData.append('category', String(opts.category));
      if (opts.licence) formData.append('licence', String(opts.licence));
      if (opts.language) formData.append('language', opts.language);
      if (opts.tags?.length) {
        for (const tag of opts.tags.slice(0, 5)) formData.append('tags', tag);
      }
      if (opts.thumbnailfile) formData.append('thumbnailfile', opts.thumbnailfile);
      if (opts.previewfile) formData.append('previewfile', opts.previewfile);
      if (opts.scheduleUpdate)
        formData.append('scheduleUpdate', JSON.stringify(opts.scheduleUpdate));
      if (opts.pluginData) formData.append('pluginData', JSON.stringify(opts.pluginData));

      const response = await this.fetch('/api/v1/videos/upload', {
        method: 'POST',
        body: formData,
      });
      return response.json();
    },

    update: (id: string, opts: VideoUpdateOptions): Promise<void> =>
      this.fetch(`/api/v1/videos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(opts),
      }).then(() => {}),

    delete: (id: string): Promise<void> =>
      this.fetch(`/api/v1/videos/${id}`, { method: 'DELETE' }).then(() => {}),

    rate: (id: string, rating: 'like' | 'dislike'): Promise<void> =>
      this.fetch(`/api/v1/videos/${id}/rate`, {
        method: 'PUT',
        body: JSON.stringify({ rating }),
      }).then(() => {}),

    updateThumbnail: (id: string, thumbnailfile: File | Blob): Promise<void> => {
      const formData = new FormData();
      formData.append('thumbnailfile', thumbnailfile);
      return this.fetch(`/api/v1/videos/${id}/thumbnail`, {
        method: 'PUT',
        body: formData,
      }).then(() => {});
    },

    updatePreview: (id: string, previewfile: File | Blob): Promise<void> => {
      const formData = new FormData();
      formData.append('previewfile', previewfile);
      return this.fetch(`/api/v1/videos/${id}/preview`, {
        method: 'PUT',
        body: formData,
      }).then(() => {});
    },

    publish: (id: string): Promise<void> =>
      this.fetch(`/api/v1/videos/${id}/publish`, { method: 'POST' }).then(() => {}),
  };

  // ══════════════════════════════════════════════════════════════
  // 2. CHANNELS
  // ══════════════════════════════════════════════════════════════

  channels = {
    list: (
      params?: PaginationParams & { namePattern?: string },
    ): Promise<PaginatedResponse<PeerTubeChannel>> =>
      this.fetch('/api/v1/video-channels', {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),

    get: (name: string): Promise<PeerTubeChannel> =>
      this.fetch(`/api/v1/video-channels/${name}`).then((r) => r.json()),

    create: async (opts: ChannelCreateOptions): Promise<PeerTubeChannel> => {
      const body: Record<string, string | undefined> = {
        name: opts.name,
        displayName: opts.displayName,
        description: opts.description,
        support: opts.support,
      };

      const formData = new FormData();
      formData.append('displayName', opts.displayName);
      formData.append('name', opts.name);
      if (opts.description) formData.append('description', opts.description);
      if (opts.support) formData.append('support', opts.support);
      if (opts.avatarfile) formData.append('avatarfile', opts.avatarfile);
      if (opts.bannerfile) formData.append('bannerfile', opts.bannerfile);

      const response = await this.fetch('/api/v1/video-channels', {
        method: 'POST',
        body: formData,
      });
      return response.json();
    },

    update: (name: string, opts: ChannelUpdateOptions): Promise<void> =>
      this.fetch(`/api/v1/video-channels/${name}`, {
        method: 'PUT',
        body: JSON.stringify(opts),
      }).then(() => {}),

    delete: (name: string): Promise<void> =>
      this.fetch(`/api/v1/video-channels/${name}`, { method: 'DELETE' }).then(() => {}),

    subscribe: (name: string): Promise<void> =>
      this.fetch(`/api/v1/video-channels/${name}/subscribe`, { method: 'POST' }).then(() => {}),

    unsubscribe: (name: string): Promise<void> =>
      this.fetch(`/api/v1/video-channels/${name}/subscribe`, { method: 'DELETE' }).then(() => {}),

    videos: (name: string, params?: PaginationParams): Promise<PaginatedResponse<PeerTubeVideo>> =>
      this.fetch(`/api/v1/video-channels/${name}/videos`, {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),
  };

  // ══════════════════════════════════════════════════════════════
  // 3. PLAYLISTS
  // ══════════════════════════════════════════════════════════════

  playlists = {
    list: (params?: PaginationParams): Promise<PaginatedResponse<PeerTubePlaylist>> =>
      this.fetch('/api/v1/video-playlists', {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),

    get: (id: string): Promise<PeerTubePlaylist> =>
      this.fetch(`/api/v1/video-playlists/${id}`).then((r) => r.json()),

    create: (opts: PlaylistCreateOptions): Promise<PeerTubePlaylist> =>
      this.fetch('/api/v1/video-playlists', {
        method: 'POST',
        body: JSON.stringify(opts),
      }).then((r) => r.json()),

    update: (id: string, opts: PlaylistUpdateOptions): Promise<void> =>
      this.fetch(`/api/v1/video-playlists/${id}`, {
        method: 'PUT',
        body: JSON.stringify(opts),
      }).then(() => {}),

    delete: (id: string): Promise<void> =>
      this.fetch(`/api/v1/video-playlists/${id}`, { method: 'DELETE' }).then(() => {}),

    addVideo: (playlistId: string, videoId: number): Promise<void> =>
      this.fetch(`/api/v1/video-playlists/${playlistId}/videos`, {
        method: 'POST',
        body: JSON.stringify({ videoId }),
      }).then(() => {}),

    removeVideo: (playlistId: string, playlistElementId: number): Promise<void> =>
      this.fetch(`/api/v1/video-playlists/${playlistId}/videos/${playlistElementId}`, {
        method: 'DELETE',
      }).then(() => {}),

    videos: (id: string, params?: PaginationParams): Promise<PaginatedResponse<PeerTubeVideo>> =>
      this.fetch(`/api/v1/video-playlists/${id}/videos`, {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),
  };

  // ══════════════════════════════════════════════════════════════
  // 4. LIVE STREAMS
  // ══════════════════════════════════════════════════════════════

  live = {
    create: async (opts: LiveStreamCreateOptions): Promise<LiveStreamCreateResult> => {
      const response = await this.fetch('/api/v1/videos/live-streams', {
        method: 'POST',
        body: JSON.stringify(opts),
      });
      return response.json();
    },

    update: (uuid: string, opts: Partial<LiveStreamCreateOptions>): Promise<void> =>
      this.fetch(`/api/v1/videos/live-streams/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify(opts),
      }).then(() => {}),

    session: async (videoId: number): Promise<LiveSessionResult> => {
      const response = await this.fetch(`/api/v1/videos/${videoId}/live-session`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return response.json();
    },

    getSession: (videoId: number): Promise<LiveSessionResult> =>
      this.fetch(`/api/v1/videos/${videoId}/live-session`).then((r) => r.json()),

    end: (videoId: number): Promise<void> =>
      this.fetch(`/api/v1/videos/${videoId}`, { method: 'DELETE' }).then(() => {}),

    listActive: (
      params?: PaginationParams & { channelId?: number },
    ): Promise<PaginatedResponse<PeerTubeVideo>> => {
      const p = { ...params, isLive: true };
      return this.fetch('/api/v1/videos', {
        params: p as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json());
    },

    getChat: (
      uuid: string,
      cursor?: string,
    ): Promise<{ data: LiveChatMessage[]; total: number; cursor?: string }> => {
      const params = cursor ? { cursor } : undefined;
      return this.fetch(`/api/v1/videos/${uuid}/live-chat`, { params }).then((r) => r.json());
    },

    sendChat: (uuid: string, message: string): Promise<void> =>
      this.fetch(`/api/v1/videos/${uuid}/live-chat`, {
        method: 'POST',
        body: JSON.stringify({ message: message.slice(0, 500) }),
      }).then(() => {}),

    deleteChat: (uuid: string, messageId: string): Promise<void> =>
      this.fetch(`/api/v1/videos/${uuid}/live-chat/${messageId}`, { method: 'DELETE' }).then(
        () => {},
      ),
  };

  // ══════════════════════════════════════════════════════════════
  // 5. COMMENTS
  // ══════════════════════════════════════════════════════════════

  comments = {
    list: (
      videoId: string,
      params?: PaginationParams,
    ): Promise<PaginatedResponse<PeerTubeComment>> =>
      this.fetch(`/api/v1/videos/${videoId}/comments`, {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),

    replies: (
      videoId: string,
      commentId: number,
      params?: PaginationParams,
    ): Promise<PaginatedResponse<PeerTubeComment>> =>
      this.fetch(`/api/v1/videos/${videoId}/comments/${commentId}`, {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),

    create: (videoId: string, opts: CommentCreateOptions): Promise<PeerTubeComment> =>
      this.fetch(`/api/v1/videos/${videoId}/comments`, {
        method: 'POST',
        body: JSON.stringify(opts),
      }).then((r) => r.json()),

    reply: (
      videoId: string,
      commentId: number,
      opts: CommentCreateOptions,
    ): Promise<PeerTubeComment> =>
      this.fetch(`/api/v1/videos/${videoId}/comments/${commentId}`, {
        method: 'POST',
        body: JSON.stringify(opts),
      }).then((r) => r.json()),

    delete: (videoId: string, commentId: number): Promise<void> =>
      this.fetch(`/api/v1/videos/${videoId}/comments/${commentId}`, { method: 'DELETE' }).then(
        () => {},
      ),

    report: (videoId: string, commentId: number, opts: CommentReportOptions): Promise<void> =>
      this.fetch(`/api/v1/videos/${videoId}/comments/${commentId}/abuse`, {
        method: 'POST',
        body: JSON.stringify(opts),
      }).then(() => {}),
  };

  // ══════════════════════════════════════════════════════════════
  // 6. ACCOUNTS
  // ══════════════════════════════════════════════════════════════

  accounts = {
    get: (name: string): Promise<PeerTubeAccount> =>
      this.fetch(`/api/v1/accounts/${name}`).then((r) => r.json()),

    videos: (name: string, params?: PaginationParams): Promise<PaginatedResponse<PeerTubeVideo>> =>
      this.fetch(`/api/v1/accounts/${name}/videos`, {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),

    channels: (
      name: string,
      params?: PaginationParams,
    ): Promise<PaginatedResponse<PeerTubeChannel>> =>
      this.fetch(`/api/v1/accounts/${name}/video-channels`, {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),

    ratings: (
      name: string,
      params?: PaginationParams & { rating?: 'like' | 'dislike' },
    ): Promise<PaginatedResponse<PeerTubeVideo>> =>
      this.fetch(`/api/v1/accounts/${name}/ratings`, {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),
  };

  // ══════════════════════════════════════════════════════════════
  // 7. SEARCH
  // ══════════════════════════════════════════════════════════════

  search = {
    all: async (params: SearchParams): Promise<SearchResults> => {
      const response = await this.fetch('/api/v1/search/videos', {
        params: params as Record<string, string | number | boolean | undefined>,
      });
      const videos = (await response.json()) as PaginatedResponse<PeerTubeVideo>;

      // Also search channels and playlists in parallel
      const [channels, playlists] = await Promise.all([
        this.fetch('/api/v1/search/video-channels', {
          params: params as Record<string, string | number | boolean | undefined>,
        })
          .then((r) => r.json() as Promise<PaginatedResponse<PeerTubeChannel>>)
          .catch(() => ({ total: 0, data: [] })),
        this.fetch('/api/v1/search/video-playlists', {
          params: params as Record<string, string | number | boolean | undefined>,
        })
          .then((r) => r.json() as Promise<PaginatedResponse<PeerTubePlaylist>>)
          .catch(() => ({ total: 0, data: [] })),
      ]);

      return { videos, channels, playlists };
    },

    videos: (params: SearchParams): Promise<PaginatedResponse<PeerTubeVideo>> =>
      this.fetch('/api/v1/search/videos', {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),

    channels: (params: SearchParams): Promise<PaginatedResponse<PeerTubeChannel>> =>
      this.fetch('/api/v1/search/video-channels', {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),

    playlists: (params: SearchParams): Promise<PaginatedResponse<PeerTubePlaylist>> =>
      this.fetch('/api/v1/search/video-playlists', {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),
  };

  // ══════════════════════════════════════════════════════════════
  // 8. FEDERATION
  // ══════════════════════════════════════════════════════════════

  federation = {
    following: (params?: PaginationParams): Promise<PaginatedResponse<PeerTubeFollowing>> =>
      this.fetch('/api/v1/server/following', {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),

    followers: (params?: PaginationParams): Promise<PaginatedResponse<PeerTubeFollower>> =>
      this.fetch('/api/v1/server/followers', {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),

    acceptFollower: (followerId: number): Promise<void> =>
      this.fetch(`/api/v1/server/followers/${followerId}/accept`, { method: 'POST' }).then(
        () => {},
      ),

    rejectFollower: (followerId: number): Promise<void> =>
      this.fetch(`/api/v1/server/followers/${followerId}/reject`, { method: 'POST' }).then(
        () => {},
      ),

    removeFollower: (followerId: number): Promise<void> =>
      this.fetch(`/api/v1/server/followers/${followerId}`, { method: 'DELETE' }).then(() => {}),

    follow: (hosts: string[]): Promise<void> =>
      this.fetch('/api/v1/server/following', {
        method: 'POST',
        body: JSON.stringify({ hosts }),
      }).then(() => {}),

    unfollow: (followingId: number): Promise<void> =>
      this.fetch(`/api/v1/server/following/${followingId}`, { method: 'DELETE' }).then(() => {}),

    blocklist: (
      params?: PaginationParams,
    ): Promise<PaginatedResponse<{ id: number; host: string; createdAt: string }>> =>
      this.fetch('/api/v1/server/blocklist', {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),

    blockInstance: (host: string): Promise<void> =>
      this.fetch('/api/v1/server/blocklist', {
        method: 'POST',
        body: JSON.stringify({ host }),
      }).then(() => {}),

    unblockInstance: (blocklistId: number): Promise<void> =>
      this.fetch(`/api/v1/server/blocklist/${blocklistId}`, { method: 'DELETE' }).then(() => {}),

    /** Health check: ping followed instances and measure reachability. */
    health: async (): Promise<FederationHealthResult> => {
      const start = performance.now();
      const errors: string[] = [];

      try {
        const [followingRes, followersRes] = await Promise.all([
          this.federation.following({ count: 100 }),
          this.federation.followers({ count: 100 }),
        ]);

        const pendingFollows =
          followingRes.data.filter((f) => f.state === 'pending').length +
          followersRes.data.filter((f) => f.state === 'pending').length;

        // Measure reachability of followed instances
        const instancesToCheck = [
          ...followingRes.data.map((f) => f.following.host),
          ...followersRes.data.map((f) => f.follower.host),
        ].filter(Boolean);

        let reachable = 0;
        const uniqueHosts = [...new Set(instancesToCheck)];
        const results = await Promise.allSettled(
          uniqueHosts.map((host) =>
            fetch(`https://${host}/api/v1/config`, { signal: AbortSignal.timeout(5000) }).then(
              (r) => r.ok,
            ),
          ),
        );
        reachable = results.filter((r) => r.status === 'fulfilled' && r.value).length;

        const latencyMs = Math.round(performance.now() - start);

        const reachablePercent =
          uniqueHosts.length > 0 ? Math.round((reachable / uniqueHosts.length) * 100) : 100;

        return {
          status: reachablePercent >= 80 ? 'up' : reachablePercent >= 50 ? 'degraded' : 'down',
          following: followingRes.total,
          followers: followersRes.total,
          pendingFollows,
          reachablePercent,
          instancesReachable: reachable,
          instancesTotal: uniqueHosts.length,
          latencyMs,
          lastChecked: Date.now(),
          errors,
        };
      } catch (err) {
        const latencyMs = Math.round(performance.now() - start);
        return {
          status: 'down',
          following: 0,
          followers: 0,
          pendingFollows: 0,
          reachablePercent: 0,
          instancesReachable: 0,
          instancesTotal: 0,
          latencyMs,
          lastChecked: Date.now(),
          errors: [err instanceof Error ? err.message : String(err)],
        };
      }
    },
  };

  // ══════════════════════════════════════════════════════════════
  // 9. ADMIN
  // ══════════════════════════════════════════════════════════════

  admin = {
    stats: (): Promise<PeerTubeStats> => this.fetch('/api/v1/server/stats').then((r) => r.json()),

    config: <T = Record<string, unknown>>(): Promise<T> =>
      this.fetch('/api/v1/config').then((r) => r.json()),

    users: {
      list: (
        params?: PaginationParams & { blocked?: boolean },
      ): Promise<PaginatedResponse<PeerTubeUser>> =>
        this.fetch('/api/v1/users', {
          params: params as Record<string, string | number | boolean | undefined>,
        }).then((r) => r.json()),

      get: (id: number): Promise<PeerTubeUser> =>
        this.fetch(`/api/v1/users/${id}`).then((r) => r.json()),

      block: (id: number): Promise<void> =>
        this.fetch(`/api/v1/users/${id}/block`, { method: 'POST' }).then(() => {}),

      unblock: (id: number): Promise<void> =>
        this.fetch(`/api/v1/users/${id}/unblock`, { method: 'POST' }).then(() => {}),

      delete: (id: number): Promise<void> =>
        this.fetch(`/api/v1/users/${id}`, { method: 'DELETE' }).then(() => {}),
    },

    abuses: {
      list: (
        params?: PaginationParams & { state?: 'pending' | 'resolved' | 'rejected' },
      ): Promise<PaginatedResponse<AbuseReport>> =>
        this.fetch('/api/v1/abuses', {
          params: params as Record<string, string | number | boolean | undefined>,
        }).then((r) => r.json()),

      get: (id: number): Promise<AbuseReport> =>
        this.fetch(`/api/v1/abuses/${id}`).then((r) => r.json()),

      create: (opts: AbuseReportCreateOptions): Promise<{ abuse: { id: number } }> =>
        this.fetch('/api/v1/abuses', {
          method: 'POST',
          body: JSON.stringify(opts),
        }).then((r) => r.json()),

      resolve: (id: number, comment?: string): Promise<void> =>
        this.fetch(`/api/v1/abuses/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ state: 'resolved', moderationComment: comment }),
        }).then(() => {}),
    },

    logs: (
      params?: PaginationParams & { level?: 'info' | 'warn' | 'error' },
    ): Promise<
      PaginatedResponse<{ id: number; level: string; message: string; createdAt: string }>
    > =>
      this.fetch('/api/v1/server/logs', {
        params: params as Record<string, string | number | boolean | undefined>,
      }).then((r) => r.json()),
  };
}

// ─── Health Check ──────────────────────────────────────────────────

export async function peerTubeHealthCheck(
  instanceUrl = 'https://video.degenfeed.xyz',
  accessToken?: string,
): Promise<{
  healthy: boolean;
  latencyMs: number;
  instanceName?: string;
  version?: string;
}> {
  const start = performance.now();
  try {
    const response = await apiFetch(instanceUrl, '/api/v1/config', {}, accessToken);
    const latencyMs = Math.round(performance.now() - start);
    if (!response.ok) return { healthy: false, latencyMs };

    const config = (await response.json()) as {
      instance?: { name?: string };
      serverVersion?: string;
    };
    return {
      healthy: true,
      latencyMs,
      instanceName: config.instance?.name,
      version: config.serverVersion,
    };
  } catch {
    return { healthy: false, latencyMs: Math.round(performance.now() - start) };
  }
}

// ─── OAuth2 Token Helper ──────────────────────────────────────────

export async function getPeerTubeAccessToken(
  instanceUrl: string,
  clientId: string,
  clientSecret: string,
  scope = 'manage:videos manage:channels manage:live',
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = `${instanceUrl.replace(/\/$/, '')}/api/v1/oauth/token`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw new PeerTubeApiError(
      `PeerTube OAuth failed: ${response.status} — ${body}`,
      response.status,
    );
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}
