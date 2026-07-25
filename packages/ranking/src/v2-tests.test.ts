/**
 * Tests for V2 Feed Algorithm improvements:
 * TASK 1: Content Quality Scoring V2
 * TASK 2: User Algo V2
 * TASK 3: Protocol-Level Algo
 * TASK 4: Anti-Gaming Protection
 * TASK 5: Algorithm Transparency
 */

import { describe, expect, it } from 'vitest';

// ─── Shared test data ──────────────────────────────────────────────────

const makePost = (overrides: Record<string, unknown> = {}) => ({
  id: 'nostr:test-post-1',
  protocol: 'nostr' as const,
  author: {
    id: 'nostr:author-1',
    primary: { protocol: 'nostr' as const, id: 'author-1' },
    handles: { nostr: null, farcaster: null, lens: null, bluesky: null, threads: null, rss: null, mastodon: null },
    displayName: 'Test Author',
    bio: 'A test author for unit tests',
    avatarUrl: '',
    verified: [{ protocol: 'nostr' as const, badge: 'nip05' }],
    followerCount: 5000,
    followingCount: 200,
    links: [],
    keys: {},
  },
  text: 'This is a test post about Bitcoin and Ethereum. The market is looking bullish today! #crypto #bitcoin',
  embeds: [],
  createdAt: Date.now() - 3600000, // 1 hour ago
  metrics: { likes: 150, reposts: 30, replies: 15, quotes: 5 },
  engagement: {
    viewerLiked: false,
    viewerReposted: false,
    viewerBookmarked: false,
    raw: { likes: 150, reposts: 30, replies: 15, quotes: 5 },
  },
  raw: null,
  niches: ['bitcoin', 'ethereum', 'crypto'],
  contentType: 'text',
  ...overrides,
});

// ═════════════════════════════════════════════════════════════════════
// TASK 1: Content Quality Scoring V2
// ═════════════════════════════════════════════════════════════════════

describe('TASK 1: Content Quality Scoring V2', () => {
  it('should compute quality V2 signals', async () => {
    const { scoreQualityV2 } = await import('./quality-v2');
    const post = makePost();
    const signals = scoreQualityV2(post, {
      context: { now: Date.now() },
    });

    expect(signals).toBeDefined();
    expect(signals.compositeScore).toBeGreaterThanOrEqual(0);
    expect(signals.compositeScore).toBeLessThanOrEqual(100);
    expect(typeof signals.engagementRate).toBe('number');
    expect(typeof signals.textQuality).toBe('number');
    expect(typeof signals.mediaQuality).toBe('number');
    expect(typeof signals.sourceFreshness).toBe('number');
    expect(typeof signals.replyQuality).toBe('number');
    expect(typeof signals.shareVelocity).toBe('number');
    expect(typeof signals.creatorReputation).toBe('number');
  });

  it('should give higher text quality for well-written content', async () => {
    const { scoreQualityV2 } = await import('./quality-v2');

    const goodPost = makePost({
      text: 'Bitcoin is a decentralized digital currency that enables peer-to-peer transactions without intermediaries. The underlying blockchain technology ensures transparency and security through cryptographic proof.',
    });
    const goodSignals = scoreQualityV2(goodPost);

    const spamPost = makePost({
      text: 'BUY NOW!!! https://scam-link.com CHECK THIS OUT!!! 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀',
    });
    const spamSignals = scoreQualityV2(spamPost);

    expect(goodSignals.textQuality).toBeGreaterThan(spamSignals.textQuality);
  });

  it('should detect media quality from embeds', async () => {
    const { scoreQualityV2 } = await import('./quality-v2');

    const hdImagePost = makePost({
      embeds: [{ kind: 'image', url: 'https://example.com/photo.jpg', meta: { width: 1920, height: 1080 } }],
    });
    const hdSignals = scoreQualityV2(hdImagePost);
    expect(hdSignals.mediaQuality).toBeGreaterThan(0.6);

    const textOnlyPost = makePost();
    const textSignals = scoreQualityV2(textOnlyPost);
    expect(textSignals.mediaQuality).toBe(0.5); // Neutral baseline
  });

  it('should compute share velocity from engagement rate', async () => {
    const { scoreQualityV2 } = await import('./quality-v2');

    const viralPost = makePost({
      metrics: { likes: 10000, reposts: 2000, replies: 500, quotes: 200 },
      createdAt: Date.now() - 600000, // 10 min ago
    });
    const viralSignals = scoreQualityV2(viralPost);
    expect(viralSignals.shareVelocity).toBeGreaterThan(0.5);

    const slowPost = makePost({
      metrics: { likes: 2, reposts: 0, replies: 0, quotes: 0 },
      createdAt: Date.now() - 86400000, // 1 day ago
    });
    const slowSignals = scoreQualityV2(slowPost);
    expect(slowSignals.shareVelocity).toBeLessThan(0.5);
  });

  it('should compute creator reputation from verification and followers', async () => {
    const { scoreQualityV2 } = await import('./quality-v2');

    const verifiedCreator = makePost({
      author: {
        ...makePost().author,
        verified: [{ protocol: 'nostr' as const, badge: 'nip05' }],
        followerCount: 100000,
      },
    });
    const verifiedSignals = scoreQualityV2(verifiedCreator);
    expect(verifiedSignals.creatorReputation).toBeGreaterThan(0.6);

    const newCreator = makePost({
      author: {
        ...makePost().author,
        verified: [],
        followerCount: 0,
      },
    });
    const newSignals = scoreQualityV2(newCreator);
    expect(newSignals.creatorReputation).toBeLessThan(0.5);
  });

  it('should compute engagement rate normalized to followers', async () => {
    const { scoreQualityV2 } = await import('./quality-v2');

    const highEngPost = makePost({
      metrics: { likes: 500, reposts: 100, replies: 50, quotes: 10 },
      author: { ...makePost().author, followerCount: 1000 },
    });
    const highSignals = scoreQualityV2(highEngPost);
    expect(highSignals.engagementRate).toBeGreaterThan(0.3);

    const lowEngPost = makePost({
      metrics: { likes: 10, reposts: 2, replies: 1, quotes: 0 },
      author: { ...makePost().author, followerCount: 100000 },
    });
    const lowSignals = scoreQualityV2(lowEngPost);
    expect(lowSignals.engagementRate).toBeLessThan(highSignals.engagementRate);
  });
});

// ═════════════════════════════════════════════════════════════════════
// TASK 2: User Algo V2
// ═════════════════════════════════════════════════════════════════════

describe('TASK 2: User Algo V2', () => {
  it('should learn interests from engagement', async () => {
    const { learnInterests, emptyUserAlgoV2Profile } = await import('./user-algo-v2');

    let profile = emptyUserAlgoV2Profile();
    const post = makePost({ niches: ['bitcoin', 'defi'] });

    profile = learnInterests(profile, post, 'engage');
    expect(profile.interests['bitcoin']).toBeGreaterThan(0);
    expect(profile.interests['defi']).toBeGreaterThan(0);
  });

  it('should decrease interest on dismiss', async () => {
    const { learnInterests, emptyUserAlgoV2Profile } = await import('./user-algo-v2');

    let profile = emptyUserAlgoV2Profile();
    profile.interests['bitcoin'] = 0.5;
    const post = makePost({ niches: ['bitcoin'] });

    profile = learnInterests(profile, post, 'dismiss');
    expect(profile.interests['bitcoin']).toBeLessThan(0.5);
  });

  it('should build creator loyalty on engagement', async () => {
    const { learnInterests, emptyUserAlgoV2Profile } = await import('./user-algo-v2');

    let profile = emptyUserAlgoV2Profile();
    const post = makePost({ author: { ...makePost().author, id: 'nostr:fav-creator' } });

    // Engage multiple times
    profile = learnInterests(profile, post, 'engage');
    profile = learnInterests(profile, post, 'engage');
    profile = learnInterests(profile, post, 'engage');

    expect(profile.creatorLoyalty['nostr:fav-creator']).toBeGreaterThan(0.2);
  });

  it('should enforce discovery injection minimum of 15%', async () => {
    const { shouldInjectDiscovery } = await import('./user-algo-v2');
    const { emptyUserAlgoV2Profile } = await import('./user-algo-v2');

    // After 10 posts without discovery, should force injection
    const ctx = {
      behaviorProfile: {} as any,
      v2Profile: { ...emptyUserAlgoV2Profile(), postsSinceDiscovery: 10, discoveryShown: 0 },
      currentHour: 14,
      followedCreators: new Set<string>(),
      recentEngagements: new Set<string>(),
      totalPostsSeen: 50,
    };

    expect(shouldInjectDiscovery(ctx, false, 0)).toBe(true);

    // When discovery ratio is below 15%
    const ctx2 = {
      ...ctx,
      v2Profile: { ...emptyUserAlgoV2Profile(), postsSinceDiscovery: 2, discoveryShown: 2 },
      totalPostsSeen: 50,
    };
    // 2/50 = 4% which is below 15%, so non-followed + new niche = inject
    expect(shouldInjectDiscovery(ctx2, false, 0)).toBe(true);

    // When discovery ratio is above 15%, no need
    const ctx3 = {
      ...ctx2,
      v2Profile: { ...emptyUserAlgoV2Profile(), postsSinceDiscovery: 1, discoveryShown: 10 },
      totalPostsSeen: 50,
    };
    // 10/50 = 20% which is above 15%
    expect(shouldInjectDiscovery(ctx3, true, 1)).toBe(false);
  });

  it('should process feedback signals', async () => {
    const { processFeedback, emptyUserAlgoV2Profile } = await import('./user-algo-v2');

    let profile = emptyUserAlgoV2Profile();
    const post = makePost();

    // "Show more like this"
    profile = processFeedback(profile, post, 'more');
    expect(profile.feedbackSignals.length).toBeGreaterThanOrEqual(3); // creator + niches + contentType

    const creatorSignals = profile.feedbackSignals.filter((s) => s.target === 'creator');
    expect(creatorSignals.length).toBeGreaterThan(0);

    // "Show less like this"
    profile = processFeedback(profile, post, 'less');
    const lessSignals = profile.feedbackSignals.filter((s) => s.type === 'less');
    expect(lessSignals.length).toBeGreaterThan(0);
  });

  it('should apply personalization multiplier correctly', async () => {
    const { scoreUserAlgoV2 } = await import('./user-algo-v2');
    const { emptyUserAlgoV2Profile } = await import('./user-algo-v2');
    const { emptyBehaviorProfile } = await import('@degenfeed/feed-core');

    const post = makePost();
    const result = scoreUserAlgoV2(post, {
      behaviorProfile: emptyBehaviorProfile(),
      v2Profile: emptyUserAlgoV2Profile(),
      currentHour: 14,
      followedCreators: new Set(['nostr:author-1']),
      recentEngagements: new Set(),
      totalPostsSeen: 10,
    });

    expect(result.multiplier).toBeGreaterThan(0);
    expect(result.multiplier).toBeGreaterThanOrEqual(1.0);
    expect(result.reasons).toContain('you follow this creator');
  });
});

// ═════════════════════════════════════════════════════════════════════
// TASK 3: Protocol-Level Algo
// ═════════════════════════════════════════════════════════════════════

describe('TASK 3: Protocol-Level Algo', () => {
  it('should score Nostr posts with relay quality and zaps', async () => {
    const { scoreProtocolAlgo } = await import('./protocol-algo');
    const post = makePost({ protocol: 'nostr' as const });

    const result = scoreProtocolAlgo(post, {
      nostr: {
        relayQuality: 0.9,
        zapTotal: 50000,
        zapCount: 25,
        nip05Verified: true,
        nip05DomainQuality: 1.0,
      },
    });

    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.factors.nip05).toBeGreaterThan(0);
    expect(result.factors.zaps).toBeGreaterThan(0);
    expect(result.reasons).toContain('NIP-05 verified');
  });

  it('should score Farcaster posts with FID age and followers', async () => {
    const { scoreProtocolAlgo } = await import('./protocol-algo');
    const post = makePost({ protocol: 'farcaster' as const });

    const result = scoreProtocolAlgo(post, {
      farcaster: {
        fidAgeDays: 800,
        followerCount: 50000,
        isVerified: true,
        frameEngagementRate: 0.15,
        isPowerUser: true,
      },
    });

    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('should score Bluesky posts with DID age and community reputation', async () => {
    const { scoreProtocolAlgo } = await import('./protocol-algo');
    const post = makePost({ protocol: 'bluesky' as const });

    const result = scoreProtocolAlgo(post, {
      bluesky: {
        didAgeDays: 500,
        postQuality: 0.8,
        communityReputation: 0.9,
        listedInStarterPacks: 10,
      },
    });

    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.reasons).toContain('high quality post');
    expect(result.reasons).toContain('good community reputation');
  });

  it('should score Mastodon posts with instance reputation and boost ratio', async () => {
    const { scoreProtocolAlgo } = await import('./protocol-algo');
    const post = makePost({ protocol: 'mastodon' as const });

    const result = scoreProtocolAlgo(post, {
      mastodon: {
        instanceReputation: 0.85,
        boostCount: 200,
        favoriteBoostRatio: 5.0,
        isWellModerated: true,
        instanceUserCount: 50000,
      },
    });

    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.reasons).toContain('well-moderated instance');
  });

  it('should score PeerTube posts with video quality and subscribers', async () => {
    const { scoreProtocolAlgo } = await import('./protocol-algo');
    const post = makePost({ protocol: 'peertube' as const });

    const result = scoreProtocolAlgo(post, {
      peertube: {
        videoResolution: 2160,
        channelSubscribers: 50000,
        isFederated: true,
        duration: 600,
        channelEngagementRate: 0.7,
      },
    });

    expect(result.multiplier).toBeGreaterThan(1.0);
    expect(result.reasons).toContain('HD video');
  });

  it('should return neutral multiplier for unknown protocols', async () => {
    const { scoreProtocolAlgo } = await import('./protocol-algo');
    // Use a custom unsupported protocol
    const post = makePost({ protocol: 'unknown-protocol' as any });

    const result = scoreProtocolAlgo(post, {});
    expect(result.multiplier).toBeGreaterThanOrEqual(0.5);
    expect(result.multiplier).toBeLessThanOrEqual(2.0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// TASK 4: Anti-Gaming Protection
// ═════════════════════════════════════════════════════════════════════

describe('TASK 4: Anti-Gaming Protection', () => {
  it('should detect engagement farms', async () => {
    const { scoreAntiGaming } = await import('./anti-gaming');
    const post = makePost();

    // Clear engagement farming signals
    const clean = scoreAntiGaming(post, {
      engagementFarm: { coEngagementRatio: 0.05, coordinatedAccounts: 1, likeTimingStdDevMs: 5000, ipClusterDetected: false },
    });
    expect(clean.trustMultiplier).toBeGreaterThan(0.9);

    // Coordinated farm
    const farmed = scoreAntiGaming(post, {
      engagementFarm: { coEngagementRatio: 0.8, coordinatedAccounts: 50, likeTimingStdDevMs: 200, ipClusterDetected: true },
    });
    expect(farmed.trustMultiplier).toBeLessThan(0.5);
    expect(farmed.reasons.some((r) => r.includes('engagement-farm'))).toBe(true);
  });

  it('should detect bot accounts', async () => {
    const { scoreAntiGaming } = await import('./anti-gaming');

    const post = makePost();

    // Legitimate account
    const human = scoreAntiGaming(post, {
      botDetection: {
        accountAgeDays: 365,
        postsPerDay: 3,
        repostRatio: 0.3,
        bioQuality: 'normal',
        hasAvatar: true,
        followerFollowingRatio: 2.0,
        engagementConsistency: 0.4,
      },
    });
    expect(human.trustMultiplier).toBeGreaterThan(0.8);

    // Bot account
    const bot = scoreAntiGaming(post, {
      botDetection: {
        accountAgeDays: 1,
        postsPerDay: 100,
        repostRatio: 0.95,
        bioQuality: 'empty',
        hasAvatar: false,
        followerFollowingRatio: 500,
        engagementConsistency: 0.99,
      },
    });
    expect(bot.trustMultiplier).toBeLessThan(0.5);
    expect(bot.reasons.some((r) => r.includes('bot-detection'))).toBe(true);
  });

  it('should detect spam content', async () => {
    const { scoreAntiGaming } = await import('./anti-gaming');

    const post = makePost();

    // Clean post
    const clean = scoreAntiGaming(post, {
      spamDetection: {
        textUniqueness: 1,
        linkDensity: 0.02,
        hashtagCount: 2,
        isNearDuplicate: false,
        isLinkDump: false,
        excessiveFormatting: false,
      },
    });
    expect(clean.trustMultiplier).toBeGreaterThan(0.8);

    // Spam post
    const spam = scoreAntiGaming(post, {
      spamDetection: {
        textUniqueness: 0.1,
        linkDensity: 0.6,
        hashtagCount: 25,
        isNearDuplicate: true,
        isLinkDump: true,
        excessiveFormatting: true,
      },
    });
    expect(spam.trustMultiplier).toBeLessThan(0.5);
    expect(spam.reasons.some((r) => r.includes('spam'))).toBe(true);
  });

  it('should detect sybil accounts', async () => {
    const { scoreAntiGaming } = await import('./anti-gaming');

    const post = makePost();

    // Unique account
    const unique = scoreAntiGaming(post, {
      sybilDetection: { siblingAccounts: 0, batchCreated: false, sybilPatternScore: 0, hasUniqueIdentity: true },
    });
    expect(unique.trustMultiplier).toBeGreaterThan(0.8);

    // Sybil cluster
    const sybil = scoreAntiGaming(post, {
      sybilDetection: { siblingAccounts: 25, batchCreated: true, sybilPatternScore: 0.9, hasUniqueIdentity: false },
    });
    expect(sybil.trustMultiplier).toBeLessThan(0.5);
    expect(sybil.reasons.some((r) => r.includes('sybil'))).toBe(true);
  });

  it('should analyze text spam signals', async () => {
    const { analyzeTextSpam } = await import('./anti-gaming');

    const cleanText = analyzeTextSpam('This is a normal post about crypto markets.');
    expect(cleanText.linkDensity).toBe(0);
    expect(cleanText.isLinkDump).toBe(false);
    expect(cleanText.excessiveFormatting).toBe(false);

    const spamText = analyzeTextSpam(
      'BUY NOW!!! https://scam-link.com https://another-link.com 🚀🚀🚀🚀🚀🚀🚀🚀🚀 #crypto #bitcoin #moon #profit #rich #money #invest #free #win #bonus #sale #deal',
    );
    expect(spamText.linkDensity).toBeGreaterThan(0);
    expect(spamText.isLinkDump).toBe(true);
    expect(spamText.hashtagCount).toBeGreaterThan(10);
    expect(spamText.excessiveFormatting).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// TASK 5: Algorithm Transparency
// ═════════════════════════════════════════════════════════════════════

describe('TASK 5: Algorithm Transparency', () => {
  it('should build "Why This Post?" explanation', async () => {
    const { whyThisPost } = await import('./transparency');
    const { DEFAULT_UNIFIED_WEIGHTS, scorePost } = await import('./unified-scorer');

    const post = makePost();
    const result = scorePost(post);

    const explanation = whyThisPost(post, result.breakdown, DEFAULT_UNIFIED_WEIGHTS);
    expect(explanation.title).toBeTruthy();
    expect(explanation.summary).toBeTruthy();
    expect(explanation.factors.length).toBeGreaterThan(0);
    expect(explanation.totalScore).toBeGreaterThan(0);

    // Top factor should be listed
    const topFactor = explanation.factors[0];
    expect(topFactor.name).toBeTruthy();
    expect(topFactor.icon).toBeTruthy();
    expect(topFactor.label).toBeTruthy();
    expect(topFactor.description).toBeTruthy();
  });

  it('should show "You follow" title for followed creators', async () => {
    const { whyThisPost } = await import('./transparency');
    const { DEFAULT_UNIFIED_WEIGHTS, scorePost } = await import('./unified-scorer');

    const post = makePost();
    const result = scorePost(post, {
      followedCreators: new Set(['nostr:author-1']),
    });

    const explanation = whyThisPost(post, result.breakdown, DEFAULT_UNIFIED_WEIGHTS);
    expect(explanation.title).toContain('You follow');
  });

  it('should build score breakdown UI with weights', async () => {
    const { buildScoreBreakdownUI } = await import('./transparency');
    const { DEFAULT_UNIFIED_WEIGHTS } = await import('./unified-scorer');

    const dummyBreakdown = {
      total: 50,
      recency: 0.8,
      engagement: 0.6,
      relevance: 0.5,
      quality: 0.7,
      reputation: 0.4,
      diversity: 0.9,
      source: 0.8,
      velocity: 0.3,
      reasons: ['fresh', 'on-topic'],
    };

    const ui = buildScoreBreakdownUI(dummyBreakdown, DEFAULT_UNIFIED_WEIGHTS);
    expect(ui.weights).toEqual(DEFAULT_UNIFIED_WEIGHTS);
    expect(ui.total).toBe(50);
  });

  it('should generate tuning suggestions', async () => {
    const { suggestTuning } = await import('./transparency');
    const { DEFAULT_UNIFIED_WEIGHTS } = await import('./unified-scorer');

    const profile = {
      interests: {},
      temporalPrefs: {},
      formatPrefs: { text: 0.8, image: 0.7, video: 0.3, audio: 0.2, link: 0.4 },
      creatorLoyalty: { 'nostr:c1': 0.6, 'nostr:c2': 0.7, 'nostr:c3': 0.5, 'nostr:c4': 0.6, 'nostr:c5': 0.5, 'nostr:c6': 0.4 },
      feedbackSignals: [
        { type: 'less' as const, target: 'topic' as const, targetId: 'memecoin', timestamp: Date.now(), confidence: 3 },
        { type: 'less' as const, target: 'topic' as const, targetId: 'nft', timestamp: Date.now(), confidence: 2 },
        { type: 'less' as const, target: 'topic' as const, targetId: 'gaming', timestamp: Date.now(), confidence: 1 },
        { type: 'less' as const, target: 'topic' as const, targetId: 'defi', timestamp: Date.now(), confidence: 2 },
      ],
      lastActivityByHour: {},
      postsSinceDiscovery: 0,
      discoveryShown: 0,
    };

    const suggestions = suggestTuning(DEFAULT_UNIFIED_WEIGHTS, profile as any, 0.05);
    expect(Array.isArray(suggestions)).toBe(true);
  });

  it('should assign A/B tests deterministically', async () => {
    const { assignABTest } = await import('./transparency');

    // Same user + same test = same result every time
    const result1 = assignABTest('user-abc', { testId: 'test-quality-v2', variantPercent: 50, params: { qualityWeight: 60 } });
    const result2 = assignABTest('user-abc', { testId: 'test-quality-v2', variantPercent: 50, params: { qualityWeight: 60 } });
    expect(result1.isVariant).toBe(result2.isVariant);

    // Different users may get different assignments
    const result3 = assignABTest('user-xyz', { testId: 'test-quality-v2', variantPercent: 50, params: { qualityWeight: 60 } });
    // At least 50% chance they're the same, but we just check it's valid
    expect(typeof result3.isVariant).toBe('boolean');
  });

  it('should create audit entries', async () => {
    const { createAuditEntry } = await import('./transparency');
    const { DEFAULT_UNIFIED_WEIGHTS } = await import('./unified-scorer');

    const post = makePost();
    const breakdown = {
      total: 45,
      recency: 0.7,
      engagement: 0.5,
      relevance: 0.6,
      quality: 0.4,
      reputation: 0.3,
      diversity: 0.8,
      source: 0.7,
      velocity: 0.2,
      reasons: ['fresh', 'on-topic'],
    };

    const entry = createAuditEntry('user-abc', post as any, breakdown, DEFAULT_UNIFIED_WEIGHTS, {
      position: 3,
      mode: 'for-you',
    });
    expect(entry.userId).toBe('user-abc');
    expect(entry.postId).toBe(post.id);
    expect(entry.position).toBe(3);
    expect(entry.mode).toBe('for-you');
    expect(entry.reasons.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// V2 Orchestrator Integration
// ═════════════════════════════════════════════════════════════════════

describe('V2 Orchestrator Integration', () => {
  it('should run the full V2 scoring pipeline', async () => {
    const { scorePostV2, createUserAlgoV2Context } = await import('./feed-algorithm-v2');
    const { emptyBehaviorProfile } = await import('@degenfeed/feed-core');
    const { emptyUserAlgoV2Profile } = await import('./user-algo-v2');

    const post = makePost();
    const userAlgoCtx = createUserAlgoV2Context(
      emptyBehaviorProfile(),
      emptyUserAlgoV2Profile(),
      new Set(['nostr:author-1']),
      14,
    );

    const result = scorePostV2(post, {
      mode: 'for-you',
      userAlgoContext: userAlgoCtx,
      protocolContext: {
        nostr: { relayQuality: 0.9, nip05Verified: true, zapTotal: 10000, zapCount: 10 },
      },
      antiGamingContext: {
        botDetection: { accountAgeDays: 365, postsPerDay: 3, repostRatio: 0.2, bioQuality: 'normal', hasAvatar: true, followerFollowingRatio: 25, engagementConsistency: 0.4 },
      },
    });

    // All pipeline stages should have run
    expect(result.total).toBeGreaterThan(0);
    expect(result.baseBreakdown).toBeDefined();
    expect(result.qualityV2).toBeDefined();
    expect(result.personalization).toBeDefined();
    expect(result.protocol).toBeDefined();
    expect(result.antiGaming).toBeDefined();
    expect(result.explanation).toBeDefined();
    expect(result.explanation.factors.length).toBeGreaterThan(0);
    expect(result.explanation.summary).toBeTruthy();
    expect(result.breakdownUI).toBeDefined();
  });

  it('should apply discovery injection flag', async () => {
    const { scorePostV2, createUserAlgoV2Context } = await import('./feed-algorithm-v2');
    const { emptyBehaviorProfile } = await import('@degenfeed/feed-core');
    const { emptyUserAlgoV2Profile } = await import('./user-algo-v2');

    const post = makePost({ author: { ...makePost().author, id: 'nostr:unknown' } });

    const userAlgoCtx = createUserAlgoV2Context(
      emptyBehaviorProfile(),
      {
        ...emptyUserAlgoV2Profile(),
        postsSinceDiscovery: 10, // Force discovery
      },
      new Set(), // Not followed
      14,
    );

    const result = scorePostV2(post, {
      userAlgoContext: userAlgoCtx,
    });

    expect(result.isDiscovery).toBe(true);
    // When discovery is forced, the personalization multiplier should be >1
    expect(result.personalization?.isDiscovery).toBe(true);
  });

  it('should rank multiple posts correctly', async () => {
    const { rankV2: rankV2Full, createUserAlgoV2Context } = await import('./feed-algorithm-v2');
    const { emptyBehaviorProfile } = await import('@degenfeed/feed-core');
    const { emptyUserAlgoV2Profile } = await import('./user-algo-v2');

    const posts = [
      makePost({ id: 'p1', text: 'High quality post about Bitcoin' }),
      makePost({ id: 'p2', text: 'Low effort post', author: { ...makePost().author, followerCount: 0, verified: [] } }),
      makePost({ id: 'p3', text: 'Another good post', metrics: { likes: 5, reposts: 1, replies: 0, quotes: 0 } }),
    ];

    const userAlgoCtx = createUserAlgoV2Context(
      emptyBehaviorProfile(),
      emptyUserAlgoV2Profile(),
      new Set(),
      14,
    );

    const ranked = rankV2Full(posts, {
      userOptions: { userAlgoContext: userAlgoCtx },
      maxPerAuthor: 3,
    });

    expect(ranked.length).toBe(3);
    // Should be sorted by score descending
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].result.total).toBeGreaterThanOrEqual(ranked[i].result.total);
    }

    // Each should have an explanation with position
    ranked.forEach((item, i) => {
      expect(item.result.explanation.position).toBe(i);
    });
  });

  it('should export all V2 modules from index', async () => {
    const mod = await import('./index');

    // TASK 1
    expect(typeof mod.scoreQualityV2).toBe('function');
    expect(typeof mod.enrichWithQualityV2).toBe('function');

    // TASK 2
    expect(typeof mod.learnInterests).toBe('function');
    expect(typeof mod.learnTemporalPrefs).toBe('function');
    expect(typeof mod.processFeedback).toBe('function');
    expect(typeof mod.scoreUserAlgoV2).toBe('function');
    expect(typeof mod.shouldInjectDiscovery).toBe('function');
    expect(typeof mod.emptyUserAlgoV2Profile).toBe('function');

    // TASK 3
    expect(typeof mod.scoreProtocolAlgo).toBe('function');
    expect(typeof mod.extractProtocolSignalsFromPost).toBe('function');

    // TASK 4
    expect(typeof mod.scoreAntiGaming).toBe('function');
    expect(typeof mod.analyzeTextSpam).toBe('function');
    expect(typeof mod.extractSpamSignalsFromPost).toBe('function');

    // TASK 5
    expect(typeof mod.whyThisPost).toBe('function');
    expect(typeof mod.buildScoreBreakdownUI).toBe('function');
    expect(typeof mod.suggestTuning).toBe('function');
    expect(typeof mod.assignABTest).toBe('function');
    expect(typeof mod.createAuditEntry).toBe('function');

    // V2 Orchestrator
    expect(typeof mod.scorePostV2).toBe('function');
    expect(typeof mod.createUserAlgoV2Context).toBe('function');
    expect(typeof mod.getTuningSuggestions).toBe('function');
  });
});
