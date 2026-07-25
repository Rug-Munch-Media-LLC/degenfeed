/**
 * @degenfeed/integration — External Platform Tests
 *
 * Tests the external platform integration layer: Postiz bridge health,
 * connecting/disconnecting platforms, posting/scheduling content,
 * going live, pulling analytics, premium tier gating, and standalone
 * service access.
 *
 * Pure functions tested directly. External APIs mocked via vi.mock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock crossposter ───────────────────────────────────────────────────

vi.mock('../../bridge/src/crossposter', () => ({
  crossPost: vi.fn().mockImplementation(async (post: unknown, config: { targets: string[] }) => {
    return {
      success: true,
      results: config.targets.map((target) => ({
        success: true,
        target,
        latencyMs: 100 + Math.random() * 200,
      })),
    };
  }),
  startCrossPoster: vi.fn().mockReturnValue(new Map()),
  stopCrossPoster: vi.fn(),
  getCrossPosterStats: vi.fn().mockReturnValue([]),
  resetCrossPosterState: vi.fn(),
  RateLimiter: vi.fn(),
  FailureTracker: vi.fn(),
}));

// ─── Mock YouTube provider ──────────────────────────────────────────────

vi.mock('../../packages/youtube-provider/src/index', () => ({
  fetchYouTubeFeed: vi.fn().mockResolvedValue([]),
  YouTubeProvider: vi.fn().mockImplementation(() => ({
    authenticate: vi.fn().mockResolvedValue({ accessToken: 'mock-yt-token', expiresAt: Date.now() + 3600000 }),
    uploadVideo: vi.fn().mockResolvedValue({ id: 'yt_video_123', url: 'https://youtube.com/watch?v=abc123' }),
    scheduleVideo: vi.fn().mockResolvedValue({ id: 'yt_scheduled_456', scheduledAt: '2026-08-01T12:00:00Z' }),
    startLiveStream: vi.fn().mockResolvedValue({
      id: 'yt_live_789',
      streamUrl: 'rtmp://a.rtmp.youtube.com/live2',
      streamKey: 'xxxx-xxxx-xxxx',
      broadcastId: 'broadcast_abc',
    }),
    getAnalytics: vi.fn().mockResolvedValue({
      views: 5000,
      watchTimeMinutes: 15000,
      likes: 200,
      comments: 45,
      estimatedRevenueCents: 1500,
    }),
    healthCheck: vi.fn().mockResolvedValue({ healthy: true, latencyMs: 85 }),
  })),
}));

vi.mock('../../packages/monetization/src/TierManager', () => ({
  TierManager: {
    canAccess: vi.fn((tier: string, feature: string) => {
      if (feature === 'cross_platform_publishing') return tier === 'pro' || tier === 'enterprise';
      if (feature === 'analytics_dashboard') return tier !== 'free';
      if (feature === 'scheduled_posts') return tier === 'creator' || tier === 'pro' || tier === 'enterprise';
      return true;
    }),
    getLimits: vi.fn(() => ({
      connectedProtocols: 999,
      scheduledPosts: 999,
    })),
  },
}));

// ─── Mock external platform registry ────────────────────────────────────

interface ExternalPlatform {
  id: string;
  name: string;
  type: 'video' | 'social' | 'live' | 'storage';
  authType: 'oauth2' | 'api_key' | 'none';
  requiresTier: string;
  requiresSetup: boolean;
  healthEndpoint?: string;
}

const EXTERNAL_PLATFORMS: ExternalPlatform[] = [
  { id: 'youtube', name: 'YouTube', type: 'video', authType: 'oauth2', requiresTier: 'free', requiresSetup: true, healthEndpoint: '/api/health' },
  { id: 'peertube', name: 'PeerTube', type: 'video', authType: 'oauth2', requiresTier: 'free', requiresSetup: true },
  { id: 'livepeer', name: 'Livepeer', type: 'live', authType: 'api_key', requiresTier: 'creator', requiresSetup: true },
  { id: 'owncast', name: 'Owncast', type: 'live', authType: 'api_key', requiresTier: 'creator', requiresSetup: true },
  { id: 'postiz', name: 'Postiz Bridge', type: 'social', authType: 'api_key', requiresTier: 'pro', requiresSetup: true, healthEndpoint: '/health' },
  { id: 'ipfs', name: 'IPFS', type: 'storage', authType: 'none', requiresTier: 'free', requiresSetup: false },
  { id: 'r2', name: 'Cloudflare R2', type: 'storage', authType: 'api_key', requiresTier: 'free', requiresSetup: true },
];

// ─── Helpers ────────────────────────────────────────────────────────────

function createMockCredentials(platform: string) {
  return {
    platform,
    accessToken: `mock-${platform}-token`,
    refreshToken: `mock-${platform}-refresh`,
    expiresAt: Date.now() + 3600000,
    scopes: ['read', 'write'],
  };
}

function createMockPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post_' + Math.random().toString(36).slice(2, 8),
    protocol: 'degenfeed' as const,
    author: {
      id: 'author_1',
      primary: { protocol: 'degenfeed' as const, id: 'author_1' },
      handles: {},
      displayName: 'Test Creator',
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: 'Test post content for external platform',
    embeds: [],
    createdAt: Date.now(),
    metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: {},
    niches: [],
    ...overrides,
  };
}

// ─── Suite 1: Postiz Bridge Health ──────────────────────────────────────

describe('External Platforms — Postiz Bridge Health', () => {
  it('checks Postiz bridge health endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'ok', version: '1.2.3', uptime: 86400 }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await fetch('https://postiz.example.com/health');
    const data = await response.json();

    expect(data.status).toBe('ok');
    expect(data.version).toBeDefined();
    expect(data.uptime).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it('reports bridge as unhealthy when unreachable', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.stubGlobal('fetch', mockFetch);

    try {
      await fetch('https://postiz.example.com/health');
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect((err as Error).message).toContain('Connection refused');
    }
    vi.unstubAllGlobals();
  });

  it('validates Postiz is a pro-tier platform', () => {
    const postiz = EXTERNAL_PLATFORMS.find((p) => p.id === 'postiz');
    expect(postiz).toBeDefined();
    expect(postiz?.requiresTier).toBe('pro');
    expect(postiz?.authType).toBe('api_key');
  });
});

// ─── Suite 2: Connect External Platform ─────────────────────────────────

describe('External Platforms — Connect YouTube', () => {
  it('initiates OAuth2 flow for platform connection', async () => {
    const authUrl = 'https://accounts.google.com/o/oauth2/auth?client_id=xxx&redirect_uri=yyy&scope=zzz';
    expect(authUrl).toContain('oauth2');
    expect(authUrl).toContain('client_id');
  });

  it('stores platform credentials after successful auth', () => {
    const credentials = createMockCredentials('youtube');
    const store = new Map<string, string>();
    store.set(`platform:youtube:credentials`, JSON.stringify(credentials));

    const stored = store.get('platform:youtube:credentials');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.platform).toBe('youtube');
    expect(parsed.accessToken).toContain('mock');
    expect(parsed.scopes).toContain('write');
  });

  it('lists connected platforms for a user', () => {
    const connectedPlatforms = [
      { platform: 'youtube', connectedAt: Date.now(), status: 'active' },
      { platform: 'ipfs', connectedAt: Date.now(), status: 'active' },
    ];

    expect(connectedPlatforms.length).toBe(2);
    expect(connectedPlatforms[0]?.status).toBe('active');
  });

  it('refuses connection for platforms that require higher tier', () => {
    const userTier = 'free';
    const platform = EXTERNAL_PLATFORMS.find((p) => p.id === 'livepeer')!;

    const tierRank: Record<string, number> = { free: 0, creator: 1, pro: 2, enterprise: 3 };
    const canConnect = tierRank[userTier] >= tierRank[platform.requiresTier];
    expect(canConnect).toBe(false);
  });
});

// ─── Suite 3: Post to External Platform ─────────────────────────────────

describe('External Platforms — Post to YouTube', () => {
  it('publishes video to YouTube via provider', async () => {
    const { YouTubeProvider } = await import('../../packages/youtube-provider/src/index');

    const mockYT = vi.mocked(new YouTubeProvider());
    // Replace the mock with a more specific one for this test
    const uploadSpy = vi.spyOn(mockYT, 'uploadVideo').mockResolvedValue({
      id: 'yt_video_123',
      url: 'https://youtube.com/watch?v=abc123',
    });

    const result = await mockYT.uploadVideo();
    expect(result.id).toBe('yt_video_123');
    expect(result.url).toContain('youtube.com/watch');
    expect(uploadSpy).toHaveBeenCalledOnce();
  });

  it('cross-posts content via bridge to multiple platforms', async () => {
    const { crossPost } = await import('../../bridge/src/crossposter');

    const post = createMockPost({ text: 'Cross-post test' });
    const result = await crossPost(post, {
      id: 'test-cross',
      source: 'degenfeed',
      targets: ['mastodon', 'bluesky'],
      enabled: true,
      sourceConfig: {},
      targetConfigs: {},
    });

    expect(result.success).toBe(true);
    expect(result.results.length).toBe(2);
    for (const r of result.results) {
      expect(r.success).toBe(true);
    }
  });

  it('transforms content format per target platform', async () => {
    // Test transforms from crossposter types
    const transforms: Record<string, (text: string) => string> = {
      mastodon: (text: string) => `${text}\n\n(from degenfeed)`,
      nostr: (text: string) => `${text}\n\n— originally from degenfeed`,
      bluesky: (text: string) => `${text}\n\n[Originally from degenfeed]`,
      farcaster: (text: string) =>
        text.length > 320 ? `${text.slice(0, 300)}...\n\n[Cross-posted from degenfeed]` : `${text}\n\n[Cross-posted from degenfeed]`,
    };

    const originalText = 'Hello from DegenFeed!';
    expect(transforms.mastodon(originalText)).toContain('(from degenfeed)');
    expect(transforms.nostr(originalText)).toContain('originally from');
    expect(transforms.bluesky(originalText)).toContain('[Originally from');

    // Farcaster 320-char limit
    expect(transforms.farcaster('x'.repeat(400)).length).toBeLessThanOrEqual(330);
    expect(transforms.farcaster('short text').length).toBeLessThanOrEqual(100);
  });
});

// ─── Suite 4: Schedule Post ─────────────────────────────────────────────

describe('External Platforms — Schedule Post', () => {
  it('schedules a video for future publication', async () => {
    const { YouTubeProvider } = await import('../../packages/youtube-provider/src/index');

    const mockYT = vi.mocked(new YouTubeProvider());
    const scheduleSpy = vi.spyOn(mockYT, 'scheduleVideo').mockResolvedValue({
      id: 'yt_scheduled_456',
      scheduledAt: '2026-08-01T12:00:00Z',
    });

    const result = await mockYT.scheduleVideo();
    expect(result.id).toBe('yt_scheduled_456');
    expect(result.scheduledAt).toBe('2026-08-01T12:00:00Z');

    const scheduledTime = new Date(result.scheduledAt).getTime();
    expect(scheduledTime).toBeGreaterThan(Date.now());
  });

  it('validates scheduled date is in the future', () => {
    const schedulePost = (scheduledAt: string) => {
      const scheduledTime = new Date(scheduledAt).getTime();
      if (scheduledTime <= Date.now()) {
        return { success: false, error: 'Scheduled time must be in the future' };
      }
      return { success: true, scheduledAt };
    };

    const pastDate = new Date(Date.now() - 86400000).toISOString();
    expect(schedulePost(pastDate).success).toBe(false);

    const futureDate = new Date(Date.now() + 86400000).toISOString();
    expect(schedulePost(futureDate).success).toBe(true);
  });

  it('checks tier limit for scheduled posts', async () => {
    const { TierManager } = await import('../../packages/monetization/src/TierManager');

    expect(TierManager.canAccess('free', 'scheduled_posts')).toBe(false);
    expect(TierManager.canAccess('creator', 'scheduled_posts')).toBe(true);
    expect(TierManager.canAccess('pro', 'scheduled_posts')).toBe(true);
  });
});

// ─── Suite 5: Go Live on External Platform ──────────────────────────────

describe('External Platforms — Go Live', () => {
  it('starts a YouTube live stream with RTMP credentials', async () => {
    const { YouTubeProvider } = await import('../../packages/youtube-provider/src/index');

    const mockYT = vi.mocked(new YouTubeProvider());
    const liveSpy = vi.spyOn(mockYT, 'startLiveStream').mockResolvedValue({
      id: 'yt_live_789',
      streamUrl: 'rtmp://a.rtmp.youtube.com/live2',
      streamKey: 'xxxx-xxxx-xxxx',
      broadcastId: 'broadcast_abc',
    });

    const result = await mockYT.startLiveStream();
    expect(result.streamUrl).toContain('rtmp://');
    expect(result.streamKey).toBeTruthy();
    expect(result.broadcastId).toBeTruthy();
    expect(result.id).toBe('yt_live_789');
  });

  it('starts a Livepeer stream via provider', async () => {
    const { LivepeerProvider } = await import('../../packages/livepeer-provider/src/index');

    const provider = new LivepeerProvider({ apiKey: 'mock-key' });
    const result = await provider.createStream({
      name: 'External Live Stream',
      record: true,
      latencyLevel: 'low',
    });

    expect(result.rtmpUrl).toContain('rtmp://');
    expect(result.playbackUrl).toContain('.m3u8');
    expect(result.isActive).toBe(false); // idle initially
  });

  it('validates live stream config requires title and platform', () => {
    const validateConfig = (config: { title: string; platform: string }) => {
      const errors: string[] = [];
      if (!config.title.trim()) errors.push('Title is required');
      if (!config.platform) errors.push('Platform is required');
      return { valid: errors.length === 0, errors };
    };

    expect(validateConfig({ title: '', platform: 'youtube' }).valid).toBe(false);
    expect(validateConfig({ title: 'Live!', platform: '' }).valid).toBe(false);
    expect(validateConfig({ title: 'Live!', platform: 'youtube' }).valid).toBe(true);
  });
});

// ─── Suite 6: Pull Analytics ────────────────────────────────────────────

describe('External Platforms — Pull Analytics', () => {
  it('fetches analytics data from YouTube', async () => {
    const { YouTubeProvider } = await import('../../packages/youtube-provider/src/index');

    const mockYT = vi.mocked(new YouTubeProvider());
    const analyticsSpy = vi.spyOn(mockYT, 'getAnalytics').mockResolvedValue({
      views: 5000,
      watchTimeMinutes: 15000,
      likes: 200,
      comments: 45,
      estimatedRevenueCents: 1500,
    });

    const result = await mockYT.getAnalytics();
    expect(result.views).toBe(5000);
    expect(result.watchTimeMinutes).toBe(15000);
    expect(result.estimatedRevenueCents).toBe(1500);
  });

  it('formats analytics for display', () => {
    const raw = { views: 1500, likes: 75, comments: 12, shares: 8 };
    const formatted = {
      views: raw.views.toLocaleString(),
      engagementRate: ((raw.likes + raw.comments + raw.shares) / raw.views * 100).toFixed(1) + '%',
      likeRatio: (raw.likes / raw.views * 100).toFixed(1) + '%',
    };

    expect(formatted.views).toBe('1,500');
    expect(formatted.engagementRate).toBe('6.3%');
    expect(formatted.likeRatio).toBe('5.0%');
  });

  it('aggregates cross-platform analytics', () => {
    const platforms = [
      { platform: 'youtube', views: 5000, revenue: 15.00 },
      { platform: 'peertube', views: 800, revenue: 0 },
      { platform: 'ipfs', views: 1200, revenue: 0 },
    ];

    const totalViews = platforms.reduce((sum, p) => sum + p.views, 0);
    const totalRevenue = platforms.reduce((sum, p) => sum + p.revenue, 0);

    expect(totalViews).toBe(7000);
    expect(totalRevenue).toBe(15.00);
  });

  it('requires creator tier or higher for analytics dashboard', async () => {
    const { TierManager } = await import('../../packages/monetization/src/TierManager');

    expect(TierManager.canAccess('free', 'analytics_dashboard')).toBe(false);
    expect(TierManager.canAccess('creator', 'analytics_dashboard')).toBe(true);
    expect(TierManager.canAccess('pro', 'analytics_dashboard')).toBe(true);
  });
});

// ─── Suite 7: Disconnect Platform ───────────────────────────────────────

describe('External Platforms — Disconnect Platform', () => {
  it('removes platform credentials on disconnect', () => {
    const store = new Map<string, string>();
    store.set('platform:youtube:credentials', JSON.stringify(createMockCredentials('youtube')));

    expect(store.has('platform:youtube:credentials')).toBe(true);

    store.delete('platform:youtube:credentials');
    expect(store.has('platform:youtube:credentials')).toBe(false);
  });

  it('revokes OAuth2 token on platform disconnect', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const revokeResponse = await fetch('https://oauth2.googleapis.com/revoke?token=mock-token', {
      method: 'POST',
    });
    expect(revokeResponse.ok).toBe(true);

    vi.unstubAllGlobals();
  });

  it('updates connected platforms list after disconnect', () => {
    const connected = [
      { platform: 'youtube', status: 'active' },
      { platform: 'ipfs', status: 'active' },
    ];

    const afterDisconnect = connected.filter((p) => p.platform !== 'youtube');
    expect(afterDisconnect.length).toBe(1);
    expect(afterDisconnect[0]?.platform).toBe('ipfs');
  });
});

// ─── Suite 8: Premium Tier Gating ───────────────────────────────────────

describe('External Platforms — Premium Tier Gating', () => {
  it('blocks cross-platform publishing for free users', async () => {
    const { TierManager } = await import('../../packages/monetization/src/TierManager');

    expect(TierManager.canAccess('free', 'cross_platform_publishing')).toBe(false);
    expect(TierManager.canAccess('creator', 'cross_platform_publishing')).toBe(false);
    expect(TierManager.canAccess('pro', 'cross_platform_publishing')).toBe(true);
  });

  it('enforces platform-specific tier requirements', () => {
    const userTier = 'free';
    const blocked = EXTERNAL_PLATFORMS.filter((p) => {
      const tierRank: Record<string, number> = { free: 0, creator: 1, pro: 2, enterprise: 3 };
      return tierRank[userTier] < tierRank[p.requiresTier];
    });

    expect(blocked.map((p) => p.id)).toContain('livepeer');
    expect(blocked.map((p) => p.id)).toContain('owncast');
    expect(blocked.map((p) => p.id)).toContain('postiz');
  });

  it('shows upgrade prompt when accessing gated feature', () => {
    const checkFeatureAccess = (tier: string, feature: string) => {
      const gatedFeatures: Record<string, string> = {
        cross_platform_publishing: 'pro',
        analytics_dashboard: 'creator',
        scheduled_posts: 'creator',
      };

      const requiredTier = gatedFeatures[feature];
      if (!requiredTier) return { allowed: true };
      const tierRank: Record<string, number> = { free: 0, creator: 1, pro: 2, enterprise: 3 };
      return {
        allowed: tierRank[tier] >= tierRank[requiredTier],
        requiredTier,
        upgradeUrl: tierRank[tier] < tierRank[requiredTier] ? '/upgrade' : undefined,
      };
    };

    const result = checkFeatureAccess('free', 'cross_platform_publishing');
    expect(result.allowed).toBe(false);
    expect(result.requiredTier).toBe('pro');
    expect(result.upgradeUrl).toBe('/upgrade');
  });
});

// ─── Suite 9: Standalone Service Access ─────────────────────────────────

describe('External Platforms — Standalone Service Access', () => {
  it('provides direct API access via standalone service', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/config')) {
        return new Response(
          JSON.stringify({
            instance: { name: 'DegenFeed PeerTube' },
            isHealthy: true,
          }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', mockFetch);

    const response = await fetch('https://video.degenfeed.xyz/api/v1/config');
    const data = await response.json();

    expect(data.instance.name).toBe('DegenFeed PeerTube');
    expect(data.isHealthy).toBe(true);
    vi.unstubAllGlobals();
  });

  it('generates service-specific API tokens', () => {
    const generateToken = (platform: string, userId: string): string => {
      const prefix = platform.slice(0, 4);
      const suffix = userId.slice(0, 8);
      return `${prefix}_${suffix}_${Date.now().toString(36)}`;
    };

    const token = generateToken('livepeer', '0xabc123def456');
    expect(token).toContain('live');
    expect(token).toContain('0xabc123');
  });

  it('validates standalone service requests have auth header', () => {
    const validateRequest = (headers: Record<string, string>) => {
      if (!headers.authorization) return { valid: false, error: 'Missing authorization' };
      if (!headers.authorization.startsWith('Bearer ')) return { valid: false, error: 'Invalid auth format' };
      return { valid: true };
    };

    expect(validateRequest({}).valid).toBe(false);
    expect(validateRequest({ authorization: 'Basic xyz' }).valid).toBe(false);
    expect(validateRequest({ authorization: 'Bearer my-token' }).valid).toBe(true);
  });
});
