import { describe, expect, it } from 'vitest';

describe('@degenfeed/threads-sdk', () => {
  it('should export ThreadsClient class requiring accessToken and userId', async () => {
    const { ThreadsClient } = await import('./index');
    const client = new ThreadsClient('test-token', '12345');
    expect(client).toBeInstanceOf(ThreadsClient);
  });

  it('should export constants with correct values', async () => {
    const { THREADS_GRAPH_API, THREADS_OAUTH_BASE, THREADS_WEB_URL } = await import('./index');
    expect(THREADS_GRAPH_API).toBe('https://graph.threads.net/v1.0');
    expect(THREADS_OAUTH_BASE).toBe('https://www.facebook.com/v22.0');
    expect(THREADS_WEB_URL).toBe('https://www.threads.net');
  });

  it('buildThreadsAuthorizeUrl generates valid Meta OAuth URL', async () => {
    const { buildThreadsAuthorizeUrl } = await import('./index');
    const url = buildThreadsAuthorizeUrl('app-id', 'https://example.com/callback', 'state123');
    expect(url).toContain('www.facebook.com/v22.0/dialog/oauth');
    expect(url).toContain('client_id=app-id');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=threads_basic%2Cthreads_content_publish');
    expect(url).toContain('state=state123');
  });
});
