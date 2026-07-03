import { describe, expect, it } from 'vitest';

describe('@degenfeed/auth', () => {
  it('should export auth module', async () => {
    const mod = await import('./index');
    expect(mod).toBeDefined();
  });

  it('should export signInWithNostrNsec function', async () => {
    const { signInWithNostrNsec } = await import('./index');
    expect(typeof signInWithNostrNsec).toBe('function');
  });

  it('should export encrypt/decrypt functions', async () => {
    const { encryptSecret, decryptSecret } = await import('./index');
    expect(typeof encryptSecret).toBe('function');
    expect(typeof decryptSecret).toBe('function');
  });

  it('should export session lock/unlock functions', async () => {
    const { unlockIdentity, lockIdentity, forgetIdentity } = await import('./index');
    expect(typeof unlockIdentity).toBe('function');
    expect(typeof lockIdentity).toBe('function');
    expect(typeof forgetIdentity).toBe('function');
  });

  it('should export signInWithFarcaster function', async () => {
    const { signInWithFarcaster } = await import('./index');
    expect(typeof signInWithFarcaster).toBe('function');
  });
});
