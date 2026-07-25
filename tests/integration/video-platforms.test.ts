/**
 * @degenfeed/integration — Video Platforms Tests
 *
 * Tests the video platform pipeline: YouTube content detection, creator discovery,
 * quality scoring, anti-clickbait penalties, IPFS/Arweave video detection,
 * storage tier routing, zero-cost route detection, and video feed aggregation.
 *
 * Pure functions tested directly. External APIs mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock YouTube provider ─────────────────────────────────────────

vi.mock('@degenfeed/youtube-provider', () => ({
  fetchYouTubeFeed: vi.fn().mockResolvedValue([
    {
      id: 'vid_1',
      title: 'Bitcoin to $1M? Real Analysis',
      description: 'Deep dive into Bitcoin price action and on-chain metrics',
      channelName: 'Crypto Analyst',
      channelId: 'UC_analyst',
      channelCategory: 'crypto',
      publishedMs: Date.now() - 3600000,
      duration: '15:30',
      viewCount: 50000,
      niches: ['bitcoin', 'crypto'],
      qualityScore: { overall: 0.85, clickbaitPenalty: 0 },
      thumbnailUrl: 'https://i.ytimg.com/vi/test/hqdefault.jpg',
    },
    {
      id: 'vid_2',
      title: '😱 YOU WON\'T BELIEVE WHAT BITCOIN DID!!! 🚀🚀🚀',
      description: 'CLICK HERE TO FIND OUT THE SHOCKING TRUTH',
      channelName: 'ClickBait King',
      channelId: 'UC_clickbait',
      channelCategory: 'entertainment',
      publishedMs: Date.now() - 7200000,
      duration: '8:00',
      viewCount: 200000,
      niches: ['bitcoin'],
      qualityScore: { overall: 0.3, clickbaitPenalty: 0.18 },
      thumbnailUrl: 'https://i.ytimg.com/vi/click/hqdefault.jpg',
    },
  ]),
  fetchTrendingByCategory: vi.fn().mockResolvedValue([]),
  discoverCreators: vi.fn().mockResolvedValue([]),
}));

function createMockEnv(): any {
  return {
    CACHE: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
}

// ─── Suite 2: Video Platforms ──────────────────────────────────────

describe('Video Platforms — YouTube Algorithm', () => {
  it('builds user interest profile from watch history', async () => {
    const { buildUserProfile } = await import('../../workers/api/src/feed/youtube-algorithm');

    const profile = buildUserProfile({
      followedCreators: ['Crypto Analyst'],
      watchedVideoIds: ['vid_1'],
      watchedCreatorIds: ['Crypto Analyst'],
      watchHistory: [{ videoId: 'vid_1', creatorId: 'Crypto Analyst', completionRatio: 0.9, watchDurationMs: 800000, timestamp: Date.now() }],
      niches: ['bitcoin', 'crypto'],
      categories: ['crypto'],
    });

    expect(profile.niches).toContain('bitcoin');
    expect(profile.followedCreators).toContain('Crypto Analyst');
    expect(profile.collaborativeHash).toBeDefined();
    expect(profile.collaborativeHash).toMatch(/^ch:/);
  });

  it('applies anti-clickbait penalty to sensational titles', async () => {
    const { YouTubeAlgorithm, buildUserProfile } = await import('../../workers/api/src/feed/youtube-algorithm');
    const env = createMockEnv();

    const algo = new YouTubeAlgorithm(env, { antiClickbait: 1.0 });
    const profile = buildUserProfile({
      followedCreators: [],
      watchedVideoIds: [],
      watchedCreatorIds: [],
      watchHistory: [],
      niches: ['bitcoin'],
      categories: ['crypto'],
    });

    // Mock fetchYouTubeFeed to return our clickbait video
    const mockFetchYouTubeFeed = vi.fn().mockResolvedValue([{
      id: 'click_1',
      title: '😱 YOU WON\'T BELIEVE WHAT HAPPENED!!! 🚀🚀🚀',
      description: 'SHOCKING truth revealed',
      channelName: 'ClickBait King',
      channelId: 'UC_clickbait',
      channelCategory: 'entertainment',
      publishedMs: Date.now() - 3600000,
      duration: '8:00',
      viewCount: 999999,
      niches: ['bitcoin'],
      qualityScore: { overall: 0.3, clickbaitPenalty: 0.18 },
      thumbnailUrl: '',
    }]);

    // We test the scoring function directly through internal methods
    // The scoreVideo method is private, but we can test through the class behavior
    const { YouTubeAlgorithm: AlgoClass } = await import('../../workers/api/src/feed/youtube-algorithm');
    const algo2 = new AlgoClass(env, { antiClickbait: 1.0, contentBased: 0, creatorBased: 0, collaborative: 0, freshness: 0, diversity: 0, watchTime: 0 });

    // Access private method through prototype (for testing only)
    const scoreVideo = (AlgoClass as any).prototype.scoreVideo;
    const result = scoreVideo.call(algo2, {
      id: 'click_1',
      title: '😱 YOU WON\'T BELIEVE WHAT HAPPENED!!! 🚀🚀🚀',
      description: 'SHOCKING truth revealed',
      channelName: 'ClickBait King',
      channelId: 'UC_clickbait',
      channelCategory: 'entertainment',
      publishedMs: Date.now() - 3600000,
      duration: '8:00',
      viewCount: 999999,
      niches: ['bitcoin'],
      qualityScore: { overall: 0.3, clickbaitPenalty: 0.18 },
      thumbnailUrl: '',
    }, profile);

    // Note: anti-clickbait score is 1 - clickbaitPenalty = 0.82, weighted by 1.0
    expect(result.breakdown.antiClickbait).toBeLessThan(1.0);
    expect(result.reasons).toContain('clickbait-adjusted');
  });

  it('boosts content from followed creators', async () => {
    const { buildUserProfile } = await import('../../workers/api/src/feed/youtube-algorithm');
    const { YouTubeAlgorithm: AlgoClass } = await import('../../workers/api/src/feed/youtube-algorithm');
    const env = createMockEnv();

    const profile = buildUserProfile({
      followedCreators: ['Crypto Analyst'],
      watchedVideoIds: ['vid_1'],
      watchedCreatorIds: ['Crypto Analyst'],
      watchHistory: [{ videoId: 'vid_1', creatorId: 'Crypto Analyst', completionRatio: 0.9, watchDurationMs: 800000, timestamp: Date.now() }],
      niches: ['bitcoin'],
      categories: ['crypto'],
    });

    const algo = new AlgoClass(env, { creatorBased: 1.0, contentBased: 0, collaborative: 0, freshness: 0, diversity: 0, watchTime: 0, antiClickbait: 0 });

    const scoreVideo = (AlgoClass as any).prototype.scoreVideo;
    const result = scoreVideo.call(algo, {
      id: 'vid_followed',
      title: 'Bitcoin Analysis',
      description: 'Detailed analysis',
      channelName: 'Crypto Analyst',
      channelId: 'UC_analyst',
      channelCategory: 'crypto',
      publishedMs: Date.now() - 3600000,
      duration: '10:00',
      viewCount: 1000,
      niches: ['bitcoin'],
      thumbnailUrl: '',
    }, profile);

    expect(result.breakdown.creatorBased).toBe(1.0);
    expect(result.reasons).toContain('from a creator you follow');
  });

  it('computes collaborative hash from watched IDs', async () => {
    const { computeCollaborativeHash } = await import('../../workers/api/src/feed/youtube-algorithm');

    const hash1 = computeCollaborativeHash(['a', 'b', 'c']);
    const hash2 = computeCollaborativeHash(['a', 'b', 'c']); // same
    const hash3 = computeCollaborativeHash(['x', 'y', 'z']); // different

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toMatch(/^ch:/);
  });
});

describe('Video Platforms — IPFS/Arweave Detection', () => {
  it('detects IPFS content from ipfs:// protocol', async () => {
    const { detectDecentralizedVideo } = await import('../../workers/api/src/feed/video-bridges/ipfs-arweave-video');

    const result = detectDecentralizedVideo('ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ipfs');
    expect(result!.cid).toBe('QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco');
    expect(result!.gatewayUrl).toContain('ipfs');
  });

  it('detects IPFS from gateway URL path', async () => {
    const { detectDecentralizedVideo } = await import('../../workers/api/src/feed/video-bridges/ipfs-arweave-video');

    const result = detectDecentralizedVideo('https://cloudflare-ipfs.com/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ipfs');
    expect(result!.cid).toBe('QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco');
  });

  it('detects Arweave content from ar:// protocol', async () => {
    const { detectDecentralizedVideo, resolveArweaveUrl } = await import('../../workers/api/src/feed/video-bridges/ipfs-arweave-video');

    const result = detectDecentralizedVideo('ar://abc123def456ghi789jkl');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('arweave');
    expect(result!.cid).toBe('abc123def456ghi789jkl');

    const url = resolveArweaveUrl('abc123');
    expect(url).toContain('arweave.net');
    expect(url).toContain('abc123');
  });

  it('returns null for non-decentralized URLs', async () => {
    const { detectDecentralizedVideo } = await import('../../workers/api/src/feed/video-bridges/ipfs-arweave-video');

    const result = detectDecentralizedVideo('https://youtube.com/watch?v=abc123');
    expect(result).toBeNull();
  });
});

describe('Video Platforms — Storage Tier Routing', () => {
  it('routes short videos to IPFS (zero cost)', async () => {
    const { analyzeStorageRoute } = await import('../../workers/api/src/lib/video-storage-router');

    const decision = analyzeStorageRoute({
      duration: 30, // < 60s
      fileSize: 5 * 1024 * 1024,
      nativeUpload: true,
    });

    expect(decision.backend).toBe('ipfs');
    expect(decision.contentType).toBe('short');
    expect(decision.isZeroCost).toBe(true);
    expect(decision.estimatedMonthlyCostUsd).toBe(0);
  });

  it('routes long-form VOD to R2+IPFS', async () => {
    const { analyzeStorageRoute } = await import('../../workers/api/src/lib/video-storage-router');

    const decision = analyzeStorageRoute({
      duration: 300, // 5 min
      fileSize: 50 * 1024 * 1024,
      nativeUpload: true,
    });

    expect(decision.backend).toBe('r2+ipfs');
    expect(decision.contentType).toBe('longform');
    expect(decision.isZeroCost).toBe(false);
  });

  it('detects YouTube URLs as zero-cost route', async () => {
    const { analyzeStorageRoute } = await import('../../workers/api/src/lib/video-storage-router');

    const decision = analyzeStorageRoute({
      externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      duration: 120,
      nativeUpload: false,
    });

    expect(decision.backend).toBe('youtube-embed');
    expect(decision.isZeroCost).toBe(true);
    expect(decision.estimatedMonthlyCostUsd).toBe(0);
    expect(decision.externalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('detects Twitch URLs as zero-cost route', async () => {
    const { analyzeStorageRoute } = await import('../../workers/api/src/lib/video-storage-router');

    const decision = analyzeStorageRoute({
      externalUrl: 'https://www.twitch.tv/monstercat',
      duration: 600,
    });

    expect(decision.backend).toBe('twitch-embed');
    expect(decision.isZeroCost).toBe(true);
  });

  it('classifies content by duration', async () => {
    const { classifyContentType } = await import('../../workers/api/src/lib/video-storage-router');

    expect(classifyContentType(30)).toBe('short');       // <60s
    expect(classifyContentType(120)).toBe('longform');    // 1-10min
    expect(classifyContentType(600)).toBe('podcast');     // 10-60min
    expect(classifyContentType(3600)).toBe('livestream'); // 60+ min
  });

  it('maps bridge sources with metadata', async () => {
    const { BRIDGE_SOURCES, BRIDGE_SOURCE_META } = await import('../../workers/api/src/feed/video-bridges/index');

    expect(Array.isArray(BRIDGE_SOURCES)).toBe(true);
    expect(BRIDGE_SOURCES.length).toBeGreaterThan(10);

    // Each source should have metadata
    for (const source of BRIDGE_SOURCES) {
      expect(BRIDGE_SOURCE_META[source]).toBeDefined();
      expect(BRIDGE_SOURCE_META[source].label).toBeDefined();
      expect(BRIDGE_SOURCE_META[source].color).toBeDefined();
    }

    expect(BRIDGE_SOURCE_META.youtube.label).toBe('YouTube');
    expect(BRIDGE_SOURCE_META.ipfs.label).toBe('IPFS Video');
    expect(BRIDGE_SOURCE_META.arweave.label).toBe('Arweave Video');
  });
});
