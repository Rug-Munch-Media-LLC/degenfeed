import { describe, expect, it } from 'vitest';
import type {
  CreateSpaceOptions,
  CreateSpaceResult,
  SpaceAnnouncement,
  SpaceGating,
  SpaceItem,
  SpacePlatformData,
  SpaceReaction,
  SpaceSpeaker,
} from './types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeSpeaker(overrides: Partial<SpaceSpeaker> = {}): SpaceSpeaker {
  return {
    id: 'user:abc',
    displayName: 'Test Host',
    isHost: true,
    isCoHost: false,
    speaking: true,
    ...overrides,
  };
}

function makeReaction(overrides: Partial<SpaceReaction> = {}): SpaceReaction {
  return {
    userId: 'user:abc',
    emoji: '🔥',
    createdAt: Date.now(),
    ...overrides,
  };
}

function makePlatformData(overrides: Partial<SpacePlatformData> = {}): SpacePlatformData {
  return {
    platform: 'nostr',
    nativeId: 'event-abc-123',
    url: 'https://app.degenfeed.xyz/spaces/space-abc',
    ...overrides,
  };
}

function makeSpaceItem(overrides: Partial<SpaceItem> = {}): SpaceItem {
  return {
    id: 'nostr:event-abc-123',
    title: 'Test Space: DeFi Talk',
    hostId: 'user:abc',
    hostName: 'Test Host',
    coHosts: [],
    platforms: [makePlatformData()],
    status: 'live',
    createdAt: Date.now(),
    listeners: 42,
    speakers: [makeSpeaker()],
    reactions: [],
    tippingEnabled: true,
    ...overrides,
  };
}

// ─── SpaceSpeaker ─────────────────────────────────────────────────────────

describe('SpaceSpeaker', () => {
  it('should create a host speaker with required fields', () => {
    const speaker = makeSpeaker();
    expect(speaker.id).toBe('user:abc');
    expect(speaker.displayName).toBe('Test Host');
    expect(speaker.isHost).toBe(true);
    expect(speaker.isCoHost).toBe(false);
    expect(speaker.speaking).toBe(true);
  });

  it('should create a co-host speaker', () => {
    const speaker = makeSpeaker({
      id: 'user:def',
      displayName: 'Co-Host',
      isHost: false,
      isCoHost: true,
    });
    expect(speaker.isHost).toBe(false);
    expect(speaker.isCoHost).toBe(true);
  });

  it('should create a non-speaking attendee', () => {
    const speaker = makeSpeaker({
      id: 'user:xyz',
      displayName: 'Listener',
      isHost: false,
      isCoHost: false,
      speaking: false,
    });
    expect(speaker.speaking).toBe(false);
    expect(speaker.isHost).toBe(false);
  });

  it('should support optional fields', () => {
    const speaker = makeSpeaker({
      avatarUrl: 'https://example.com/avatar.png',
      handle: '@testuser',
    });
    expect(speaker.avatarUrl).toBe('https://example.com/avatar.png');
    expect(speaker.handle).toBe('@testuser');
  });
});

// ─── SpaceReaction ────────────────────────────────────────────────────────

describe('SpaceReaction', () => {
  it('should create a reaction with required fields', () => {
    const reaction = makeReaction();
    expect(reaction.userId).toBe('user:abc');
    expect(reaction.emoji).toBe('🔥');
    expect(typeof reaction.createdAt).toBe('number');
  });

  it('should support different emojis', () => {
    const reaction = makeReaction({ emoji: '🎙️' });
    expect(reaction.emoji).toBe('🎙️');
  });
});

// ─── SpacePlatformData ────────────────────────────────────────────────────

describe('SpacePlatformData', () => {
  it('should create platform data for audio', () => {
    const pd = makePlatformData({ platform: 'nostr', streamUrl: 'https://relay.example.com' });
    expect(pd.platform).toBe('nostr');
    expect(pd.streamUrl).toBe('https://relay.example.com');
  });

  it('should create platform data for video', () => {
    const pd = makePlatformData({
      platform: 'youtube',
      nativeId: 'abc123',
      url: 'https://youtube.com/watch?v=abc123',
      streamUrl: 'https://youtube.com/embed/abc123',
    });
    expect(pd.platform).toBe('youtube');
    expect(pd.nativeId).toBe('abc123');
  });

  it('should support chat URLs and metadata', () => {
    const pd = makePlatformData({
      platform: 'twitch',
      chatUrl: 'https://twitch.tv/chat/test',
      metadata: { gameName: 'Science & Technology' },
    });
    expect(pd.chatUrl).toBe('https://twitch.tv/chat/test');
    expect(pd.metadata?.gameName).toBe('Science & Technology');
  });
});

// ─── SpaceItem ────────────────────────────────────────────────────────────

describe('SpaceItem', () => {
  it('should create a live space with required fields', () => {
    const space = makeSpaceItem();
    expect(space.id).toBe('nostr:event-abc-123');
    expect(space.title).toBe('Test Space: DeFi Talk');
    expect(space.status).toBe('live');
    expect(space.platforms).toHaveLength(1);
    expect(space.speakers).toHaveLength(1);
  });

  it('should create a scheduled space', () => {
    const space = makeSpaceItem({
      status: 'scheduled',
      scheduledAt: '2026-07-28T18:00:00Z',
      contentType: 'audio',
    });
    expect(space.status).toBe('scheduled');
    expect(space.scheduledAt).toBe('2026-07-28T18:00:00Z');
    expect(space.contentType).toBe('audio');
  });

  it('should create an ended space with recording', () => {
    const space = makeSpaceItem({
      status: 'ended',
      endedAt: Date.now(),
      recordingUrl: 'https://cdn.example.com/recording.mp3',
      recordingReady: true,
    });
    expect(space.status).toBe('ended');
    expect(space.endedAt).toBeGreaterThan(0);
    expect(space.recordingUrl).toBe('https://cdn.example.com/recording.mp3');
    expect(space.recordingReady).toBe(true);
  });

  it('should create a video space with thumbnail', () => {
    const space = makeSpaceItem({
      contentType: 'video',
      thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
      platforms: [makePlatformData({ platform: 'youtube' })],
    });
    expect(space.contentType).toBe('video');
    expect(space.thumbnailUrl).toBe('https://cdn.example.com/thumb.jpg');
  });

  it('should create a photos space with photo URLs', () => {
    const space = makeSpaceItem({
      contentType: 'photos',
      photoUrls: ['https://cdn.example.com/photo1.jpg', 'https://cdn.example.com/photo2.jpg'],
    });
    expect(space.contentType).toBe('photos');
    expect(space.photoUrls).toHaveLength(2);
  });

  it('should support token gating', () => {
    const gating: SpaceGating = {
      type: 'token',
      tokenAddress: '0x1234',
      minBalance: '100',
      chainId: 8453,
    };
    const space = makeSpaceItem({ gating, canAccess: false });
    expect(space.gating?.type).toBe('token');
    expect(space.gating?.chainId).toBe(8453);
    expect(space.canAccess).toBe(false);
  });

  it('should support subscription gating', () => {
    const gating: SpaceGating = { type: 'subscription', subscriptionTier: 'premium' };
    const space = makeSpaceItem({ gating });
    expect(space.gating?.subscriptionTier).toBe('premium');
  });

  it('should support payment gating', () => {
    const gating: SpaceGating = {
      type: 'payment',
      paymentAmount: '1000000000000000',
      paymentToken: 'eth',
    };
    const space = makeSpaceItem({ gating });
    expect(space.gating?.paymentAmount).toBe('1000000000000000');
  });

  it('should support multiple platforms', () => {
    const space = makeSpaceItem({
      platforms: [
        makePlatformData({ platform: 'nostr', nativeId: 'n1' }),
        makePlatformData({ platform: 'youtube', nativeId: 'yt1' }),
        makePlatformData({ platform: 'twitch', nativeId: 'tw1' }),
      ],
    });
    expect(space.platforms).toHaveLength(3);
    expect(space.platforms[0]?.platform).toBe('nostr');
    expect(space.platforms[1]?.platform).toBe('youtube');
    expect(space.platforms[2]?.platform).toBe('twitch');
  });

  it('should support tags', () => {
    const space = makeSpaceItem({ tags: ['crypto', 'defi', 'space'] });
    expect(space.tags).toContain('defi');
    expect(space.tags).toHaveLength(3);
  });
});

// ─── CreateSpaceOptions ───────────────────────────────────────────────────

describe('CreateSpaceOptions', () => {
  it('should create minimal options', () => {
    const opts: CreateSpaceOptions = {
      title: 'Test Space',
      hostId: 'user:abc',
      hostName: 'Test Host',
      platforms: ['nostr'],
    };
    expect(opts.title).toBe('Test Space');
    expect(opts.platforms).toEqual(['nostr']);
  });

  it('should create full options', () => {
    const opts: CreateSpaceOptions = {
      title: 'DeFi Deep Dive',
      description: 'A deep dive into DeFi protocols',
      hostId: 'user:abc',
      hostName: 'Test Host',
      hostAvatarUrl: 'https://example.com/avatar.png',
      coHosts: ['user:def'],
      platforms: ['youtube', 'twitch', 'nostr'],
      scheduledAt: '2026-07-28T18:00:00Z',
      tippingEnabled: true,
      tipTokenAddress: '0x1234',
      contentType: 'video',
      youTubePrivacy: 'public',
      twitchGame: 'Science & Technology',
      tags: ['defi', 'crypto'],
    };
    expect(opts.platforms).toHaveLength(3);
    expect(opts.contentType).toBe('video');
    expect(opts.twitchGame).toBe('Science & Technology');
    expect(opts.youTubePrivacy).toBe('public');
  });

  it('should create options with gating', () => {
    const opts: CreateSpaceOptions = {
      title: 'Premium Space',
      hostId: 'user:abc',
      hostName: 'Test Host',
      platforms: ['livepeer'],
      gating: { type: 'token', tokenAddress: '0xabc', minBalance: '1000', chainId: 1 },
    };
    expect(opts.gating?.type).toBe('token');
    expect(opts.gating?.minBalance).toBe('1000');
  });
});

// ─── CreateSpaceResult ────────────────────────────────────────────────────

describe('CreateSpaceResult', () => {
  it('should hold ID and platform results', () => {
    const result: CreateSpaceResult = {
      id: 'space-123',
      platformResults: [
        { platform: 'nostr', nativeId: 'n1', url: 'https://example.com/n1' },
        { platform: 'youtube', nativeId: 'yt1', error: 'API quota exceeded' },
      ],
    };
    expect(result.id).toBe('space-123');
    expect(result.platformResults).toHaveLength(2);
    const success = result.platformResults.find((r) => !r.error);
    expect(success?.url).toBe('https://example.com/n1');
    const failure = result.platformResults.find((r) => r.error);
    expect(failure?.error).toBe('API quota exceeded');
  });
});

// ─── SpaceAnnouncement ───────────────────────────────────────────────────

describe('SpaceAnnouncement', () => {
  it('should create a minimal announcement', () => {
    const ann: SpaceAnnouncement = {
      text: '🔊 LIVE: Test Space on DegenFeed',
      spaceUrl: 'https://app.degenfeed.xyz/spaces/test',
      platform: 'farcaster',
    };
    expect(ann.text).toContain('LIVE');
    expect(ann.platform).toBe('farcaster');
  });

  it('should create an announcement with embed', () => {
    const ann: SpaceAnnouncement = {
      text: '📅 Upcoming Space',
      spaceUrl: 'https://app.degenfeed.xyz/spaces/test',
      platform: 'bluesky',
      embed: {
        title: 'Test Space',
        description: 'Join us for DeFi talk',
        hostName: 'Test Host',
        imageUrl: 'https://example.com/thumb.jpg',
        url: 'https://app.degenfeed.xyz/spaces/test',
      },
    };
    expect(ann.embed?.title).toBe('Test Space');
    expect(ann.embed?.hostName).toBe('Test Host');
  });
});
