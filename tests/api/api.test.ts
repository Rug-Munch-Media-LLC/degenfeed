/**
 * @degenfeed/web — API Client Tests
 *
 * Tests the centralized API client with mocked retryFetch.
 * Covers GET, POST, PUT, DELETE, createAsyncState, and envelope passthrough.
 */

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock retryFetch to avoid actual network calls
const mockRetryFetch = vi.fn();
vi.mock('../../apps/web/src/lib/retryFetch', () => ({
  retryFetch: mockRetryFetch,
  retryFetchJson: vi.fn(),
}));

describe('API Client — api.get', () => {
  beforeEach(() => {
    mockRetryFetch.mockReset();
  });

  it('should make GET request and return parsed data', async () => {
    mockRetryFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: 1, name: 'test' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.get<{ id: number; name: string }>('/api/test');

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(1);
    expect(result.data?.name).toBe('test');
    expect(mockRetryFetch).toHaveBeenCalledWith('/api/test', { fetchOptions: { method: 'GET' } });
  });

  it('should return error response on non-ok status', async () => {
    mockRetryFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.get('/api/nonexistent');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not found');
  });

  it('should handle non-JSON error response gracefully', async () => {
    mockRetryFetch.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.get('/api/error');

    expect(result.success).toBe(false);
    expect(result.error).toContain('HTTP 500');
  });

  it('should throw when retryFetch throws a network error', async () => {
    mockRetryFetch.mockRejectedValue(new Error('Network error'));

    const { api } = await import('../../apps/web/src/services/api');
    await expect(api.get('/api/test')).rejects.toThrow('Network error');
  });
});

describe('API Client — api.post', () => {
  beforeEach(() => {
    mockRetryFetch.mockReset();
  });

  it('should make POST request with JSON body', async () => {
    mockRetryFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, id: 'new-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.post<{ id: string }>('/api/create', { name: 'test' });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('new-123');
    expect(mockRetryFetch).toHaveBeenCalledWith('/api/create', {
      fetchOptions: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      },
    });
  });

  it('should make POST request without body', async () => {
    mockRetryFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.post('/api/action');

    expect(result.success).toBe(true);
    expect(mockRetryFetch).toHaveBeenCalledWith('/api/action', {
      fetchOptions: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: undefined,
      },
    });
  });
});

describe('API Client — api.put', () => {
  beforeEach(() => {
    mockRetryFetch.mockReset();
  });

  it('should make PUT request with JSON body', async () => {
    mockRetryFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.put('/api/update', { key: 'value' });

    expect(result.success).toBe(true);
    expect(mockRetryFetch).toHaveBeenCalledWith('/api/update', {
      fetchOptions: {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      },
    });
  });
});

describe('API Client — api.del', () => {
  beforeEach(() => {
    mockRetryFetch.mockReset();
  });

  it('should make DELETE request', async () => {
    mockRetryFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.del('/api/delete/1');

    expect(result.success).toBe(true);
    expect(mockRetryFetch).toHaveBeenCalledWith('/api/delete/1', {
      fetchOptions: { method: 'DELETE' },
    });
  });
});

describe('API Client — createAsyncState', () => {
  it('should create async state with default idle state', async () => {
    const { api } = await import('../../apps/web/src/services/api');
    const state = api.createAsyncState<string>();
    expect(state.data).toBeNull();
    expect(state.state).toBe('idle');
    expect(state.error).toBeNull();
  });

  it('should create async state with custom initial state', async () => {
    const { api } = await import('../../apps/web/src/services/api');
    const state = api.createAsyncState<string>('loading');
    expect(state.state).toBe('loading');
  });
});

describe('API Client — response envelope passthrough', () => {
  beforeEach(() => {
    mockRetryFetch.mockReset();
  });

  it('should pass through ApiResponse envelope when already wrapped', async () => {
    mockRetryFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: 'Rate limited', errors: ['too many requests'] }),
        {
          status: 429,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.get('/api/rate-limited');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limited');
    expect(result.errors).toContain('too many requests');
  });
});
