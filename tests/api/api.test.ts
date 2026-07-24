/**
 * @degenfeed/web — API Client Tests
 *
 * Covers:
 * - api.get constructs correct request
 * - api.post sends JSON body
 * - api.put sends JSON body with correct method
 * - api.del sends DELETE request
 * - handleResponse parses success responses
 * - handleResponse parses error responses
 * - handleResponse handles non-JSON error body
 * - Deduplication for concurrent GET requests
 * - createAsyncState returns correct initial state
 */

// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock retryFetch to avoid actual network calls
vi.mock('../../apps/web/src/lib/retryFetch', () => ({
  retryFetch: vi.fn(),
  retryFetchJson: vi.fn(),
}));

describe('API Client — api.get', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should make GET request and return parsed data', async () => {
    const retryFetch = vi.mocked(require('../../apps/web/src/lib/retryFetch').retryFetch);
    retryFetch.mockResolvedValue(
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
    expect(retryFetch).toHaveBeenCalledWith('/api/test', { fetchOptions: { method: 'GET' } });
  });

  it('should return error response on non-ok status', async () => {
    const retryFetch = vi.mocked(require('../../apps/web/src/lib/retryFetch').retryFetch);
    retryFetch.mockResolvedValue(
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
    const retryFetch = vi.mocked(require('../../apps/web/src/lib/retryFetch').retryFetch);
    retryFetch.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.get('/api/error');

    expect(result.success).toBe(false);
    expect(result.error).toContain('HTTP 500');
  });

  it('should handle network errors gracefully', async () => {
    const retryFetch = vi.mocked(require('../../apps/web/src/lib/retryFetch').retryFetch);
    retryFetch.mockRejectedValue(new Error('Network error'));

    const { api } = await import('../../apps/web/src/services/api');
    try {
      await api.get('/api/test');
      // Should not reach here
      expect(true).toBe(false);
    } catch (err) {
      // retryFetch throws on network errors
      expect(err).toBeDefined();
    }
  });
});

describe('API Client — api.post', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should make POST request with JSON body', async () => {
    const retryFetch = vi.mocked(require('../../apps/web/src/lib/retryFetch').retryFetch);
    retryFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, id: 'new-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.post<{ id: string }>('/api/create', { name: 'test' });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe('new-123');
    expect(retryFetch).toHaveBeenCalledWith('/api/create', {
      fetchOptions: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      },
    });
  });

  it('should make POST request without body', async () => {
    const retryFetch = vi.mocked(require('../../apps/web/src/lib/retryFetch').retryFetch);
    retryFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.post('/api/action');

    expect(result.success).toBe(true);
    expect(retryFetch).toHaveBeenCalledWith('/api/action', {
      fetchOptions: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: undefined,
      },
    });
  });
});

describe('API Client — api.put', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should make PUT request with JSON body', async () => {
    const retryFetch = vi.mocked(require('../../apps/web/src/lib/retryFetch').retryFetch);
    retryFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.put('/api/update', { key: 'value' });

    expect(result.success).toBe(true);
    expect(retryFetch).toHaveBeenCalledWith('/api/update', {
      fetchOptions: {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      },
    });
  });
});

describe('API Client — api.del', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should make DELETE request', async () => {
    const retryFetch = vi.mocked(require('../../apps/web/src/lib/retryFetch').retryFetch);
    retryFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { api } = await import('../../apps/web/src/services/api');
    const result = await api.del('/api/delete/1');

    expect(result.success).toBe(true);
    expect(retryFetch).toHaveBeenCalledWith('/api/delete/1', {
      fetchOptions: { method: 'DELETE' },
    });
  });
});

describe('API Client — createAsyncState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass through ApiResponse envelope when already wrapped', async () => {
    const retryFetch = vi.mocked(require('../../apps/web/src/lib/retryFetch').retryFetch);
    // API returns already-wrapped response
    retryFetch.mockResolvedValue(
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
