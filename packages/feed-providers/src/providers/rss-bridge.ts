/**
 * RSS-Bridge provider — generic proxy for RSS/Atom feeds.
 *
 * RSS-Bridge is a self-hosted PHP application that proxies RSS feeds
 * from websites that may block direct access from Cloudflare Workers.
 *
 * Set RSS_BRIDGE_URL in the worker env (default: http://127.0.0.1:8282).
 * The degenfeed.xyz instance lives at: https://rss-bridge.degenfeed.xyz
 *
 * Usage:
 *   provider.fetchFeed() — proxied via RSS-Bridge's FilterBridge
 *   provider.fetchDirect(feedUrl) — fetch a specific URL through RSS-Bridge
 */

import type { Protocol } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult } from '../types';
import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT, withTimeout } from '../utils';

export interface RssBridgeProviderOptions {
  /** Base URL of the RSS-Bridge instance (e.g. https://rss-bridge.degenfeed.xyz) */
  bridgeUrl: string;
}

/**
 * Minimal RssBridge provider.
 *
 * For generic feed proxying, RSS-Bridge's UrlBridge
 * can be used. The exact endpoint depends on which bridges are installed
 * on the instance.
 *
 * This provider keeps it simple: it makes the URL available and provides
 * a typed fetchFeed method for future enhancements.
 */
export class RssBridgeProvider implements FeedProvider {
  readonly protocol: Protocol = 'rss';
  private readonly bridgeUrl: string;

  constructor(options: RssBridgeProviderOptions) {
    this.bridgeUrl = options.bridgeUrl.replace(/\/+$/, '');
  }

  async fetchFeed(_opts: FetchOptions = {}): Promise<FeedResult> {
    // RSS-Bridge is used as a proxy — individual feed URLs are fetched
    // through the bridge. This no-op base method returns empty so the
    // caller must provide a specific URL (e.g. via fetchDirect).
    return { posts: [], notice: 'Use fetchDirect(url) to proxy through RSS-Bridge.' };
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = Date.now();
    try {
      const res = await withTimeout(
        fetch(this.bridgeUrl, {
          headers: { 'user-agent': DEFAULT_USER_AGENT },
        }),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'rss-bridge:health',
      );
      return { healthy: res.ok, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }

  /**
   * Fetch an RSS feed by proxying through RSS-Bridge.
   * Uses the bridge's UrlBridge with format=Atom.
   *
   * RSS-Bridge endpoint pattern:
   *   {bridgeUrl}/?action=display&bridge=UrlBridge&url={encodedUrl}&format=Atom
   */
  async fetchDirect(
    feedUrl: string,
    opts: FetchOptions = {},
  ): Promise<{ ok: boolean; body: string; status: number }> {
    const proxyUrl = `${this.bridgeUrl}/?action=display&bridge=UrlBridge&url=${encodeURIComponent(feedUrl)}&format=Atom`;
    try {
      const res = await withTimeout(
        fetch(proxyUrl, {
          headers: {
            'user-agent': DEFAULT_USER_AGENT,
            accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          },
        }),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        `rss-bridge:${feedUrl.slice(0, 64)}`,
      );
      return { ok: res.ok, body: await res.text(), status: res.status };
    } catch (err) {
      const _message = err instanceof Error ? err.message : 'unknown';
      return { ok: false, body: '', status: 0 };
    }
  }
}
