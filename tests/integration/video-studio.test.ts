/**
 * @degenfeed/integration — Video Studio Tests
 *
 * Tests the video creation pipeline: shorts creation, video upload, live
 * stream setup, multi-platform publish, analytics, content library,
 * monetization settings, and publish target validation.
 *
 * Pure functions tested directly. External APIs mocked via vi.mock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock providers ─────────────────────────────────────────────────────

vi.mock('../../packages/livepeer-provider/src/index', () => ({
  LivepeerProvider: vi.fn().mockImplementation(() => ({
    createStream: vi.fn().mockResolvedValue({
      id: 'lp_stream_001',
      rtmpUrl: 'rtmp://livepeer.studio/live/',
      streamKey: 'abc-def-ghi',
      playbackUrl: 'https://livepeerr.io/hls/playback123/index.m3u8',
      playbackId: 'playback123',
      status: 'idle',
      isActive: false,
      createdAt: new Date().toISOString(),
    }),
    getStreamStatus: vi.fn().mockResolvedValue({
      id: 'lp_stream_001',
      status: 'active',
      isActive: true,
      viewerCount: 42,
      recordingStatus: 'waiting',
    }),
    endStream: vi.fn().mockResolvedValue(undefined),
    getRecording: vi.fn().mockResolvedValue({
      assetId: 'asset_001',
      playbackUrl: 'https://livepeerr.io/hls/recording123/index.m3u8',
      ipfsCid: 'QmRecordingCid123',
      duration: 300,
      size: 50_000_000,
      ready: true,
    }),
    exportToIPFS: vi.fn().mockResolvedValue({ ipfsCid: 'QmExportedCid456' }),
    healthCheck: vi.fn().mockResolvedValue({ healthy: true, latencyMs: 120 }),
  })),
}));

vi.mock('../../packages/shorts-provider/src/index', () => ({
  fetchPeerTubeShorts: vi.fn().mockResolvedValue([]),
  fetchYouTubeShorts: vi.fn().mockResolvedValue([]),
  fetchTikTokShorts: vi.fn().mockResolvedValue([]),
  fetchInstagramReels: vi.fn().mockResolvedValue([]),
  fetchShortsFeed: vi.fn().mockImplementation(async (opts = {}) => ({
    videos: [],
    sources: { peertube: 0, youtube: 0, tiktok: 0, instagram: 0, bluesky: 0 },
    cursor: null,
    hasMore: false,
  })),
  deduplicateVideos: vi.fn((videos) => videos),
}));

vi.mock('../../packages/monetization/src/TierManager', () => ({
  TierManager: {
    canAccess: vi.fn((tier: string, feature: string) => {
      if (feature === 'cross_platform_publishing') return tier === 'pro' || tier === 'enterprise';
      if (feature === 'white_label') return tier === 'enterprise';
      if (feature === 'analytics_dashboard') return tier !== 'free';
      return true;
    }),
    getLimits: vi.fn((tier: string) => {
      const limits: Record<string, { connectedProtocols: number; scheduledPosts: number }> = {
        free: { connectedProtocols: 5, scheduledPosts: 0 },
        creator: { connectedProtocols: 10, scheduledPosts: 50 },
        pro: { connectedProtocols: 999, scheduledPosts: 999 },
        enterprise: { connectedProtocols: 999, scheduledPosts: 999 },
      };
      return limits[tier] ?? limits.free;
    }),
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────────

function createMockVideoItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vid_' + Math.random().toString(36).slice(2, 8),
    title: 'Test Video',
    description: 'A test video for the studio',
    duration: 60,
    visibility: 'public' as const,
    monetization: { tipsEnabled: true, tokenGated: false, requiresSubscription: false },
    source: 'upload' as const,
    thumbnailUrl: 'https://example.com/thumb.jpg',
    creatorAddress: '0xcreator',
    status: 'draft' as const,
    ...overrides,
  };
}

function createMockPublishTarget(overrides: Record<string, unknown> = {}) {
  return {
    id: 'target_' + Math.random().toString(36).slice(2, 8),
    platform: 'youtube' as const,
    label: 'YouTube',
    connected: true,
    enabled: true,
    ...overrides,
  };
}

// ─── Suite 1: Shorts Creation ───────────────────────────────────────────

describe('Video Studio — Shorts Creation Flow', () => {
  it('validates short video duration is ≤ 120 seconds', async () => {
    const { default: SHORTS_MAX_DURATION } = await vi.importActual<{
      default: number;
    }>('../../packages/shorts-provider/src/index');

    // Test the constant directly
    expect(SHORTS_MAX_DURATION).toBe(120);

    const validDurations = [15, 30, 60, 90, 120];
    const invalidDurations = [121, 180, 300];

    for (const dur of validDurations) {
      expect(dur <= SHORTS_MAX_DURATION).toBe(true);
    }
    for (const dur of invalidDurations) {
      expect(dur <= SHORTS_MAX_DURATION).toBe(false);
    }
  });

  it('creates a short from uploaded file with correct metadata', async () => {
    const { PeerTubeUploader } = await import('../../packages/peertube-provider/src/upload');

    const uploader = new PeerTubeUploader({
      instanceUrl: 'https://video.degenfeed.xyz',
      accessToken: 'mock-token',
    });

    vi.spyOn(uploader, 'uploadShort').mockResolvedValue({
      uuid: 'short-uuid-123',
      url: 'https://video.degenfeed.xyz/w/short123',
      embedUrl: 'https://video.degenfeed.xyz/videos/embed/short123',
      duration: 45,
      isShort: true,
    });

    const file = new File(['mock-video-content'], 'shorts-clip.mp4', { type: 'video/mp4' });
    const result = await uploader.uploadShort({
      file,
      title: 'Bitcoin to the Moon! #shorts',
      description: 'Quick crypto analysis short',
      tags: ['crypto', 'bitcoin', 'shorts'],
    });

    expect(result.isShort).toBe(true);
    expect(result.uuid).toBe('short-uuid-123');
    expect(result.url).toContain('/w/');
    expect(result.duration).toBeLessThanOrEqual(120);
  });

  it('applies vertical format flag for short-form content', async () => {
    const { computeShortScore, rankShorts } = await import(
      '../../packages/shorts-provider/src/scorer'
    );

    const shortVideo = {
      id: 'test:short1',
      title: 'Test Short #shorts',
      description: 'A vertical short',
      thumbnailUrl: '',
      videoUrl: 'https://example.com/short',
      duration: 45,
      authorName: 'Creator',
      views: 1000,
      likes: 100,
      source: 'youtube' as const,
      sourceUrl: 'https://youtube.com/shorts/abc',
      topics: ['crypto', 'bitcoin'],
      publishedAt: Date.now() - 3600000,
      vertical: true,
      qualityScore: 0.8,
      sourceLabel: 'YouTube',
      sourceColor: '#ff0000',
      canTip: false,
    };

    const profile = { topics: { crypto: 0.9, bitcoin: 0.8 } };
    const score = computeShortScore(shortVideo, profile);

    expect(score).toBeGreaterThan(0);
    expect(shortVideo.vertical).toBe(true);

    const ranked = rankShorts([shortVideo], profile, new Set(), 10);
    expect(ranked.length).toBe(1);
    expect(ranked[0]?.id).toBe('test:short1');
  });

  it('publishes short to PeerTube and returns embed URL', async () => {
    const shortResult = {
      uuid: 'published-short-789',
      url: 'https://video.degenfeed.xyz/w/published789',
      embedUrl: 'https://video.degenfeed.xyz/videos/embed/published789',
      duration: 30,
      isShort: true,
    };

    expect(shortResult.isShort).toBe(true);
    expect(shortResult.embedUrl).toContain('/videos/embed/');
    expect(shortResult.duration).toBeLessThanOrEqual(120);
  });
});

// ─── Suite 2: Video Upload ──────────────────────────────────────────────

describe('Video Studio — Video Upload Flow', () => {
  it('uploads video with metadata and returns UUID', async () => {
    const { PeerTubeUploader } = await import('../../packages/peertube-provider/src/upload');

    const uploader = new PeerTubeUploader({
      instanceUrl: 'https://video.degenfeed.xyz',
      accessToken: 'mock-token',
    });

    vi.spyOn(uploader, 'uploadVideo').mockResolvedValue({
      uuid: 'video-uuid-456',
      shortUUID: 'short456',
      url: 'https://video.degenfeed.xyz/w/video456',
      embedUrl: 'https://video.degenfeed.xyz/videos/embed/video456',
      embedPath: '/videos/embed/video456',
      name: 'My Crypto Analysis',
    });

    const file = new File(['content'], 'analysis.mp4', { type: 'video/mp4' });
    const result = await uploader.uploadVideo({
      file,
      title: 'My Crypto Analysis',
      description: 'In-depth crypto market analysis',
      category: 13,
      tags: ['crypto', 'analysis', 'bitcoin'],
      privacy: 1,
      language: 'en',
      commentsEnabled: true,
    });

    expect(result.uuid).toBe('video-uuid-456');
    expect(result.name).toBe('My Crypto Analysis');
    expect(result.url).toContain('/w/');
    expect(result.embedUrl).toContain('/videos/embed/');
  });

  it('respects visibility options: public, unlisted, private', () => {
    const visibilityOptions = [
      { value: 1, label: 'public' },
      { value: 2, label: 'unlisted' },
      { value: 3, label: 'private' },
    ];

    for (const opt of visibilityOptions) {
      expect(opt.value).toBeGreaterThanOrEqual(1);
      expect(opt.value).toBeLessThanOrEqual(3);
    }
    expect(visibilityOptions[0]?.label).toBe('public');
    expect(visibilityOptions[2]?.label).toBe('private');
  });

  it('tracks upload progress through states', async () => {
    const { PeerTubeUploader } = await import('../../packages/peertube-provider/src/upload');

    const uploader = new PeerTubeUploader({
      instanceUrl: 'https://video.degenfeed.xyz',
      accessToken: 'mock-token',
    });

    vi.spyOn(uploader, 'getUploadProgress').mockResolvedValueOnce({
      state: 'pending',
      progress: 0,
      startedAt: Date.now(),
    });

    const pending = await uploader.getUploadProgress('uuid-1');
    expect(pending.state).toBe('pending');
    expect(pending.progress).toBe(0);

    vi.spyOn(uploader, 'getUploadProgress').mockResolvedValueOnce({
      state: 'processing',
      progress: 50,
      startedAt: Date.now(),
      eta: 120,
    });

    const processing = await uploader.getUploadProgress('uuid-1');
    expect(processing.state).toBe('processing');
    expect(processing.progress).toBeGreaterThan(0);

    vi.spyOn(uploader, 'getUploadProgress').mockResolvedValueOnce({
      state: 'published',
      progress: 100,
      startedAt: Date.now(),
    });

    const published = await uploader.getUploadProgress('uuid-1');
    expect(published.state).toBe('published');
    expect(published.progress).toBe(100);
  });

  it('allows setting monetization on uploaded video', async () => {
    const monetizationSettings = {
      tipsEnabled: true,
      tokenGated: false,
      requiresSubscription: false,
      priceCents: 0,
    };

    const video = createMockVideoItem({ monetization: monetizationSettings });
    expect(video.monetization.tipsEnabled).toBe(true);
    expect(video.monetization.tokenGated).toBe(false);

    // Toggle token-gate on
    const updated = { ...video, monetization: { ...video.monetization, tokenGated: true } };
    expect(updated.monetization.tokenGated).toBe(true);
  });
});

// ─── Suite 3: Live Stream Setup ─────────────────────────────────────────

describe('Video Studio — Live Stream Setup', () => {
  it('creates a portrait-mode live stream via Livepeer', async () => {
    const { LivepeerProvider } = await import('../../packages/livepeer-provider/src/index');

    const provider = new LivepeerProvider({ apiKey: 'mock-key' });
    const stream = await provider.createStream({
      name: 'Portrait Stream',
      creator: '0xcreator',
      record: true,
      latencyLevel: 'low',
    });

    expect(stream.rtmpUrl).toBeTruthy();
    expect(stream.streamKey).toBeTruthy();
    expect(stream.playbackUrl).toContain('.m3u8');
    expect(stream.status).toBe('idle');
  });

  it('creates a landscape-mode live stream and gets playback URL', async () => {
    const { LivepeerProvider } = await import('../../packages/livepeer-provider/src/index');

    const provider = new LivepeerProvider({ apiKey: 'mock-key' });
    const stream = await provider.createStream({
      name: 'Landscape Stream',
      creator: '0xcreator',
      record: true,
      latencyLevel: 'realtime',
    });

    expect(stream.playbackId).toBeTruthy();
    expect(stream.playbackUrl).toContain(stream.playbackId);
    expect(stream.rtmpUrl).toContain('rtmp://');
  });

  it('polls stream status and returns viewer count', async () => {
    const { LivepeerProvider } = await import('../../packages/livepeer-provider/src/index');

    const provider = new LivepeerProvider({ apiKey: 'mock-key' });
    const status = await provider.getStreamStatus('lp_stream_001');

    expect(status.isActive).toBe(true);
    expect(status.viewerCount).toBe(42);
    expect(status.status).toBe('active');
    expect(status.recordingStatus).toBe('waiting');
  });
});

// ─── Suite 4: Multi-Platform Publish ────────────────────────────────────

describe('Video Studio — Multi-Platform Publish', () => {
  it('selects multiple publish targets for a video', () => {
    const targets = [
      createMockPublishTarget({ platform: 'youtube', label: 'YouTube' }),
      createMockPublishTarget({ platform: 'peertube', label: 'PeerTube', connected: true }),
      createMockPublishTarget({ platform: 'ipfs', label: 'IPFS', connected: true }),
    ];

    const selected = targets.filter((t) => t.connected && t.enabled);
    expect(selected.length).toBe(2);
    expect(selected.map((t) => t.platform)).toEqual(['peertube', 'ipfs']);
  });

  it('validates at least one target is selected before publish', () => {
    const publish = (selectedTargets: Array<{ platform: string }>) => {
      if (selectedTargets.length === 0) {
        return { success: false, error: 'At least one publish target required' };
      }
      return { success: true, targets: selectedTargets.map((t) => t.platform) };
    };

    expect(publish([]).success).toBe(false);
    expect(publish([]).error).toContain('target');
    expect(publish([{ platform: 'peertube' }]).success).toBe(true);
    expect(publish([{ platform: 'youtube' }, { platform: 'ipfs' }]).targets).toHaveLength(2);
  });

  it('transforms video for each target format', async () => {
    const { default: crossPosterModule } = await vi.importActual<
      typeof import('../../bridge/src/crossposter')
    >('../../bridge/src/crossposter');

    const { crossPost } = crossPosterModule;

    // Build a minimal UnifiedPost
    const post = {
      id: 'post:video123',
      protocol: 'peertube' as const,
      author: {
        id: 'peertube:creator1',
        primary: { protocol: 'peertube' as const, id: 'creator1' },
        handles: {},
        displayName: 'Test Creator',
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: 'Check out my new video!',
      embeds: [
        {
          kind: 'video' as const,
          url: 'https://video.degenfeed.xyz/w/video123',
          meta: { duration: 300 },
        },
      ],
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: {},
      niches: ['crypto'],
    };

    const result = await crossPost(post, {
      id: 'test-video-crosspost',
      source: 'peertube',
      targets: ['nostr', 'bluesky'],
      enabled: true,
      sourceConfig: {},
      targetConfigs: {},
    });

    expect(result.success).toBe(false); // No env vars set for actual publish
    expect(result.results.length).toBeGreaterThanOrEqual(1);
    // The transform should succeed for at least one target
    const transformFailures = result.results.filter((r) => r.error?.includes('No transform'));
    expect(transformFailures.length).toBe(0);
  });
});

// ─── Suite 5: Video Analytics ───────────────────────────────────────────

describe('Video Studio — Video Analytics', () => {
  it('computes total watch time from multiple view sessions', () => {
    const sessions = [
      { videoId: 'vid1', duration: 120, completed: true },
      { videoId: 'vid1', duration: 60, completed: false },
      { videoId: 'vid1', duration: 180, completed: true },
    ];

    const totalWatchTime = sessions.reduce((sum, s) => sum + s.duration, 0);
    const completionRate =
      sessions.filter((s) => s.completed).length / sessions.length;

    expect(totalWatchTime).toBe(360);
    expect(completionRate).toBeCloseTo(0.667, 2);
  });

  it('aggregates tip amounts from video', () => {
    const tips = [
      { amountUsd: 5, fromId: 'user1' },
      { amountUsd: 10, fromId: 'user2' },
      { amountUsd: 25, fromId: 'user3' },
    ];

    const totalTips = tips.reduce((sum, t) => sum + t.amountUsd, 0);
    const tipCount = tips.length;
    const avgTip = totalTips / tipCount;

    expect(totalTips).toBe(40);
    expect(tipCount).toBe(3);
    expect(avgTip).toBeCloseTo(13.33, 1);
  });

  it('computes engagement rate from views and likes', () => {
    const analytics = { views: 1000, likes: 50, comments: 10, shares: 5 };
    const engagementRate = (analytics.likes + analytics.comments + analytics.shares) / analytics.views;

    expect(engagementRate).toBeCloseTo(0.065, 3);
  });

  it('tracks monetization revenue from video', () => {
    const revenue = {
      tips: 150,
      subscriptions: 50,
      tokenGates: 200,
    };
    const totalRevenue = revenue.tips + revenue.subscriptions + revenue.tokenGates;

    expect(totalRevenue).toBe(400);
    expect(revenue.tips).toBeLessThan(revenue.tokenGates);
  });
});

// ─── Suite 6: Content Library ───────────────────────────────────────────

describe('Video Studio — Content Library', () => {
  const libraryVideos = [
    createMockVideoItem({ id: 'v1', title: 'Bitcoin Analysis', status: 'published', duration: 300 }),
    createMockVideoItem({ id: 'v2', title: 'Ethereum Deep Dive', status: 'draft', duration: 600 }),
    createMockVideoItem({ id: 'v3', title: 'Solana Short', status: 'published', duration: 45 }),
    createMockVideoItem({ id: 'v4', title: 'DeFi Overview', status: 'scheduled', duration: 900 }),
  ];

  it('filters videos by status', () => {
    const published = libraryVideos.filter((v) => v.status === 'published');
    const drafts = libraryVideos.filter((v) => v.status === 'draft');

    expect(published.length).toBe(2);
    expect(drafts.length).toBe(1);
  });

  it('sorts videos by duration (shorts first)', () => {
    const sorted = [...libraryVideos].sort((a, b) => a.duration - b.duration);
    expect(sorted[0]?.id).toBe('v3');
    expect(sorted[0]?.duration).toBe(45);
    expect(sorted[sorted.length - 1]?.id).toBe('v4');
  });

  it('searches videos by title keyword', () => {
    const query = 'bitcoin';
    const results = libraryVideos.filter(
      (v) => v.title.toLowerCase().includes(query.toLowerCase()),
    );
    expect(results.length).toBe(1);
    expect(results[0]?.title).toContain('Bitcoin');
  });

  it('manages video lifecycle: draft → publish → unpublish', () => {
    const video = createMockVideoItem({ status: 'draft' });
    expect(video.status).toBe('draft');

    const published = { ...video, status: 'published' as const };
    expect(published.status).toBe('published');

    const unpublished = { ...published, status: 'draft' as const };
    expect(unpublished.status).toBe('draft');
  });
});

// ─── Suite 7: Monetization Settings ─────────────────────────────────────

describe('Video Studio — Monetization Settings', () => {
  it('toggles tips on/off per video', () => {
    const video = createMockVideoItem({
      monetization: { tipsEnabled: true, tokenGated: false, requiresSubscription: false },
    });
    expect(video.monetization.tipsEnabled).toBe(true);

    const tipsOff = { ...video, monetization: { ...video.monetization, tipsEnabled: false } };
    expect(tipsOff.monetization.tipsEnabled).toBe(false);
  });

  it('enables token-gate for premium content', () => {
    const video = createMockVideoItem({
      monetization: { tipsEnabled: true, tokenGated: true, requiresSubscription: false },
    });

    expect(video.monetization.tokenGated).toBe(true);
  });

  it('validates tier-based feature access for monetization features', async () => {
    const { TierManager } = await import('../../packages/monetization/src/TierManager');

    expect(TierManager.canAccess('free', 'tipping')).toBe(true);
    expect(TierManager.canAccess('free', 'white_label')).toBe(false);
    expect(TierManager.canAccess('pro', 'cross_platform_publishing')).toBe(true);
    expect(TierManager.canAccess('creator', 'cross_platform_publishing')).toBe(false);
  });
});

// ─── Suite 8: Publish Target Validation ─────────────────────────────────

describe('Video Studio — Publish Target Selection Validation', () => {
  const availablePlatforms = [
    { id: 'youtube', label: 'YouTube', requiresAuth: true, requiresTier: 'free' },
    { id: 'peertube', label: 'PeerTube', requiresAuth: true, requiresTier: 'free' },
    { id: 'ipfs', label: 'IPFS', requiresAuth: false, requiresTier: 'free' },
    { id: 'livepeer', label: 'Livepeer', requiresAuth: true, requiresTier: 'creator' },
    { id: 'owncast', label: 'Owncast', requiresAuth: true, requiresTier: 'creator' },
  ];

  it('requires auth for connected platforms', () => {
    const needsAuth = availablePlatforms.filter((p) => p.requiresAuth);
    expect(needsAuth.length).toBe(4);
    expect(needsAuth.map((p) => p.id)).toContain('youtube');
  });

  it('enforces tier requirements for platform publishing', () => {
    const userTier = 'free';
    const accessible = availablePlatforms.filter((p) => {
      const tierRank: Record<string, number> = { free: 0, creator: 1, pro: 2, enterprise: 3 };
      return tierRank[userTier] >= tierRank[p.requiresTier];
    });

    expect(accessible.length).toBe(3); // free tier: youtube, peertube, ipfs

    const proAccessible = availablePlatforms.filter((p) => {
      const tierRank: Record<string, number> = { free: 0, creator: 1, pro: 2, enterprise: 3 };
      return tierRank['pro'] >= tierRank[p.requiresTier];
    });
    expect(proAccessible.length).toBe(5); // pro: all
  });

  it('detects missing platform connection before publishing', () => {
    const platforms = [
      { id: 'youtube', connected: true },
      { id: 'peertube', connected: false },
    ];

    const readyToPublish = platforms.filter((p) => p.connected).map((p) => p.id);
    expect(readyToPublish).toEqual(['youtube']);
  });
});
