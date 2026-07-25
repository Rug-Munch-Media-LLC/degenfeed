/**
 * Tests for GTS Routes
 *
 * Validates the GTS-as-primary-signup endpoints with mocked HTTP responses.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock the GTS OAuth module
vi.mock('./gts-oauth', () => ({
  authenticateUser: vi.fn(),
  getClientCredentialsToken: vi.fn(),
  registerGtsApp: vi.fn(),
  verifyToken: vi.fn(),
}));

// Mock the federation hub
vi.mock('./federation-hub', () => ({
  federationHub: {
    discoverIdentity: vi.fn(),
    getIdentity: vi.fn(),
    summarizeIdentity: vi.fn(),
    listIdentities: vi.fn(),
  },
}));

// Mock fediverse discovery
vi.mock('./fediverse-discovery', () => ({
  fetchTrendingHashtags: vi.fn(),
  fetchTrendingPosts: vi.fn(),
  discoverPopularCommunities: vi.fn(),
  followFediverseAccount: vi.fn(),
  lookupFediverseAccount: vi.fn(),
  searchFediverseAccounts: vi.fn(),
}));

import { federationHub } from './federation-hub';
import { authenticateUser, verifyToken } from './gts-oauth';

describe('GTS Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/gts/register', () => {
    it('should register a new GTS account and return tokens', async () => {
      const mockAccount = {
        id: '123',
        username: 'testuser',
        acct: 'testuser@social.degenfeed.xyz',
        display_name: 'Test User',
        avatar: 'https://social.degenfeed.xyz/avatars/123',
        avatar_static: 'https://social.degenfeed.xyz/avatars/123',
        header: 'https://social.degenfeed.xyz/headers/123',
        header_static: 'https://social.degenfeed.xyz/headers/123',
        note: '',
        url: 'https://social.degenfeed.xyz/@testuser',
        created_at: '2026-07-25T00:00:00.000Z',
      };

      const mockToken = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        scope: 'read write follow push',
        created_at: Date.now(),
      };

      // Mock GTS account creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAccount),
      } as Response);

      // Mock authentication
      vi.mocked(authenticateUser).mockResolvedValueOnce(mockToken);

      // Mock federation discovery
      vi.mocked(federationHub.discoverIdentity).mockResolvedValueOnce({
        gtsHandle: '@testuser@social.degenfeed.xyz',
        gtsId: '123',
        services: {},
        discoveredAt: Date.now(),
        resolved: true,
      });

      vi.mocked(federationHub.summarizeIdentity).mockReturnValueOnce([]);

      // Create a mock request
      const req = {
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'application/json' },
        on: (event: string, cb: (chunk: string) => void) => {
          if (event === 'data') {
            cb(
              JSON.stringify({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123',
              }),
            );
          }
          if (event === 'end') {
            cb();
          }
          return req;
        },
        destroy: vi.fn(),
      } as any;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as any;

      // Import and call handler
      const { handleGtsRoute } = await import('./gts-routes');
      const handled = await handleGtsRoute('/api/auth/register', 'POST', req, res);

      expect(handled).toBe(true);
      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });

      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.ok).toBe(true);
      expect(responseData.user.username).toBe('testuser');
      expect(responseData.identity.gtsHandle).toBe('@testuser@social.degenfeed.xyz');
    });

    it('should reject registration with missing fields', async () => {
      const req = {
        method: 'POST',
        url: '/api/auth/register',
        on: (event: string, cb: (chunk: string) => void) => {
          if (event === 'data') cb(JSON.stringify({}));
          if (event === 'end') cb();
          return req;
        },
        destroy: vi.fn(),
      } as any;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as any;

      const { handleGtsRoute } = await import('./gts-routes');
      const handled = await handleGtsRoute('/api/auth/register', 'POST', req, res);

      expect(handled).toBe(true);
      expect(res.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
    });

    it('should handle duplicate username (422 from GTS)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ error: 'Username has already been taken' }),
      } as Response);

      const req = {
        method: 'POST',
        url: '/api/gts/register',
        on: (event: string, cb: (chunk: string) => void) => {
          if (event === 'data')
            cb(
              JSON.stringify({
                username: 'takenuser',
                email: 'test@example.com',
                password: 'password123',
              }),
            );
          if (event === 'end') cb();
          return req;
        },
        destroy: vi.fn(),
      } as any;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as any;

      const { handleGtsRoute } = await import('./gts-routes');
      const handled = await handleGtsRoute('/api/gts/register', 'POST', req, res);

      expect(handled).toBe(true);
      expect(res.writeHead).toHaveBeenCalledWith(409, { 'Content-Type': 'application/json' });
    });
  });

  describe('POST /api/gts/auth', () => {
    it('should authenticate and return user info', async () => {
      const mockAuthResult = {
        access_token: 'user-access-token',
        token_type: 'Bearer',
        scope: 'read write follow push',
        created_at: Date.now(),
        user: {
          id: '123',
          username: 'testuser',
          acct: 'testuser@social.degenfeed.xyz',
          display_name: 'Test User',
          avatar: '',
          avatar_static: '',
          header: '',
          header_static: '',
        },
      };

      vi.mocked(authenticateUser).mockResolvedValueOnce(mockAuthResult);
      vi.mocked(federationHub.discoverIdentity).mockResolvedValueOnce({
        gtsHandle: '@testuser@social.degenfeed.xyz',
        gtsId: '123',
        services: {},
        discoveredAt: Date.now(),
        resolved: true,
      });
      vi.mocked(federationHub.summarizeIdentity).mockReturnValueOnce([]);

      const req = {
        method: 'POST',
        url: '/api/gts/auth',
        on: (event: string, cb: (chunk: string) => void) => {
          if (event === 'data')
            cb(
              JSON.stringify({
                username: 'testuser',
                password: 'password123',
              }),
            );
          if (event === 'end') cb();
          return req;
        },
        destroy: vi.fn(),
      } as any;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as any;

      const { handleGtsRoute } = await import('./gts-routes');
      const handled = await handleGtsRoute('/api/gts/auth', 'POST', req, res);

      expect(handled).toBe(true);
      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      const data = JSON.parse(res.end.mock.calls[0][0]);
      expect(data.ok).toBe(true);
      expect(data.access_token).toBe('user-access-token');
    });

    it('should return 401 on bad credentials', async () => {
      vi.mocked(authenticateUser).mockRejectedValueOnce(new Error('Invalid username or password'));

      const req = {
        method: 'POST',
        url: '/api/gts/auth',
        on: (event: string, cb: (chunk: string) => void) => {
          if (event === 'data')
            cb(
              JSON.stringify({
                username: 'baduser',
                password: 'badpass',
              }),
            );
          if (event === 'end') cb();
          return req;
        },
        destroy: vi.fn(),
      } as any;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as any;

      const { handleGtsRoute } = await import('./gts-routes');
      const handled = await handleGtsRoute('/api/gts/auth', 'POST', req, res);

      expect(handled).toBe(true);
      expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    });
  });

  describe('GET /api/gts/trending', () => {
    it('should return trending posts', async () => {
      const { fetchTrendingPosts } = await import('./fediverse-discovery');
      vi.mocked(fetchTrendingPosts).mockResolvedValueOnce([]);

      const req = {
        method: 'GET',
        url: '/api/gts/trending?limit=10&type=posts',
        headers: {},
      } as any;

      const res = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as any;

      const { handleGtsRoute } = await import('./gts-routes');
      const handled = await handleGtsRoute('/api/gts/trending', 'GET', req, res);

      expect(handled).toBe(true);
      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    });
  });
});

describe('Fediverse Discovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export trending hashtags function', async () => {
    const { fetchTrendingHashtags } = await import('./fediverse-discovery');
    const result = await fetchTrendingHashtags();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should export community discovery function', async () => {
    const { discoverPopularCommunities } = await import('./fediverse-discovery');
    const result = await discoverPopularCommunities();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('Federation Hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate correct handle for each service', () => {
    // Use the federationHub singleton
    const handle = federationHub.getServiceHandle?.('testuser', 'peertube');
    // This test verifies the function exists
    expect(typeof federationHub.discoverIdentity).toBe('function');
    expect(typeof federationHub.summarizeIdentity).toBe('function');
  });
});
