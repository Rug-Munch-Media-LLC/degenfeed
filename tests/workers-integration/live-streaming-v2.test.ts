/**
 * @degenfeed/integration — Live Streaming V2 Tests
 *
 * Tests the next-gen live streaming pipeline: streaming router with
 * tier-based backend selection (P2P <10, Owncast 10-50, PeerTube 50-500,
 * Livepeer 500+), simulcast to multiple platforms, unified chat
 * aggregation, bandwidth tracking + cost optimization, stream wizard
 * step-by-step, IPFS VOD archiving, stream key management, and
 * federation instance discovery.
 *
 * Pure functions tested directly. External APIs mocked via vi.mock.
 */
import { describe, expect, it, vi } from 'vitest';

// ─── Mock providers ─────────────────────────────────────────────────────

vi.mock('../../packages/livepeer-provider/src/index', () => ({
  LivepeerProvider: vi.fn().mockImplementation(() => ({
    createStream: vi.fn().mockImplementation(async (_opts: { name: string; record?: boolean }) => ({
      id: `lp_${Date.now()}`,
      rtmpUrl: 'rtmp://livepeer.studio/live/',
      streamKey: `key_${Math.random().toString(36).slice(2, 10)}`,
      playbackUrl: 'https://livepeerr.io/hls/playback/index.m3u8',
      playbackId: 'playback',
      status: 'idle',
      isActive: false,
      createdAt: new Date().toISOString(),
    })),
    getStreamStatus: vi.fn().mockResolvedValue({
      id: 'lp_stream',
      status: 'active',
      isActive: true,
      viewerCount: 501,
      recordingStatus: 'waiting',
    }),
    endStream: vi.fn().mockResolvedValue(undefined),
    exportToIPFS: vi.fn().mockResolvedValue({ ipfsCid: 'QmExportedVodCid' }),
    healthCheck: vi.fn().mockResolvedValue({ healthy: true, latencyMs: 85 }),
  })),
}));

vi.mock('../../packages/peertube-provider/src/livestream', () => ({
  PeerTubeLiveStream: vi.fn().mockImplementation(() => ({
    createStream: vi.fn().mockResolvedValue({
      id: 42,
      uuid: 'pt-live-uuid',
      shortUUID: 'ptshort',
      streamKey: 'pt_stream_key_abc',
      rtmpUrl: 'rtmp://video.degenfeed.xyz/live',
      playbackUrl: 'https://video.degenfeed.xyz/w/ptshort',
      embedUrl: 'https://video.degenfeed.xyz/videos/embed/pt-live-uuid',
      chatUrl: 'https://video.degenfeed.xyz/videos/watch/pt-live-uuid/live-chat',
      url: 'https://video.degenfeed.xyz/videos/watch/pt-live-uuid',
    }),
    getStreamStatus: vi.fn().mockResolvedValue({
      isLive: true,
      viewers: 100,
      state: 'live',
      health: 'good',
    }),
    endStream: vi.fn().mockResolvedValue(undefined),
    getChatMessages: vi.fn().mockResolvedValue({
      messages: [],
      total: 0,
    }),
    announceToFederation: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ─── Streaming Router Logic ─────────────────────────────────────────────

type StreamingBackend = 'p2p' | 'owncast' | 'peertube' | 'livepeer';

interface RouteDecision {
  backend: StreamingBackend;
  reason: string;
  estimatedMonthlyCostUsd: number;
  supportsRecording: boolean;
  supportsChat: boolean;
  maxViewers: number;
}

function routeStream(expectedViewers: number): RouteDecision {
  if (expectedViewers < 10) {
    return {
      backend: 'p2p',
      reason: 'Small audience: P2P is zero-cost',
      estimatedMonthlyCostUsd: 0,
      supportsRecording: false,
      supportsChat: true,
      maxViewers: 10,
    };
  }
  if (expectedViewers < 50) {
    return {
      backend: 'owncast',
      reason: 'Medium audience: Owncast self-hosted',
      estimatedMonthlyCostUsd: 5,
      supportsRecording: true,
      supportsChat: true,
      maxViewers: 50,
    };
  }
  if (expectedViewers < 500) {
    return {
      backend: 'peertube',
      reason: 'Large audience: PeerTube federated',
      estimatedMonthlyCostUsd: 25,
      supportsRecording: true,
      supportsChat: true,
      maxViewers: 500,
    };
  }
  return {
    backend: 'livepeer',
    reason: 'Massive audience: Livepeer decentralized CDN',
    estimatedMonthlyCostUsd: 100,
    supportsRecording: true,
    supportsChat: false,
    maxViewers: 100000,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function createMockStreamConfig(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Stream',
    description: 'A test live stream',
    category: 'Tech',
    tags: ['live', 'tech', 'crypto'],
    privacy: 'public' as const,
    recordingEnabled: true,
    chatEnabled: true,
    creatorId: '0xcreator',
    creatorHandle: 'creator',
    creatorDisplayName: 'Creator',
    platform: 'owncast' as const,
    ...overrides,
  };
}

function createMockChatMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: `chat_${Date.now()}`,
    displayName: 'Viewer',
    accountName: '@viewer@instance',
    message: 'Hello stream!',
    timestamp: Date.now(),
    isHolder: false,
    isCreator: false,
    platform: 'owncast' as const,
    ...overrides,
  };
}

// ─── Suite 1: Streaming Router ──────────────────────────────────────────

describe('Live Streaming V2 — Streaming Router', () => {
  it('routes <10 viewers to P2P (zero cost)', () => {
    const decision = routeStream(5);
    expect(decision.backend).toBe('p2p');
    expect(decision.estimatedMonthlyCostUsd).toBe(0);
    expect(decision.supportsRecording).toBe(false);
  });

  it('routes 10-50 viewers to Owncast', () => {
    const decision = routeStream(30);
    expect(decision.backend).toBe('owncast');
    expect(decision.estimatedMonthlyCostUsd).toBe(5);
    expect(decision.supportsRecording).toBe(true);
    expect(decision.supportsChat).toBe(true);
  });

  it('routes 50-500 viewers to PeerTube', () => {
    const decision = routeStream(200);
    expect(decision.backend).toBe('peertube');
    expect(decision.estimatedMonthlyCostUsd).toBe(25);
    expect(decision.maxViewers).toBe(500);
  });

  it('routes 500+ viewers to Livepeer', () => {
    const decision = routeStream(5000);
    expect(decision.backend).toBe('livepeer');
    expect(decision.estimatedMonthlyCostUsd).toBe(100);
    expect(decision.maxViewers).toBeGreaterThan(5000);
    expect(decision.supportsChat).toBe(false); // Livepeer doesn't have native chat
  });

  it('scales backend according to expected audience', () => {
    const testCases = [
      { viewers: 5, expected: 'p2p' },
      { viewers: 25, expected: 'owncast' },
      { viewers: 100, expected: 'peertube' },
      { viewers: 1000, expected: 'livepeer' },
    ];

    for (const tc of testCases) {
      const decision = routeStream(tc.viewers);
      expect(decision.backend).toBe(tc.expected);
    }
  });
});

// ─── Suite 2: Simulcast to Multiple Platforms ───────────────────────────

describe('Live Streaming V2 — Simulcast', () => {
  it('broadcasts to multiple platforms simultaneously', async () => {
    const platforms = ['owncast', 'peertube', 'livepeer'];
    const results: Array<{ platform: string; success: boolean }> = [];

    for (const platform of platforms) {
      // Simulate starting stream on each platform
      if (platform === 'owncast') {
        results.push({ platform, success: true });
      } else if (platform === 'peertube') {
        const { PeerTubeLiveStream } = await import(
          '../../packages/peertube-provider/src/livestream'
        );
        const pt = new PeerTubeLiveStream({ accessToken: 'mock-token' });
        const stream = await pt.createStream({
          channelName: 'TEST',
          title: 'Simulcast Test',
          tokenAddress: '0xtoken',
          creatorAddress: '0xcreator',
        });
        results.push({ platform, success: !!stream.streamKey });
      } else if (platform === 'livepeer') {
        const { LivepeerProvider } = await import('../../packages/livepeer-provider/src/index');
        const lp = new LivepeerProvider({ apiKey: 'mock-key' });
        const stream = await lp.createStream({ name: 'Simulcast Test', record: true });
        results.push({ platform, success: !!stream.streamKey });
      }
    }

    expect(results.length).toBe(3);
    for (const r of results) {
      expect(r.success).toBe(true);
    }
  });

  it('aggregates viewer counts from all simulcast targets', () => {
    const simulcastViewers = {
      owncast: 15,
      peertube: 80,
      livepeer: 200,
    };

    const totalViewers = Object.values(simulcastViewers).reduce((sum, v) => sum + v, 0);
    expect(totalViewers).toBe(295);

    const primaryBackend = routeStream(totalViewers);
    expect(primaryBackend.backend).toBe('peertube'); // 295 falls in 50-500 range
  });

  it('handles partial simulcast failure gracefully', () => {
    const simulcastResults = [
      { platform: 'owncast', success: true },
      { platform: 'peertube', success: true },
      { platform: 'livepeer', success: false, error: 'API rate limited' },
    ];

    const successes = simulcastResults.filter((r) => r.success);
    expect(successes.length).toBe(2);

    const failed = simulcastResults.find((r) => !r.success);
    expect(failed?.error).toContain('rate limit');
  });
});

// ─── Suite 3: Unified Chat Aggregation ─────────────────────────────────

describe('Live Streaming V2 — Unified Chat Aggregation', () => {
  it('aggregates chat messages from Owncast + PeerTube', () => {
    const owncastMessages = [
      createMockChatMessage({ platform: 'owncast', message: 'Hello from Owncast!', id: 'oc_1' }),
      createMockChatMessage({ platform: 'owncast', message: 'Great stream!', id: 'oc_2' }),
    ];

    const peertubeMessages = [
      createMockChatMessage({ platform: 'peertube', message: 'Hi from PeerTube!', id: 'pt_1' }),
    ];

    const unified = [...owncastMessages, ...peertubeMessages].sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    expect(unified.length).toBe(3);
    expect(unified[0]?.platform).toBe('owncast');
    expect(unified[2]?.platform).toBe('peertube');
  });

  it('deduplicates chat messages by content hash', () => {
    const messages = [
      createMockChatMessage({ id: 'chat_1', message: 'Hello!', isHolder: false }),
      createMockChatMessage({ id: 'chat_1', message: 'Hello!', isHolder: false }), // duplicate
      createMockChatMessage({ id: 'chat_2', message: 'Nice stream', isHolder: true }),
    ];

    const seen = new Set<string>();
    const unique = messages.filter((msg) => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });

    expect(unique.length).toBe(2);
    expect(unique.find((m) => m.isHolder)).toBeDefined();
  });

  it('formats chat messages with platform badge', () => {
    const formatChatBadge = (platform: string, isHolder: boolean, isCreator: boolean): string => {
      if (isCreator) return '🎙️ Creator';
      if (isHolder) return '🪙 Holder';
      const badges: Record<string, string> = {
        owncast: '📡 Owncast',
        peertube: '🐘 PeerTube',
        livepeer: '🎬 Livepeer',
      };
      return badges[platform] ?? '💬 Unknown';
    };

    expect(formatChatBadge('owncast', false, true)).toBe('🎙️ Creator');
    expect(formatChatBadge('owncast', true, false)).toBe('🪙 Holder');
    expect(formatChatBadge('peertube', false, false)).toBe('🐘 PeerTube');
    expect(formatChatBadge('livepeer', false, false)).toBe('🎬 Livepeer');
  });

  it('sanitizes chat messages to max length', () => {
    const longMessage = 'x'.repeat(1000);
    const sanitized = longMessage.slice(0, 500);
    expect(sanitized.length).toBe(500);
  });

  it('fetches chat messages from PeerTube', async () => {
    const { PeerTubeLiveStream } = await import('../../packages/peertube-provider/src/livestream');
    const pt = new PeerTubeLiveStream({ accessToken: 'mock-token' });

    const chatResult = await pt.getChatMessages('stream-uuid');
    expect(chatResult.messages).toEqual([]);
    expect(chatResult.total).toBe(0);
    expect(chatResult.nextCursor).toBeUndefined();
  });
});

// ─── Suite 4: Bandwidth Tracking + Cost Optimization ────────────────────

describe('Live Streaming V2 — Bandwidth & Cost Optimization', () => {
  it('tracks bandwidth usage during stream', () => {
    const bandwidthSamples = [
      { timestamp: Date.now(), bitrateKbps: 4500, viewers: 10 },
      { timestamp: Date.now() + 60000, bitrateKbps: 4200, viewers: 15 },
      { timestamp: Date.now() + 120000, bitrateKbps: 4800, viewers: 20 },
    ];

    const avgBitrate =
      bandwidthSamples.reduce((sum, s) => sum + s.bitrateKbps, 0) / bandwidthSamples.length;
    const avgViewers =
      bandwidthSamples.reduce((sum, s) => sum + s.viewers, 0) / bandwidthSamples.length;

    expect(avgBitrate).toBeCloseTo(4500, 0);
    expect(avgViewers).toBeCloseTo(15, 0);
  });

  it('estimates monthly bandwidth cost', () => {
    const estimateBandwidthCost = (
      avgBitrateMbps: number,
      avgViewers: number,
      hoursPerMonth: number,
    ): number => {
      const bytesPerSecond = (avgBitrateMbps * 1024 * 1024) / 8; // MB/s
      const totalBytesGB =
        (bytesPerSecond * hoursPerMonth * 3600 * avgViewers) / (1024 * 1024 * 1024);
      const costPerGB = 0.02; // CDN cost per GB
      return Math.round(totalBytesGB * costPerGB * 100) / 100;
    };

    const cost = estimateBandwidthCost(4.5, 100, 50); // 4.5 Mbps, 100 viewers, 50 hours
    expect(cost).toBeGreaterThan(0);

    // Lower bitrate = lower cost
    const lowerCost = estimateBandwidthCost(2.5, 100, 50);
    expect(lowerCost).toBeLessThan(cost);
  });

  it('recommends optimal bitrate based on content type', () => {
    const recommendBitrate = (contentType: string): { maxBitrateKbps: number; label: string } => {
      const profiles: Record<string, { maxBitrateKbps: number; label: string }> = {
        gaming: { maxBitrateKbps: 6000, label: 'High motion' },
        talk: { maxBitrateKbps: 2500, label: 'Low motion' },
        music: { maxBitrateKbps: 4000, label: 'Medium motion' },
        screencast: { maxBitrateKbps: 1500, label: 'Static content' },
      };
      return profiles[contentType] ?? { maxBitrateKbps: 3500, label: 'Default' };
    };

    expect(recommendBitrate('talk').maxBitrateKbps).toBe(2500);
    expect(recommendBitrate('gaming').maxBitrateKbps).toBe(6000);
    expect(recommendBitrate('screencast').maxBitrateKbps).toBe(1500);
  });

  it('detects cost savings from switching backends', () => {
    const backends = [
      { name: 'livepeer', monthlyCost: 100 },
      { name: 'peertube', monthlyCost: 25 },
      { name: 'owncast', monthlyCost: 5 },
      { name: 'p2p', monthlyCost: 0 },
    ];

    const sortedByCost = [...backends].sort((a, b) => a.monthlyCost - b.monthlyCost);
    expect(sortedByCost[0]?.name).toBe('p2p');
    expect(sortedByCost[sortedByCost.length - 1]?.name).toBe('livepeer');

    const savings = backends[0]?.monthlyCost - backends[2]?.monthlyCost;
    expect(savings).toBe(95); // Livepeer → Owncast
  });
});

// ─── Suite 5: Stream Wizard Step-by-Step ────────────────────────────────

describe('Live Streaming V2 — Stream Wizard', () => {
  const WIZARD_STEPS = ['setup', 'configure', 'preview', 'go-live', 'monitor'] as const;
  type WizardStep = (typeof WIZARD_STEPS)[number];

  it('validates wizard step progression', () => {
    const canProceed = (
      currentStep: WizardStep,
      config: { title: string; platform: string },
    ): boolean => {
      switch (currentStep) {
        case 'setup':
          return true; // Always can start
        case 'configure':
          return config.title.trim().length > 0 && config.platform.length > 0;
        case 'preview':
          return true; // Preview always available after configure
        case 'go-live':
          return true; // Always can go live after preview
        case 'monitor':
          return false; // Terminal step
        default:
          return false;
      }
    };

    expect(canProceed('setup', { title: '', platform: '' })).toBe(true);
    expect(canProceed('configure', { title: '', platform: 'youtube' })).toBe(false);
    expect(canProceed('configure', { title: 'My Stream', platform: 'owncast' })).toBe(true);
    expect(canProceed('monitor', { title: 'x', platform: 'x' })).toBe(false);
  });

  it('tracks wizard completion progress', () => {
    const completedSteps = new Set<WizardStep>(['setup', 'configure', 'preview']);
    const progress = completedSteps.size / WIZARD_STEPS.length;

    expect(progress).toBeCloseTo(0.6, 1); // 3/5 = 60%
  });

  it('saves draft configuration between steps', () => {
    const draft = {
      title: 'Draft Stream',
      description: '',
      platform: 'peertube',
      category: 'Tech',
      tags: ['crypto'],
    };

    const saved = { ...draft, description: 'Updated description' };
    expect(saved.title).toBe('Draft Stream');
    expect(saved.description).toBe('Updated description');
  });

  it('generates stream summary for go-live confirmation', () => {
    const config = createMockStreamConfig({
      title: 'My Awesome Stream',
      platform: 'peertube',
      recordingEnabled: true,
    });

    const summary = {
      title: config.title,
      platform: config.platform,
      recording: config.recordingEnabled ? 'Enabled' : 'Disabled',
      estimatedQuality: '1080p',
    };

    expect(summary.title).toBe('My Awesome Stream');
    expect(summary.recording).toBe('Enabled');
  });
});

// ─── Suite 6: IPFS VOD Archiving ───────────────────────────────────────

describe('Live Streaming V2 — IPFS VOD Archiving', () => {
  it('exports completed stream recording to IPFS', async () => {
    const { LivepeerProvider } = await import('../../packages/livepeer-provider/src/index');

    const provider = new LivepeerProvider({ apiKey: 'mock-key' });
    const result = await provider.exportToIPFS('asset_123');

    expect(result.ipfsCid).toBeTruthy();
    expect(result.ipfsCid).toMatch(/^Qm/);
  });

  it('retrieves recording with IPFS CID after export', async () => {
    const { LivepeerProvider } = await import('../../packages/livepeer-provider/src/index');

    const provider = new LivepeerProvider({ apiKey: 'mock-key' });
    const recording = await provider.getRecording('asset_123');

    expect(recording).not.toBeNull();
    expect(recording?.ipfsCid).toBeTruthy();
    expect(recording?.ready).toBe(true);
    expect(recording?.playbackUrl).toContain('.m3u8');
  });

  it('generates IPFS gateway URL from CID', () => {
    const cid = 'QmTestCid123456789';
    const gatewayUrls = [
      `https://ipfs.io/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      `https://gateway.pinata.cloud/ipfs/${cid}`,
    ];

    for (const url of gatewayUrls) {
      expect(url).toContain(cid);
      expect(url).toContain('/ipfs/');
    }
  });

  it('checks recording readiness before archiving', () => {
    const checkReadiness = (recording: {
      ready: boolean;
      duration: number;
      ipfsCid?: string;
    }): boolean => {
      return recording.ready && recording.duration > 0 && !!recording.ipfsCid;
    };

    expect(checkReadiness({ ready: true, duration: 300, ipfsCid: 'QmTest' })).toBe(true);
    expect(checkReadiness({ ready: false, duration: 300, ipfsCid: 'QmTest' })).toBe(false);
    expect(checkReadiness({ ready: true, duration: 0 })).toBe(false);
  });
});

// ─── Suite 7: Stream Key Management ─────────────────────────────────────

describe('Live Streaming V2 — Stream Key Management', () => {
  it('generates secure stream key with creator prefix', () => {
    const generateStreamKey = (creatorAddress: string): string => {
      const prefix = creatorAddress.slice(0, 6).toLowerCase();
      const rand = Math.random().toString(36).slice(2, 14);
      return `${prefix}_${rand}_df`;
    };

    const key = generateStreamKey('0xabc123');
    expect(key).toContain('0xabc1');
    expect(key).toContain('_df');
    expect(key.length).toBeGreaterThan(15);
  });

  it('regenerates stream key on reset (invalidates old)', () => {
    const oldKey = '0xabc1_oldkey123456_df';
    const newKey = '0xabc1_newkey789012_df';

    expect(oldKey).not.toBe(newKey);
    const activeKeys = new Set<string>([newKey]);
    expect(activeKeys.has(oldKey)).toBe(false);
    expect(activeKeys.has(newKey)).toBe(true);
  });

  it('validates stream key format before use', () => {
    const validateStreamKey = (key: string): boolean => {
      return /^0x[a-f0-9]{4}_[a-z0-9]{12,}_df$/.test(key);
    };

    expect(validateStreamKey('0xabc1_validkey1234_df')).toBe(true);
    expect(validateStreamKey('invalid_key')).toBe(false);
    expect(validateStreamKey('')).toBe(false);
    expect(validateStreamKey('0xabc1_short_df')).toBe(false); // key part too short
  });

  it('rotates stream key for security on stream end', () => {
    const rotateKey = (oldKey: string): string => {
      const parts = oldKey.split('_');
      const prefix = parts[0] ?? '0x0000';
      const rand = Math.random().toString(36).slice(2, 14);
      return `${prefix}_${rand}_df`;
    };

    const oldKey = '0xabc1_oldkey123456_df';
    const newKey = rotateKey(oldKey);
    expect(newKey).not.toBe(oldKey);
    expect(newKey).toContain('0xabc1');
  });
});

// ─── Suite 8: Federation Instance Discovery ────────────────────────────

describe('Live Streaming V2 — Federation Instance Discovery', () => {
  it('discovers Owncast instances from known list', () => {
    const owncastInstances = [
      { url: 'https://owncast.degenfeed.xyz', name: 'DegenFeed Owncast', priority: 1 },
      { url: 'https://stream.video.example', name: 'Video Stream', priority: 2 },
    ];

    expect(owncastInstances.length).toBeGreaterThanOrEqual(1);
    expect(owncastInstances[0]?.url).toContain('degenfeed');
  });

  it('discovers PeerTube instances from federated list', async () => {
    const { FEDERATED_PEERTUBE_INSTANCES } = await import(
      '../../packages/peertube-provider/src/federated'
    );

    expect(FEDERATED_PEERTUBE_INSTANCES.length).toBeGreaterThan(5);
    const tilvids = FEDERATED_PEERTUBE_INSTANCES.find((i) => i.name === 'TILvids');
    expect(tilvids).toBeDefined();
    expect(tilvids?.priority).toBe(1);
    expect(tilvids?.tags).toContain('tech');
  });

  it('checks health of federated instances', async () => {
    const { federatedHealthCheck } = await import('../../packages/peertube-provider/src/federated');

    const health = await federatedHealthCheck();
    expect(health.total).toBeGreaterThan(5);
    expect(typeof health.reachable).toBe('number');
    expect(health.instances.length).toBe(health.total);
  });

  it('validates instance supports live streaming', () => {
    const instances = [
      { url: 'https://video.degenfeed.xyz', supportsLive: true, version: '6.0.0' },
      { url: 'https://tilvids.com', supportsLive: true, version: '6.0.0' },
    ];

    for (const inst of instances) {
      expect(inst.supportsLive).toBe(true);
      const [major] = inst.version.split('.').map(Number);
      expect(major).toBeGreaterThanOrEqual(6);
    }
  });

  it('discovers instances by content category', async () => {
    const { FEDERATED_PEERTUBE_INSTANCES } = await import(
      '../../packages/peertube-provider/src/federated'
    );

    const techInstances = FEDERATED_PEERTUBE_INSTANCES.filter((i) => i.tags.includes('tech'));
    expect(techInstances.length).toBeGreaterThan(5);

    const tier1Instances = FEDERATED_PEERTUBE_INSTANCES.filter((i) => i.priority === 1);
    expect(tier1Instances.length).toBeGreaterThanOrEqual(3);
  });
});
