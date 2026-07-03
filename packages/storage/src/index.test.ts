import { beforeEach, describe, expect, it } from 'vitest';

describe('@degenfeed/storage — in-memory sessions', () => {
  beforeEach(async () => {
    const { clearAllSessions } = await import('./index');
    clearAllSessions();
  });

  it('should export session functions', async () => {
    const mod = await import('./index');
    expect(typeof mod.setActiveSession).toBe('function');
    expect(typeof mod.getActiveSession).toBe('function');
    expect(typeof mod.clearActiveSession).toBe('function');
    expect(typeof mod.clearAllSessions).toBe('function');
  });

  it('should set and get active session', async () => {
    const { setActiveSession, getActiveSession } = await import('./index');
    const session = {
      identity: {
        id: 'nostr:test',
        protocol: 'nostr' as const,
        publicId: 'test',
        handle: '@test',
        linkedAt: Date.now(),
        verified: false,
        encryptedSecret: null,
        salt: '',
        iv: '',
        isPrimary: false,
      },
      decryptedSecret: null,
      unlockedAt: Date.now(),
    };
    setActiveSession('nostr:test', session);
    const got = getActiveSession('nostr:test');
    expect(got).toBeDefined();
    expect(got?.identity.handle).toBe('@test');
  });

  it('should clear active session', async () => {
    const { setActiveSession, getActiveSession, clearActiveSession } = await import('./index');
    const session = {
      identity: {
        id: 'nostr:test',
        protocol: 'nostr' as const,
        publicId: 'test',
        handle: '@test',
        linkedAt: Date.now(),
        verified: false,
        encryptedSecret: null,
        salt: '',
        iv: '',
        isPrimary: false,
      },
      decryptedSecret: null,
      unlockedAt: Date.now(),
    };
    setActiveSession('nostr:test', session);
    clearActiveSession('nostr:test');
    expect(getActiveSession('nostr:test')).toBeUndefined();
  });

  it('should clear all sessions', async () => {
    const { setActiveSession, getActiveSession, clearAllSessions } = await import('./index');
    const session = {
      identity: {
        id: 'nostr:test',
        protocol: 'nostr' as const,
        publicId: 'test',
        handle: '@test',
        linkedAt: Date.now(),
        verified: false,
        encryptedSecret: null,
        salt: '',
        iv: '',
        isPrimary: false,
      },
      decryptedSecret: null,
      unlockedAt: Date.now(),
    };
    setActiveSession('nostr:test', session);
    clearAllSessions();
    expect(getActiveSession('nostr:test')).toBeUndefined();
  });

  it('should export default preferences', async () => {
    const { getDefaultPreferences } = await import('./index');
    const prefs = await getDefaultPreferences('test-id');
    expect(prefs.identityId).toBe('test-id');
    expect(prefs.theme).toBe('dark');
    expect(prefs.defaultProtocols).toContain('nostr');
  });
});
