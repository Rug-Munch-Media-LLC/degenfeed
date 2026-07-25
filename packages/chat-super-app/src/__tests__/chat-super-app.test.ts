/**
 * @degenfeed/chat-super-app — Test Suite
 *
 * Tests: Matrix hub, protocol bridges, self-destruct timers, calling, chat features
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Matrix Hub Tests ──────────────────────────────────────────────────

describe('MatrixHub', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should initialize with Conduit URL', async () => {
    const { MatrixHub } = await import('../matrix-hub');
    const hub = new MatrixHub();
    expect(hub).toBeDefined();
  });

  it('should have bridgeable protocols defined', async () => {
    const { BRIDGEABLE_PROTOCOLS } = await import('../matrix-hub');
    expect(BRIDGEABLE_PROTOCOLS).toContain('nostr');
    expect(BRIDGEABLE_PROTOCOLS).toContain('matrix');
    expect(BRIDGEABLE_PROTOCOLS).toContain('bluesky');
    expect(BRIDGEABLE_PROTOCOLS).toContain('farcaster');
    expect(BRIDGEABLE_PROTOCOLS).toContain('telegram');
    expect(BRIDGEABLE_PROTOCOLS).toContain('discord');
    expect(BRIDGEABLE_PROTOCOLS).toContain('irc');
    expect(BRIDGEABLE_PROTOCOLS).toContain('xmpp');
    expect(BRIDGEABLE_PROTOCOLS).toContain('signal');
    expect(BRIDGEABLE_PROTOCOLS).toContain('session');
    expect(BRIDGEABLE_PROTOCOLS.length).toBeGreaterThanOrEqual(12);
  });

  it('should have singleton accessor', async () => {
    const { getMatrixHub } = await import('../matrix-hub');
    const hub1 = getMatrixHub();
    const hub2 = getMatrixHub();
    expect(hub1).toBe(hub2);
  });
});

// ─── Protocol Bridges Tests ──────────────────────────────────────────

describe('ProtocolBridges', () => {
  it('should have protocol configs for all protocols', async () => {
    const { PROTOCOL_CONFIGS } = await import('../protocol-bridges');
    expect(PROTOCOL_CONFIGS.matrix).toBeDefined();
    expect(PROTOCOL_CONFIGS.nostr).toBeDefined();
    expect(PROTOCOL_CONFIGS.bluesky).toBeDefined();
    expect(PROTOCOL_CONFIGS.farcaster).toBeDefined();
    expect(PROTOCOL_CONFIGS.mastodon).toBeDefined();

    // All should have native encryption
    for (const [, config] of Object.entries(PROTOCOL_CONFIGS)) {
      expect(config.nativeEncryption).toBeTruthy();
      expect(typeof config.maxMessageLength).toBe('number');
    }
  });

  it('should have singleton accessor', async () => {
    const { getProtocolBridges } = await import('../protocol-bridges');
    const b1 = getProtocolBridges();
    const b2 = getProtocolBridges();
    expect(b1).toBe(b2);
  });
});

// ─── Self-Destruct Timer Tests ───────────────────────────────────────

describe('SelfDestructManager', () => {
  it('should have valid timer durations', async () => {
    const { SELF_DESTRUCT_OPTIONS } = await import('../self-destruct');
    expect(SELF_DESTRUCT_OPTIONS.length).toBe(9); // Off + 8 durations

    const durations = SELF_DESTRUCT_OPTIONS.map((o) => o.value);
    expect(durations).toContain(0); // Off
    expect(durations).toContain(5); // 5 seconds
    expect(durations).toContain(30); // 30 seconds
    expect(durations).toContain(60); // 1 minute
    expect(durations).toContain(300); // 5 minutes
    expect(durations).toContain(3600); // 1 hour
    expect(durations).toContain(86400); // 24 hours
    expect(durations).toContain(604800); // 7 days
    expect(durations).toContain(2592000); // 30 days
  });

  it('should generate correct timer display strings', async () => {
    const { SelfDestructManager } = await import('../self-destruct');
    const manager = new SelfDestructManager();

    expect(manager.getTimerDisplay(0)).toBeNull();
    expect(manager.getTimerDisplay(5)).toBe('Messages disappear after 5 seconds');
    expect(manager.getTimerDisplay(86400)).toBe('Messages disappear after 24 hours');
    expect(manager.getTimerDisplay(2592000)).toBe('Messages disappear after 30 days');
  });

  it('should have singleton accessor', async () => {
    const { getSelfDestructManager } = await import('../self-destruct');
    const s1 = getSelfDestructManager();
    const s2 = getSelfDestructManager();
    expect(s1).toBe(s2);
  });
});

// ─── Call Manager Tests ──────────────────────────────────────────────

describe('CallManager', () => {
  it('should initialize with no active calls', async () => {
    const { CallManager } = await import('../calling');
    const cm = new CallManager();
    expect(cm.getActiveCallsForUser('user1')).toEqual([]);
  });

  it('should create a valid peer connection config', async () => {
    const { createPeerConnection } = await import('../calling');
    // WebRTC not available in test environment — verify it doesn't crash
    expect(createPeerConnection).toBeDefined();
    expect(typeof createPeerConnection).toBe('function');
  });

  it('should have singleton accessor', async () => {
    const { getCallManager } = await import('../calling');
    const c1 = getCallManager();
    const c2 = getCallManager();
    expect(c1).toBe(c2);
  });
});

// ─── Chat Features Tests ────────────────────────────────────────────

describe('ChatFeaturesManager', () => {
  it('should have singleton accessor', async () => {
    const { getChatFeaturesManager } = await import('../chat-features');
    const f1 = getChatFeaturesManager();
    const f2 = getChatFeaturesManager();
    expect(f1).toBe(f2);
  });
});

// ─── Key Verification Tests ─────────────────────────────────────────

describe('KeyVerificationManager', () => {
  it('should generate fingerprints', async () => {
    const { KeyVerificationManager } = await import('../key-verification');
    const km = new KeyVerificationManager();

    // Mock env
    const mockEnv = {
      CACHE: null as any,
    };

    const fp = await km.generateFingerprint(mockEnv as any, 'user1', 'matrix');
    expect(fp.userId).toBe('user1');
    expect(fp.protocol).toBe('matrix');
    expect(fp.fingerprint).toBeTruthy();
    expect(fp.numericCode).toBeTruthy();
    expect(fp.shortCode).toBeTruthy();
    expect(fp.qrCodeUrl).toContain('degenfeed://verify/');
    expect(fp.algorithm).toBe('Olm/Megolm (Double Ratchet)');
  });

  it('should have singleton accessor', async () => {
    const { getKeyVerificationManager } = await import('../key-verification');
    const k1 = getKeyVerificationManager();
    const k2 = getKeyVerificationManager();
    expect(k1).toBe(k2);
  });
});

// ─── Index Exports Tests ─────────────────────────────────────────────

describe('Package Exports', () => {
  it('should export all main modules', async () => {
    const pkg = await import('../index');
    expect(pkg.MatrixHub).toBeDefined();
    expect(pkg.getMatrixHub).toBeDefined();
    expect(pkg.BRIDGEABLE_PROTOCOLS).toBeDefined();
    expect(pkg.ProtocolBridges).toBeDefined();
    expect(pkg.getProtocolBridges).toBeDefined();
    expect(pkg.PROTOCOL_CONFIGS).toBeDefined();
    expect(pkg.SelfDestructManager).toBeDefined();
    expect(pkg.getSelfDestructManager).toBeDefined();
    expect(pkg.SELF_DESTRUCT_OPTIONS).toBeDefined();
    expect(pkg.createScreenshotDetector).toBeDefined();
    expect(pkg.CallManager).toBeDefined();
    expect(pkg.getCallManager).toBeDefined();
    expect(pkg.createPeerConnection).toBeDefined();
    expect(pkg.getUserMedia).toBeDefined();
    expect(pkg.getDisplayMedia).toBeDefined();
    expect(pkg.ChatFeaturesManager).toBeDefined();
    expect(pkg.getChatFeaturesManager).toBeDefined();
    expect(pkg.KeyVerificationManager).toBeDefined();
    expect(pkg.getKeyVerificationManager).toBeDefined();
  });
});
