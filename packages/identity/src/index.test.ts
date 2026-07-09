import { describe, expect, it } from 'vitest';

describe('@degenfeed/identity', () => {
  it('should export mergeIdentities', async () => {
    const { mergeIdentities } = await import('./index');
    expect(typeof mergeIdentities).toBe('function');
  });

  it('should merge empty identities', async () => {
    const { mergeIdentities } = await import('./index');
    const merged = mergeIdentities([]);
    expect(merged.id).toBe('');
    expect(merged.handles).toBeDefined();
  });

  it('should merge identity fields', async () => {
    const { mergeIdentities } = await import('./index');
    const merged = mergeIdentities([
      { id: 'test-id', displayName: 'Alice', bio: 'Hello' },
      { avatarUrl: 'https://example.com/avatar.png' },
    ]);
    expect(merged.id).toBe('test-id');
    expect(merged.displayName).toBe('Alice');
    expect(merged.bio).toBe('Hello');
    expect(merged.avatarUrl).toBe('https://example.com/avatar.png');
  });
});
