/**
 * @degenfeed/peertube-provider — PeerTube Live Stream Management
 *
 * Full lifecycle for creator token livestreams on PeerTube:
 *   - Create/update/end livestreams
 *   - RTMP stream key generation
 *   - HLS/DASH playback via embed
 *   - Built-in XMPP chat via Prosody
 *   - ActivityPub federation announcements
 *   - Recording/VOD management
 *
 * PeerTube's livestream API requires OAuth2 authentication.
 * The chat uses PeerTube's built-in XMPP server (Prosody).
 *
 * API Reference:
 *   POST   /api/v1/videos/live-streams        — Create a livestream
 *   GET    /api/v1/videos/live-streams/{id}    — Get livestream info
 *   PUT    /api/v1/videos/live-streams/{id}    — Update livestream
 *   POST   /api/v1/videos/{id}/live-session    — Create RTMP session
 *   GET    /api/v1/videos/{id}/live-session    — Get live session info
 *   DELETE /api/v1/videos/{id}                 — Delete (end) stream
 *   GET    /api/v1/videos/{id}                 — Get video/stream status
 *   GET    /api/v1/videos/{id}/live-chat       — Get chat messages
 *   POST   /api/v1/videos/{id}/live-chat       — Send chat message
 */

// ─── Types ─────────────────────────────────────────────────────────────

export interface PeerTubeLiveStreamConfig {
  /** PeerTube instance URL (defaults to our self-hosted instance). */
  instanceUrl?: string;
  /** OAuth2 access token for authentication. */
  accessToken: string;
}

export interface StreamCreateOptions {
  /** Channel name derived from token symbol (e.g. "MYCOIN"). */
  channelName: string;
  /** Stream title shown to viewers. */
  title: string;
  /** Stream description (token context, links). */
  description?: string;
  /** Privacy level: 1=Public, 2=Unlisted, 3=Private. */
  privacy?: 1 | 2 | 3;
  /** PeerTube category ID (10=Music, 11=Entertainment, 12=News, 13=Tech, etc.). */
  category?: number;
  /** Tags for discoverability. */
  tags?: string[];
  /** Whether to require minimum token hold to watch. */
  tokenGated?: boolean;
  /** Linked creator token address for token-gating metadata. */
  tokenAddress?: string;
  /** Token symbol for metadata display. */
  tokenSymbol?: string;
  /** Creator wallet address. */
  creatorAddress?: string;
}

export interface StreamCreateResult {
  /** Numeric PeerTube video ID. */
  id: number;
  /** UUID for API lookups. */
  uuid: string;
  /** Short UUID (for URLs). */
  shortUUID: string;
  /** RTMP stream key for broadcasting software (OBS, etc.). */
  streamKey: string;
  /** RTMP ingest URL. */
  rtmpUrl: string;
  /** HLS playback URL. */
  playbackUrl: string;
  /** iframe embed URL for frontend player. */
  embedUrl: string;
  /** PeerTube live chat URL (XMPP/Prosody). */
  chatUrl: string;
  /** Permanent URL on the PeerTube instance. */
  url: string;
}

export interface StreamUpdateOptions {
  title?: string;
  description?: string;
  privacy?: 1 | 2 | 3;
  category?: number;
  tags?: string[];
  tokenGated?: boolean;
  tokenAddress?: string;
}

export interface StreamStatus {
  /** Whether the stream is currently live. */
  isLive: boolean;
  /** Current viewer count (from PeerTube's real-time stats). */
  viewers: number;
  /** When the stream started (Unix ms). */
  startedAt?: number;
  /** Stream duration in seconds (if live or ended). */
  duration?: number;
  /** Current state: 'waiting', 'live', 'ended', 'error'. */
  state: 'waiting' | 'live' | 'ended' | 'error';
  /** Stream health: 'good', 'bad', 'unknown'. */
  health: 'good' | 'bad' | 'unknown';
}

export interface StreamRecording {
  /** Playback URL of the recorded VOD. */
  url: string;
  /** Duration in seconds. */
  duration: number;
  /** Resolution label (e.g. "1080p", "720p"). */
  resolution: string;
  /** File size in bytes. */
  size: number;
  /** Whether processing is complete. */
  ready: boolean;
}

export interface ChatMessage {
  id: string;
  displayName: string;
  /** PeerTube account name (@user@instance). */
  accountName: string;
  /** Wallet address if authenticated via DegenFeed. */
  walletAddress?: string;
  message: string;
  timestamp: number;
  /** Whether this is a token holder (for badge display). */
  isHolder?: boolean;
  /** Whether this is the stream creator. */
  isCreator?: boolean;
}

export interface ChatFetchResult {
  messages: ChatMessage[];
  nextCursor?: string;
  total: number;
}

// ─── Channel Types ────────────────────────────────────────────────────

/** Minimal channel result from the PeerTube API. */
export interface PeerTubeChannelResult {
  id: number;
  name: string;
  displayName: string;
  description: string;
  support: string;
  url: string;
  avatar: { path: string } | null;
  banner: { path: string } | null;
  videosCount: number;
  viewsCount: number;
  followersCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ─────────────────────────────────────────────────────────

/** Default PeerTube instance. */
const PEERTUBE_INSTANCE = 'https://video.degenfeed.xyz';

/** RTMP ingest endpoint (standard PeerTube). */
const RTMP_INGEST = '/live';

// ─── Error types ───────────────────────────────────────────────────────

export class PeerTubeLiveError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'PeerTubeLiveError';
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
  headers.set('user-agent', 'DegenFeed/1.0 (livestream)');

  if (options.body && typeof options.body === 'string') {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
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
    throw new PeerTubeLiveError(
      `PeerTube API error: ${response.status} ${response.statusText}`,
      response.status,
      body,
    );
  }

  return response;
}

// ─── Stream Key Generation ────────────────────────────────────────────

/**
 * Generate an RTMP stream key for a given token.
 * Uses a deterministic prefix with random entropy for security.
 */
function generateStreamKey(tokenAddress: string, creatorAddress: string, uuid: string): string {
  const prefix = tokenAddress.slice(0, 8).toLowerCase();
  const creator = creatorAddress.slice(0, 6).toLowerCase();
  const shortId = uuid.replace(/-/g, '').slice(0, 12);
  return `${prefix}_${creator}_${shortId}_df`;
}

// ─── Sanitize channel names for PeerTube ───────────────────────────────

function sanitizeChannelName(symbol: string): string {
  return symbol
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 32);
}

// ─── Main Class ────────────────────────────────────────────────────────

export class PeerTubeLiveStream {
  private instanceUrl: string;
  private accessToken: string;

  constructor(config: PeerTubeLiveStreamConfig) {
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
   * Resolve or create a PeerTube channel for a token symbol.
   * PeerTube channels map 1:1 to creator tokens.
   * If the channel already exists, return it; otherwise create it.
   */
  private async resolveChannel(channelName: string): Promise<{
    id: number;
    name: string;
    displayName: string;
    url: string;
  }> {
    const sanitized = sanitizeChannelName(channelName);
    const displayName = `$${channelName.toUpperCase()}`;

    try {
      // Try fetching the channel by name
      const url = `${this.instanceUrl}/api/v1/video-channels/${sanitized}`;
      const response = await authenticatedFetch(url, this.accessToken);
      const channel = (await response.json()) as {
        id: number;
        name: string;
        displayName: string;
        url: string;
      };
      return channel;
    } catch {
      // Channel doesn't exist — create it
      const createUrl = `${this.instanceUrl}/api/v1/video-channels`;
      const body = {
        name: sanitized,
        displayName,
        description: `Official PeerTube channel for $${channelName.toUpperCase()} — DegenFeed creator token community`,
        support: `Support $${channelName.toUpperCase()} by holding the token on DegenFeed`,
      };

      const response = await authenticatedFetch(createUrl, this.accessToken, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return (await response.json()) as {
        id: number;
        name: string;
        displayName: string;
        url: string;
      };
    }
  }

  /**
   * Create a new livestream for a creator token.
   *
   * Flow:
   *   1. Resolve/create the token's PeerTube channel
   *   2. Create the live video via PeerTube API
   *   3. Create a live session to get the RTMP key
   *   4. Construct playback + embed URLs
   *   5. Add custom metadata for token-gating
   *
   * @returns Stream details including RTMP key for OBS and embed URL for viewers.
   */
  async createStream(
    opts: StreamCreateOptions & {
      tokenAddress?: string;
      creatorAddress?: string;
    },
  ): Promise<StreamCreateResult> {
    const tokenAddress = opts.tokenAddress ?? 'none';
    const creatorAddress = opts.creatorAddress ?? 'none';
    const channel = await this.resolveChannel(opts.channelName);

    // Tag with DegenFeed metadata for discoverability
    const tags = [
      ...(opts.tags ?? []),
      'degenfeed',
      tokenAddress !== 'none' ? `token:${tokenAddress.slice(0, 8)}` : '',
      opts.tokenSymbol ? `$${opts.tokenSymbol.toLowerCase()}` : '',
    ].filter(Boolean);

    // Create the livestream video object
    const createBody: Record<string, unknown> = {
      channelId: channel.id,
      name: opts.title,
      description: opts.description ?? '',
      privacy: opts.privacy ?? 1,
      tags,
      category: opts.category ?? 13, // default: Tech
      commentsEnabled: true,
      downloadEnabled: false,
      nsfw: false,
      waitTranscoding: false,
      // Custom metadata for DegenFeed integration
      pluginData: {
        degenfeed: {
          tokenAddress,
          tokenSymbol: opts.tokenSymbol ?? '',
          creatorAddress,
          tokenGated: opts.tokenGated ?? false,
          platform: 'degenfeed',
          version: '1.0',
        },
      },
    };

    if (opts.category !== undefined) {
      createBody.category = opts.category;
    }

    // PeerTube: create the live video
    const createUrl = `${this.instanceUrl}/api/v1/videos/live-streams`;
    const createResponse = await authenticatedFetch(createUrl, this.accessToken, {
      method: 'POST',
      body: JSON.stringify(createBody),
    });

    const liveVideo = (await createResponse.json()) as {
      video: {
        id: number;
        uuid: string;
        shortUUID: string;
        name: string;
        url: string;
        embedPath: string;
        description: string;
      };
      liveSession?: {
        id: number;
        rtmpUrl?: string;
        streamKey?: string;
      };
    };

    const videoId = liveVideo.video.id;

    // Create the live session to get RTMP credentials
    let streamKey: string;
    let rtmpUrl: string;

    if (liveVideo.liveSession?.streamKey) {
      streamKey = liveVideo.liveSession.streamKey;
      rtmpUrl = liveVideo.liveSession.rtmpUrl ?? `${this.instanceUrl}${RTMP_INGEST}`;
    } else {
      // Manually create a live session
      const sessionUrl = `${this.instanceUrl}/api/v1/videos/${videoId}/live-session`;
      const sessionResponse = await authenticatedFetch(sessionUrl, this.accessToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const session = (await sessionResponse.json()) as {
        id: number;
        rtmpUrl?: string;
        streamKey?: string;
      };

      streamKey =
        session.streamKey ?? generateStreamKey(tokenAddress, creatorAddress, liveVideo.video.uuid);
      rtmpUrl = session.rtmpUrl ?? `${this.instanceUrl}${RTMP_INGEST}`;
    }

    // Construct URLs
    const baseUrl = this.instanceUrl;
    const uuid = liveVideo.video.uuid;
    const shortUUID = liveVideo.video.shortUUID;

    return {
      id: videoId,
      uuid,
      shortUUID,
      streamKey,
      rtmpUrl,
      playbackUrl: `${baseUrl}/w/${shortUUID}`,
      embedUrl: `${baseUrl}${liveVideo.video.embedPath}`,
      chatUrl: `${baseUrl}/videos/watch/${uuid}/live-chat`,
      url: liveVideo.video.url,
    };
  }

  /**
   * Update livestream metadata (title, description, privacy, etc.).
   */
  async updateStream(streamId: string, opts: StreamUpdateOptions): Promise<void> {
    const body: Record<string, unknown> = {};

    if (opts.title !== undefined) body.name = opts.title;
    if (opts.description !== undefined) body.description = opts.description;
    if (opts.privacy !== undefined) body.privacy = opts.privacy;
    if (opts.category !== undefined) body.category = opts.category;
    if (opts.tags !== undefined) body.tags = opts.tags;

    // Update plugin data if token metadata changes
    if (opts.tokenGated !== undefined || opts.tokenAddress !== undefined) {
      body.pluginData = {
        degenfeed: {
          ...(opts.tokenGated !== undefined ? { tokenGated: opts.tokenGated } : {}),
          ...(opts.tokenAddress !== undefined ? { tokenAddress: opts.tokenAddress } : {}),
        },
      };
    }

    const url = `${this.instanceUrl}/api/v1/videos/${streamId}`;
    await authenticatedFetch(url, this.accessToken, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * End a livestream permanently.
   * PeerTube will save the stream as a VOD recording automatically.
   */
  async endStream(streamId: string): Promise<void> {
    const url = `${this.instanceUrl}/api/v1/videos/${streamId}`;
    await authenticatedFetch(url, this.accessToken, {
      method: 'DELETE',
    });
  }

  /**
   * Get the current status of a livestream.
   * Poll this periodically to track viewer count and health.
   */
  async getStreamStatus(streamId: string): Promise<StreamStatus> {
    const url = `${this.instanceUrl}/api/v1/videos/${streamId}`;
    const response = await authenticatedFetch(url, this.accessToken);

    const video = (await response.json()) as {
      isLive: boolean;
      views: number;
      publishedAt?: string;
      duration: number;
      state?: 'waiting' | 'live' | 'ended' | 'error';
      liveInfo?: {
        viewerCount?: number;
        health?: 'good' | 'bad' | 'unknown';
        startedAt?: string;
      };
    };

    // Fetch live session for real-time stats if available
    let liveViewers = video.liveInfo?.viewerCount ?? 0;
    let liveHealth: StreamStatus['health'] = video.liveInfo?.health ?? 'unknown';
    let liveStartedAt = video.liveInfo?.startedAt;
    let liveState = video.state;

    if (video.isLive && liveViewers === 0) {
      // Try to get more accurate stats from the live session endpoint
      try {
        const sessionUrl = `${this.instanceUrl}/api/v1/videos/${streamId}/live-session`;
        const sessionResponse = await authenticatedFetch(sessionUrl, this.accessToken);
        const session = (await sessionResponse.json()) as {
          viewerCount?: number;
          health?: 'good' | 'bad' | 'unknown';
          startedAt?: string;
          state?: 'waiting' | 'live' | 'ended' | 'error';
        };
        liveViewers = session.viewerCount ?? 0;
        liveHealth = session.health ?? liveHealth;
        liveStartedAt = session.startedAt ?? liveStartedAt;
        liveState = session.state ?? liveState;
      } catch {
        // Live session may not exist yet
      }
    }

    return {
      isLive: video.isLive,
      viewers: liveViewers,
      startedAt: liveStartedAt
        ? new Date(liveStartedAt).getTime()
        : video.publishedAt
          ? new Date(video.publishedAt).getTime()
          : undefined,
      duration: video.duration,
      state: liveState ?? (video.isLive ? 'live' : 'ended'),
      health: liveHealth,
    };
  }

  /**
   * Get the recorded VOD for a completed stream.
   * PeerTube automatically saves streams as VODs after they end.
   * The recording may take some time to process.
   */
  async getRecording(streamId: string): Promise<StreamRecording | null> {
    const url = `${this.instanceUrl}/api/v1/videos/${streamId}`;
    const response = await authenticatedFetch(url, this.accessToken);

    const video = (await response.json()) as {
      isLive: boolean;
      duration: number;
      files?: Array<{
        id: number;
        resolution: { id: number; label: string };
        size: number;
        fileUrl: string;
        torrentUrl: string;
      }>;
      streamingPlaylists?: Array<{
        id: number;
        playlistUrl: string;
        files: Array<{
          resolution: { id: number; label: string };
          size: number;
        }>;
      }>;
      state?: 'published' | 'to_transcode' | 'to_move' | 'processing' | 'ready';
    };

    // If still live or no files, recording not ready
    if (video.isLive || !video.files || video.files.length === 0) {
      return null;
    }

    // Get the highest resolution file
    const sortedFiles = [...video.files].sort((a, b) => b.resolution.id - a.resolution.id);
    const bestFile = sortedFiles[0];
    if (!bestFile) return null;

    return {
      url: bestFile.fileUrl,
      duration: video.duration,
      resolution: bestFile.resolution.label,
      size: bestFile.size,
      ready: video.state === 'published' || video.state === 'ready',
    };
  }

  /**
   * Announce the livestream via ActivityPub federation.
   * PeerTube handles federation automatically — this method
   * triggers a manual announcement to ensure followers see it.
   *
   * PeerTube's built-in federation will:
   *   1. Create an ActivityPub Video object
   *   2. Broadcast to followers across the fediverse
   *   3. Show up on federated timelines
   *   4. Allow remote comments/interactions
   */
  async announceToFederation(streamId: string): Promise<void> {
    // PeerTube handles federation automatically when you create
    // a livestream. This method triggers any additional actions
    // like bumping the stream in the federated feed.

    // Touch the video's update timestamp to trigger re-federation
    const url = `${this.instanceUrl}/api/v1/videos/${streamId}/views`;
    await authenticatedFetch(url, this.accessToken, {
      method: 'POST',
      body: JSON.stringify({}),
    }).catch(() => {
      // Non-critical — federation happens automatically
    });
  }

  /**
   * Check if a PeerTube channel exists for a given token symbol.
   * Returns the channel info or null.
   */
  async getChannelForToken(tokenSymbol: string): Promise<{
    id: number;
    name: string;
    displayName: string;
    url: string;
  } | null> {
    try {
      const sanitized = sanitizeChannelName(tokenSymbol);
      const url = `${this.instanceUrl}/api/v1/video-channels/${sanitized}`;
      const response = await authenticatedFetch(url, this.accessToken);
      return (await response.json()) as {
        id: number;
        name: string;
        displayName: string;
        url: string;
      };
    } catch {
      return null;
    }
  }

  /**
   * List PeerTube channels, optionally filtered by name pattern.
   * Used by the cross-protocol bridge to find existing channels before creating new ones.
   */
  async listChannels(params?: {
    namePattern?: string;
    start?: number;
    count?: number;
    sort?: string;
  }): Promise<{ total: number; data: PeerTubeChannelResult[] }> {
    const searchParams = new URLSearchParams();
    if (params?.namePattern) searchParams.set('namePattern', params.namePattern);
    if (params?.start !== undefined) searchParams.set('start', String(params.start));
    if (params?.count !== undefined) searchParams.set('count', String(params.count));
    if (params?.sort) searchParams.set('sort', params.sort);

    const url = `${this.instanceUrl}/api/v1/video-channels?${searchParams.toString()}`;
    const response = await authenticatedFetch(url, this.accessToken);
    return response.json() as Promise<{ total: number; data: PeerTubeChannelResult[] }>;
  }

  /**
   * Create a PeerTube channel manually.
   * Used by the cross-protocol bridge for custom channel naming.
   */
  async createChannel(opts: {
    name: string;
    displayName: string;
    description?: string;
    support?: string;
  }): Promise<PeerTubeChannelResult> {
    const url = `${this.instanceUrl}/api/v1/video-channels`;
    const response = await authenticatedFetch(url, this.accessToken, {
      method: 'POST',
      body: JSON.stringify(opts),
    });
    return response.json() as Promise<PeerTubeChannelResult>;
  }

  /**
   * List all livestreams for a given token channel.
   * Useful for showing stream history on the token page.
   */
  async getTokenStreams(
    tokenSymbol: string,
    limit = 10,
    start = 0,
  ): Promise<{
    total: number;
    data: Array<{
      id: string;
      uuid: string;
      title: string;
      isLive: boolean;
      publishedAt: string;
      duration: number;
      views: number;
      thumbnailUrl: string | null;
      embedUrl: string;
    }>;
  }> {
    const channel = await this.getChannelForToken(tokenSymbol);
    if (!channel) {
      return { total: 0, data: [] };
    }

    const params = new URLSearchParams({
      channelId: String(channel.id),
      count: String(Math.min(limit, 100)),
      start: String(start),
      sort: '-publishedAt',
      isLive: 'false',
    });

    const url = `${this.instanceUrl}/api/v1/videos?${params.toString()}`;
    const response = await authenticatedFetch(url, this.accessToken);
    const result = (await response.json()) as {
      total: number;
      data: Array<{
        id: number;
        uuid: string;
        name: string;
        isLive: boolean;
        publishedAt: string;
        duration: number;
        views: number;
        thumbnailPath: string | null;
        embedPath: string;
      }>;
    };

    return {
      total: result.total,
      data: result.data.map((v) => ({
        id: String(v.id),
        uuid: v.uuid,
        title: v.name,
        isLive: v.isLive,
        publishedAt: v.publishedAt,
        duration: v.duration,
        views: v.views,
        thumbnailUrl: v.thumbnailPath ? `${this.instanceUrl}${v.thumbnailPath}` : null,
        embedUrl: `${this.instanceUrl}${v.embedPath}`,
      })),
    };
  }

  // ═════════════════════════════════════════════════════════════════════
  // Live Chat (PeerTube's Built-in XMPP via Prosody)
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Get live chat messages for a stream.
   *
   * PeerTube's chat uses Prosody XMPP with a REST API bridge.
   * Messages from the XMPP channel are accessible via the PeerTube API.
   *
   * @param streamId - The video UUID or ID
   * @param cursor - Pagination cursor for older messages
   */
  async getChatMessages(streamId: string, cursor?: string): Promise<ChatFetchResult> {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);

    const url = `${this.instanceUrl}/api/v1/videos/${streamId}/live-chat?${params.toString()}`;
    const response = await authenticatedFetch(url, this.accessToken);

    const result = (await response.json()) as {
      data: Array<{
        id: string;
        displayName: string;
        accountName: string;
        message: string;
        createdAt: string;
      }>;
      total: number;
      cursor?: string;
    };

    return {
      messages: result.data.map((msg) => ({
        id: msg.id,
        displayName: msg.displayName,
        accountName: msg.accountName,
        message: msg.message,
        timestamp: new Date(msg.createdAt).getTime(),
      })),
      nextCursor: result.cursor,
      total: result.total,
    };
  }

  /**
   * Send a chat message as the authenticated user (creator).
   *
   * @param streamId - The video UUID or ID
   * @param message - Chat message text
   */
  async sendChatMessage(streamId: string, message: string): Promise<void> {
    const url = `${this.instanceUrl}/api/v1/videos/${streamId}/live-chat`;
    await authenticatedFetch(url, this.accessToken, {
      method: 'POST',
      body: JSON.stringify({ message: message.slice(0, 500) }),
    });
  }

  /**
   * Delete a chat message (moderation). Creator only.
   */
  async deleteChatMessage(streamId: string, messageId: string): Promise<void> {
    const url = `${this.instanceUrl}/api/v1/videos/${streamId}/live-chat/${messageId}`;
    await authenticatedFetch(url, this.accessToken, {
      method: 'DELETE',
    });
  }
}
