/**
 * Register All Providers — Initializes all providers with circuit breakers and failover.
 */

import { providerCircuitBreaker } from './circuit-breaker';
import { failoverRouter } from './failover-router';
import { healthDashboard } from './health-dashboard';

/**
 * Register all known providers with the circuit breaker.
 */
export function registerAllProvidersWithCircuitBreaker(): void {
  const providers = [
    'mastodon',
    'reddit',
    'rss',
    'lemmy',
    'peertube',
    'bluesky',
    'nostr',
    'farcaster',
    'lens',
    'pixelfed',
    'writefreely',
    'owncast',
    'bookwyrm',
    'mobilizon',
    'forgejo',
    'bonfire',
    'mitra',
    'takahe',
    'orbis',
    'xmtp',
    'push',
    'huddle01',
    'ceramic',
    'tableland',
    'telegram',
    'discord',
    'matrix',
    'github',
    'zora',
    'threads',
    'aether',
    'arweave',
    'atproto',
    'mediagoblin',
    'castopod',
    'diaspora',
    'deso',
    'dtube',
    'faircamp',
    'flarum',
    'friendica',
    'funkwhale',
    'gab',
    'hubzilla',
    'iceshrimp',
    'microblog',
    'misskey',
    'pleroma',
    'scuttlebutt',
    'sharkey',
    'snac',
    'steem',
    'subsocial',
    'tumblr',
    'twitter',
    'wordpress',
  ];

  for (const provider of providers) {
    providerCircuitBreaker.register(provider, 5);
    healthDashboard.recordFetch(provider);
  }

  console.log(`[reliability] Registered ${providers.length} providers with circuit breakers`);
}

/**
 * Register failover strategies for each provider.
 */
export function registerFailoverStrategies(_providers: Record<string, { name: string }>): void {
  // Register failover strategies for core providers
  const strategies: Record<string, string[]> = {
    mastodon: ['bluesky', 'nostr'],
    bluesky: ['mastodon', 'nostr'],
    nostr: ['farcaster', 'bluesky'],
    farcaster: ['nostr', 'bluesky'],
    lens: ['farcaster', 'bluesky'],
    reddit: ['rss', 'lemmy'],
    lemmy: ['reddit', 'rss'],
    peertube: ['owncast', 'youtube'],
    rss: ['reddit', 'mastodon'],
  };

  for (const [primary, fallbacks] of Object.entries(strategies)) {
    failoverRouter.register(primary, fallbacks, 60000);
  }

  console.log(`[reliability] Registered ${Object.keys(strategies).length} failover strategies`);
}
