/**
 * Tests for recommendation API routes.
 *
 * Run: npx vitest run workers/api/src/__tests__/recommendations-routes.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the session module before importing routes ──────────────────────

vi.mock('../session', () => ({
  requireSession: vi.fn(),
  verifySessionCookie: vi.fn(),
}));

import { requireSession } from '../session';
import type { Env } from '../index';
import {
  handleVideoRecommendations,
  handleShortsRecommendations,
  handleStreamRecommendations,
  handleRelatedRecommendations,
  handlePersonalizedTrending,
  handleDiscoverRecommendations,
  handleRecordInteraction,
} from '../routes/recommendations';

// ─── Helpers ──────────────────────────────────────────────────────────────

function mockRequest(method: string, url: string, body?: unknown): Request {
  const opts: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  return new Request(url, opts);
}

function mockSession(address: string = '0xabc123def456') {
  const mockRequireSession = vi.mocked(requireSession);
  mockRequireSession.mockResolvedValue({ address } as never);
}

function mockNoSession() {
  const mockRequireSession = vi.mocked(requireSession);
  mockRequireSession.mockResolvedValue(new Response('Unauthorized', { status: 401 }) as never);
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Recommendation API routes', () => {
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    env = {} as Env;
  });

  describe('GET /api/recommendations/videos', () => {
    it('should return 401 without a session', async () => {
      mockNoSession();
      const req = mockRequest('GET', 'http://localhost/api/recommendations/videos');
      const res = await handleVideoRecommendations(req, env);
      expect(res.status).toBe(401);
    });

    it('should return 405 for non-GET methods', async () => {
      const req = mockRequest('POST', 'http://localhost/api/recommendations/videos');
      const res = await handleVideoRecommendations(req, env);
      expect(res.status).toBe(405);
    });

    it('should return recommendations for authenticated user', async () => {
      mockSession('0xabc123');
      const req = mockRequest('GET', 'http://localhost/api/recommendations/videos?limit=5');
      const res = await handleVideoRecommendations(req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { data: unknown[]; meta: { total: number } };
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(typeof body.meta.total).toBe('number');
    });

    it('should accept query parameters', async () => {
      mockSession('0xabc123');
      const req = mockRequest(
        'GET',
        'http://localhost/api/recommendations/videos?limit=10&sources=youtube,peertube&freshness=week',
      );
      const res = await handleVideoRecommendations(req, env);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/recommendations/shorts', () => {
    it('should return 401 without a session', async () => {
      mockNoSession();
      const req = mockRequest('GET', 'http://localhost/api/recommendations/shorts');
      const res = await handleShortsRecommendations(req, env);
      expect(res.status).toBe(401);
    });

    it('should return recommendations for authenticated user', async () => {
      mockSession();
      const req = mockRequest('GET', 'http://localhost/api/recommendations/shorts');
      const res = await handleShortsRecommendations(req, env);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/recommendations/streams', () => {
    it('should return 401 without a session', async () => {
      mockNoSession();
      const req = mockRequest('GET', 'http://localhost/api/recommendations/streams');
      const res = await handleStreamRecommendations(req, env);
      expect(res.status).toBe(401);
    });

    it('should return recommendations for authenticated user', async () => {
      mockSession();
      const req = mockRequest('GET', 'http://localhost/api/recommendations/streams');
      const res = await handleStreamRecommendations(req, env);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/recommendations/related', () => {
    it('should return 400 without source and id parameters', async () => {
      const req = mockRequest('GET', 'http://localhost/api/recommendations/related');
      const res = await handleRelatedRecommendations(req, env);
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid source', async () => {
      const req = mockRequest(
        'GET',
        'http://localhost/api/recommendations/related?source=invalid&id=abc123',
      );
      const res = await handleRelatedRecommendations(req, env);
      expect(res.status).toBe(400);
    });

    it('should return related content for valid parameters', async () => {
      const req = mockRequest(
        'GET',
        'http://localhost/api/recommendations/related?source=youtube&id=abc123',
      );
      const res = await handleRelatedRecommendations(req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { data: unknown[]; meta: { source: string; contentId: string } };
      expect(body.meta.source).toBe('youtube');
      expect(body.meta.contentId).toBe('abc123');
    });
  });

  describe('GET /api/recommendations/trending', () => {
    it('should return 401 without a session', async () => {
      mockNoSession();
      const req = mockRequest('GET', 'http://localhost/api/recommendations/trending');
      const res = await handlePersonalizedTrending(req, env);
      expect(res.status).toBe(401);
    });

    it('should accept optional category parameter', async () => {
      mockSession();
      const req = mockRequest(
        'GET',
        'http://localhost/api/recommendations/trending?category=crypto',
      );
      const res = await handlePersonalizedTrending(req, env);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/recommendations/discover', () => {
    it('should return 401 without a session', async () => {
      mockNoSession();
      const req = mockRequest('GET', 'http://localhost/api/recommendations/discover');
      const res = await handleDiscoverRecommendations(req, env);
      expect(res.status).toBe(401);
    });

    it('should return discoveries for authenticated user', async () => {
      mockSession();
      const req = mockRequest('GET', 'http://localhost/api/recommendations/discover');
      const res = await handleDiscoverRecommendations(req, env);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/recommendations/interaction', () => {
    it('should return 401 without a session', async () => {
      mockNoSession();
      const req = mockRequest('POST', 'http://localhost/api/recommendations/interaction', {
        contentId: 'test',
        action: 'watch',
      });
      const res = await handleRecordInteraction(req, env);
      expect(res.status).toBe(401);
    });

    it('should return 400 without required fields', async () => {
      mockSession();
      const req = mockRequest('POST', 'http://localhost/api/recommendations/interaction', {});
      const res = await handleRecordInteraction(req, env);
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid action', async () => {
      mockSession();
      const req = mockRequest('POST', 'http://localhost/api/recommendations/interaction', {
        contentId: 'test',
        action: 'invalid',
      });
      const res = await handleRecordInteraction(req, env);
      expect(res.status).toBe(400);
    });

    it('should record a valid interaction', async () => {
      mockSession('0xabc123');
      const req = mockRequest('POST', 'http://localhost/api/recommendations/interaction', {
        contentId: 'youtube:test123',
        action: 'watch',
        category: 'crypto',
        creatorId: 'nostr:creator1',
        source: 'youtube',
        dwellMs: 30000,
      });
      const res = await handleRecordInteraction(req, env);
      expect(res.status).toBe(200);
      const body = await res.json() as { ok: boolean };
      expect(body.ok).toBe(true);
    });

    it('should handle all valid interaction actions', async () => {
      mockSession('0xabc123');
      const actions = ['watch', 'like', 'share', 'skip', 'complete', 'tip'];

      for (const action of actions) {
        const req = mockRequest('POST', 'http://localhost/api/recommendations/interaction', {
          contentId: `test-${action}`,
          action,
        });
        const res = await handleRecordInteraction(req, env);
        expect(res.status).toBe(200);
      }
    });
  });
});
