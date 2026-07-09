import { describe, expect, it } from 'vitest';

describe('@degenfeed/threads-sdk', () => {
  it('should export ThreadsClient class', async () => {
    const { ThreadsClient } = await import('./index');
    const client = new ThreadsClient();
    expect(client).toBeInstanceOf(ThreadsClient);
  });

  it('should export constants', async () => {
    const { THREADS_PUBLIC_URL, THREADS_PDS_URL } = await import('./index');
    expect(THREADS_PUBLIC_URL).toBe('https://public.threads.net');
    expect(THREADS_PDS_URL).toBe('https://threads.net');
  });

  it('should support setting auth', async () => {
    const { ThreadsClient } = await import('./index');
    const client = new ThreadsClient();
    expect(() => client.setAuth('test-jwt')).not.toThrow();
  });
});
