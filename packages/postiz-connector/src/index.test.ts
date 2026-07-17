/**
 * Tests for @degenfeed/postiz-connector
 */
import { describe, it, expect, vi } from 'vitest';
import { PostizConnector, createConnectorFromEnv } from './index';

describe('PostizConnector', () => {
  const mockConfig = {
    baseUrl: 'http://postiz:3000',
    apiKey: 'test-api-key',
    integrationIds: {
      mastodon: 'int-masto-1',
      bluesky: 'int-bsky-1',
    },
  };

  describe('healthCheck', () => {
    it('returns true when server responds <500', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('ok', { status: 200 }),
      );

      const connector = new PostizConnector(mockConfig);
      const result = await connector.healthCheck();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://postiz:3000/public/v1/posts',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: 'test-api-key' }),
        }),
      );

      mockFetch.mockRestore();
    });

    it('returns false on network error', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

      const connector = new PostizConnector(mockConfig);
      const result = await connector.healthCheck();

      expect(result).toBe(false);

      mockFetch.mockRestore();
    });
  });

  describe('crossPost', () => {
    it('sends platforms with configured integration IDs to Postiz API', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ postId: 'post-123', integration: 'int-masto-1' }), {
          status: 200,
        }),
      );

      const connector = new PostizConnector(mockConfig);
      const results = await connector.crossPost({
        content: 'Hello from DegenFeed!',
        platforms: ['mastodon', 'bluesky'],
      });

      expect(results.mastodon?.success).toBe(true);
      expect(results.mastodon?.postizPostId).toBe('post-123');
      // POST was called twice (one per platform)
      expect(mockFetch).toHaveBeenCalledTimes(2);

      mockFetch.mockRestore();
    });

    it('uses fallback for platforms without integration IDs', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ postId: 'post-123', integration: 'int-masto-1' }), {
          status: 200,
        }),
      );

      const fallback = vi.fn().mockResolvedValue({ success: true, url: 'https://nostr.example.com/event' });

      const connector = new PostizConnector(mockConfig, fallback);
      const results = await connector.crossPost({
        content: 'Hello!',
        platforms: ['mastodon', 'nostr'],
      });

      // Mastodon goes through Postiz
      expect(results.mastodon?.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Nostr goes through fallback
      expect(results.nostr?.success).toBe(true);
      expect(results.nostr?.url).toBe('https://nostr.example.com/event');
      expect(fallback).toHaveBeenCalledWith('nostr', 'Hello!', undefined, undefined);

      mockFetch.mockRestore();
    });

    it('returns error when platform has no integration and no fallback', async () => {
      const connector = new PostizConnector(mockConfig);
      const results = await connector.crossPost({
        content: 'Hello!',
        platforms: ['reddit'],
      });

      expect(results.reddit?.success).toBe(false);
      expect(results.reddit?.error).toContain('no integration configured');
    });

    it('handles Postiz API errors gracefully', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Validation failed', { status: 422 }),
      );

      const connector = new PostizConnector(mockConfig);
      const results = await connector.crossPost({
        content: 'Hello!',
        platforms: ['mastodon'],
      });

      expect(results.mastodon?.success).toBe(false);
      expect(results.mastodon?.error).toContain('Postiz API 422');

      mockFetch.mockRestore();
    });

    it('can schedule posts', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ postId: 'post-sched', integration: 'int-masto-1' }), {
          status: 200,
        }),
      );

      const connector = new PostizConnector(mockConfig);
      const futureDate = new Date(Date.now() + 86_400_000).toISOString();
      const results = await connector.crossPost({
        content: 'Scheduled post!',
        platforms: ['mastodon'],
        scheduledAt: futureDate,
      });

      expect(results.mastodon?.success).toBe(true);

      // Verify the payload used "schedule" type
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.type).toBe('schedule');
      expect(callBody.date).toBe(futureDate);

      mockFetch.mockRestore();
    });
  });

  describe('listIntegrations', () => {
    it('returns parsed integration list', async () => {
      const mockIntegrations = [
        { id: 'int-1', name: 'My Mastodon', providerIdentifier: 'mastodon', picture: '' },
        { id: 'int-2', name: 'My Bluesky', providerIdentifier: 'bluesky', picture: '' },
      ];

      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ integrations: mockIntegrations }), { status: 200 }),
      );

      const connector = new PostizConnector(mockConfig);
      const integrations = await connector.listIntegrations();

      expect(integrations).toHaveLength(2);
      expect(integrations[0]?.id).toBe('int-1');

      mockFetch.mockRestore();
    });

    it('throws on non-ok response', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Unauthorized', { status: 401 }),
      );

      const connector = new PostizConnector(mockConfig);

      await expect(connector.listIntegrations()).rejects.toThrow('Postiz list integrations failed');

      mockFetch.mockRestore();
    });
  });

  describe('createConnectorFromEnv', () => {
    it('returns null when POSTIZ_BASE_URL is missing', () => {
      const connector = createConnectorFromEnv({
        POSTIZ_API_KEY: 'key',
        POSTIZ_INTEGRATIONS: '{}',
      });
      expect(connector).toBeNull();
    });

    it('returns null when POSTIZ_API_KEY is missing', () => {
      const connector = createConnectorFromEnv({
        POSTIZ_BASE_URL: 'http://postiz:3000',
        POSTIZ_INTEGRATIONS: '{}',
      });
      expect(connector).toBeNull();
    });

    it('creates connector with parsed integrations', () => {
      const connector = createConnectorFromEnv({
        POSTIZ_BASE_URL: 'http://postiz:3000',
        POSTIZ_API_KEY: 'key-123',
        POSTIZ_INTEGRATIONS: '{"mastodon":"int-1","bluesky":"int-2"}',
      });
      expect(connector).not.toBeNull();
      expect(connector!['config'].integrationIds.mastodon).toBe('int-1');
    });

    it('handles malformed integration JSON gracefully', () => {
      const connector = createConnectorFromEnv({
        POSTIZ_BASE_URL: 'http://postiz:3000',
        POSTIZ_API_KEY: 'key-123',
        POSTIZ_INTEGRATIONS: 'not-json',
      });
      expect(connector).not.toBeNull();
      // Should start with empty integration map
    });
  });
});
