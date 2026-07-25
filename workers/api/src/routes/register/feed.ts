/**
 * @degenfeed/api-worker - Feed route registration
 *
 * Register Feed-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { jsonResponse } from '../../index';
import { ok, serverError } from '../../response-helpers';
import blueskyFeedGen from '../../routes/bluesky-feed-generator';

import { handleCommunities } from '../../routes/communities';
import { handleAltFeed, handleNewsletterFeed, handleTopFeed } from '../../routes/curated';
import {
  handleCuratedFeed,
  handleEngagementFeedback,
  handleMarkSeen,
  handleScrollDepth,
} from '../../routes/curated-feed';
import {
  handleCustomFeedCreate,
  handleCustomFeedDelete,
  handleCustomFeedExecute,
  handleCustomFeedGet,
  handleCustomFeedList,
  handleCustomFeedPublic,
  handleCustomFeedSubscribe,
  handleCustomFeedUpdate,
} from '../../routes/custom-feed';
import {
  handleDigestFormat,
  handleDigestStatus,
  handleDigestSubscribeEmail,
  handleDigestToday,
  handleDigestUnsubscribeEmail,
  handleDigestYesterday,
} from '../../routes/digest';
import {
  handleDiscover,
  handleDiscoverCommunities,
  handleDiscoverFeatured,
  handleDiscoverNew,
  handleDiscoverPeople,
  handleDiscoverTopics,
  handleDiscoverTrending,
} from '../../routes/discover';
import { handleFarcasterFeed } from '../../routes/farcaster-feed';
import { qualityDashboardRoutes } from '../../routes/feed-quality-dashboard';
import {
  handleFeedCacheInvalidate,
  handleFeedHealth,
  handleHomeFeed,
  handleProviderFeed,
  handleRedditFeed,
  handleTrendingFeed,
} from '../../routes/feed';
import {
  handleCategoryMixFeed,
  handleCategorySlugFeed,
  handleEverythingFeed,
  handlePerProtocolCategoryFeed,
} from '../../routes/feed-category';
import {
  handleProtocolFeed,
  handleProtocolNewest,
  handleProtocolPopular,
  handleProtocolsList,
  handleProtocolTrendingRoute,
  handleProtocolVideos,
} from '../../routes/feed-protocol';
import {
  handleCategoryFeed,
  handleDefaultFeed,
  handleNetworkFeed,
  handleSourceDiscovery,
  handleTrendingContent,
  handleUnifiedSearch,
} from '../../routes/feed-unified';
import { handleFeedback, handleForYouFeed, handleRecordDwell } from '../../routes/for-you';
import { handleFundingFeed } from '../../routes/funding';
import {
  handleNewsAuthor,
  handleNewsCategory,
  handleNewsDeepDives,
  handleNewsDigestPreview,
  handleNewsDigestSubscribe,
  handleNewsFeed,
  handleNewsForYou,
  handleNewsHot,
  handleNewsletterCreatorCreate,
  handleNewsletterCreatorIssue,
  handleNewsletterCreatorIssues,
  handleNewsletterCreatorMine,
  handleNewsletterCreatorSubscribe,
  handleNewsMarkRead,
  handleNewsPreferences,
  handleNewsProtocol,
  handleNewsQuickReads,
  handleNewsSearch,
  handleNewsStory,
  handleNewsToken,
  handleNewsTrending,
  handleReadingList,
  handleReadingListToggle,
} from '../../routes/news';
import { handleNewsSourcesRoute } from '../../routes/news-sources';
import {
  handleNewsletterDigest,
  handleNewsletterStatus,
  handleNewsletterSubscribe,
} from '../../routes/newsletter';
import {
  handleNewsletterBridgeAutoPoll,
  handleNewsletterBridgeConnect,
  handleNewsletterBridgeDisconnect,
  handleNewsletterBridgeList,
  handleNewsletterBridgePoll,
  handleNewsletterBridgeStats,
} from '../../routes/newsletter-bridge';
import {
  handleCreatorNewsletterCount,
  handleCreatorNewsletterHealth,
  handleCreatorNewsletterSend,
  handleCreatorNewsletterStats,
  handleCreatorNewsletterSubscribe,
  handleCreatorNewsletterSubscribers,
  handleCreatorNewsletterUnsubscribe,
  handleMailgunWebhook,
} from '../../routes/newsletter-creator';
import {
  handleNewsletterCreateDraft,
  handleNewsletterSend,
  handleNewsletterSendTest,
  handleNewsletterSubscriberRemove,
  handleNewsletterSubscribersList,
} from '../../routes/newsletter-send';
import { handleOgFetch, handlePostOg } from '../../routes/og';
import {
  handlePixelfedFeed,
  handlePixelfedHealth,
  handlePixelfedTag,
  handlePixelfedTrending,
} from '../../routes/pixelfed';
import { handlePostById } from '../../routes/post';
import { handleFeedPresets } from '../../routes/presets';
import { handleProtocolSections } from '../../routes/protocol-sections';
import { handleActivityPubFeed, handleThreadsFeed } from '../../routes/protocols';
import { handlePushSend, handlePushSubscribe } from '../../routes/push';
import {
  handleDiscoverRecommendations,
  handlePersonalizedTrending,
  handleRecordInteraction,
  handleRelatedRecommendations,
  handleShortsRecommendations,
  handleStreamRecommendations,
  handleVideoRecommendations,
} from '../../routes/recommendations';
import { handleRelatedPosts } from '../../routes/related';
import { handlePostReplies } from '../../routes/replies';
import {
  handleRmiHeadlines,
  handleRmiHealth,
  handleRmiNews,
  handleRmiSentiment,
  handleRmiSources,
  handleRmiStats,
} from '../../routes/rmi';
import { withSession } from '../../routes/route-registry';
import { handleRssFeed } from '../../routes/rss';
import { handleRssXml } from '../../routes/rss-xml';
import {
  handleAlgorithmStatus,
  handleCreateShort,
  handleShortsByCategory,
  handleShortsBySource,
  handleShortsFeed,
  handleShortsFeedback,
  handleShortsFeedV2,
  handleShortsForYou,
  handleShortsShare,
  handleShortsTip,
  handleShortsTrending,
  handleShortsTrendingV2,
  handleShortsWatch,
  handleUnifiedFeed,
  handleUnifiedFeedBySource,
  handleUnifiedMint,
  handleUnifiedPublish,
  handleZoraCreator,
  handleZoraTrending,
} from '../../routes/shorts';
import {
  handleAddSource,
  handleListSources,
  handleRefreshSource,
  handleRemoveSource,
  handleSourceSuggestions,
} from '../../routes/shorts-sources';
import {
  handleSourcesApprove,
  handleSourcesDiscover,
  handleSourcesPending,
  handleSourcesReject,
} from '../../routes/source-discovery';
import {
  handleRecordEngagement,
  handleSourcesHealth,
  handleSourcesHealthCheck,
  handleSourcesNewThisWeek,
  handleSourcesStale,
  handleSourcesStats,
  handleSourcesTrending,
} from '../../routes/source-health';
import { handleStreamFeed } from '../../routes/stream';
import {
  handleImagesCategory,
  handleImagesCreator,
  handleImagesLatest,
  handleImagesTrending,
} from '../../routes/unified-image-feed';
import {
  handleVisualFeed,
  handleVisualForYou,
  handleVisualTrending,
} from '../../routes/visual-feed';

export function registerFeedRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- API: Shorts ---
  app.get('/api/shorts/feed', async (c) => {
    try {
      const result = await handleShortsFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/shorts/trending', async (c) => {
    try {
      const result = await handleShortsTrending(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/shorts/for-you', async (c) => {
    try {
      const result = await handleShortsForYou(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/shorts/source/:source', async (c) => {
    try {
      const result = await handleShortsBySource(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/shorts/create', async (c) => {
    try {
      const result = await handleCreateShort(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Unified multi-protocol publish & mint ---
  app.post('/api/shorts/publish', async (c) => {
    try {
      const result = await handleUnifiedPublish(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/shorts/mint', async (c) => {
    try {
      const result = await handleUnifiedMint(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Unified multi-protocol feed ---
  app.get('/api/shorts/unified/feed', async (c) => {
    try {
      const result = await handleUnifiedFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/shorts/unified/:source', async (c) => {
    try {
      const result = await handleUnifiedFeedBySource(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Cross-platform actions on shorts ---
  app.post('/api/shorts/:id/tip', async (c) => {
    try {
      const result = await handleShortsTip(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/shorts/:id/share', async (c) => {
    try {
      const result = await handleShortsShare(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- V2 enhanced feed (ShortsAggregatorV2 + ShortsAlgorithm) ---
  app.get('/api/shorts/v2/feed', async (c) => {
    try {
      const result = await handleShortsFeedV2(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/shorts/v2/trending', async (c) => {
    try {
      const result = await handleShortsTrendingV2(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/shorts/category/:cat', async (c) => {
    try {
      const result = await handleShortsByCategory(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/shorts/watch', async (c) => {
    try {
      const result = await handleShortsWatch(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/shorts/feedback', async (c) => {
    try {
      const result = await handleShortsFeedback(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/shorts/algorithm/status', async (c) => {
    try {
      const result = await handleAlgorithmStatus(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Shorts source management ---
  app.get('/api/shorts/sources', async (c) => {
    try {
      const result = await handleListSources(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/shorts/sources', async (c) => {
    try {
      const result = await handleAddSource(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/shorts/sources/:id', async (c) => {
    try {
      const result = await handleRemoveSource(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/shorts/sources/:id/refresh', async (c) => {
    try {
      const result = await handleRefreshSource(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/shorts/sources/suggestions', async (c) => {
    try {
      const result = await handleSourceSuggestions(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Zora video NFT endpoints ---
  app.get('/api/shorts/zora/trending', async (c) => {
    try {
      const result = await handleZoraTrending(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/shorts/zora/creator', async (c) => {
    try {
      const result = await handleZoraCreator(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Feed (specific routes before parameterized) ---
  app.all('/api/feed/home', async (c) => {
    try {
      const result = await handleHomeFeed(c.req.raw, c.env, c.executionCtx);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/feed/protocol-sections', async (c) => {
    try {
      const result = await handleProtocolSections(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/for-you', async (c) => {
    try {
      const result = await handleForYouFeed(c.req.raw, c.env, c.executionCtx);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/feed/dwell', async (c) => {
    try {
      const result = await handleRecordDwell(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/feed/feedback', async (c) => {
    try {
      const result = await handleFeedback(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/trending', async (c) => {
    try {
      const result = await handleTrendingFeed(c.req.raw, c.env, c.executionCtx);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/health', async (c) => {
    try {
      const result = await handleFeedHealth(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/pixelfed', async (c) => {
    try {
      const result = await handlePixelfedFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/pixelfed/trending', async (c) => {
    try {
      const result = await handlePixelfedTrending(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/pixelfed/tags/:tag', async (c) => {
    try {
      const result = await handlePixelfedTag(c.req.raw, c.env, c.req.param('tag'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/pixelfed/health', async (c) => {
    try {
      const result = await handlePixelfedHealth(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/rss.xml', async (c) => {
    try {
      const result = await handleRssXml(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/atom.xml', async (c) => {
    try {
      const result = await handleRssXml(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/news', async (c) => {
    try {
      const result = await handleNewsFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/reddit', async (c) => {
    try {
      const result = await handleRedditFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/activitypub', async (c) => {
    try {
      const result = await handleActivityPubFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/threads', async (c) => {
    try {
      const result = await handleThreadsFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/farcaster', async (c) => {
    try {
      const result = await handleFarcasterFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/rss', async (c) => {
    try {
      const result = await handleRssFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/post/:postId/replies', async (c) => {
    try {
      const result = await handlePostReplies(c.req.raw, c.env, c.req.param('postId'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/og', async (c) => {
    try {
      const result = await handleOgFetch(c.req.raw);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/post/:postId', async (c) => {
    try {
      const postId = c.req.param('postId');
      if (c.req.query('format') === 'og') return handlePostOg(c.req.raw, c.env, postId);
      return handlePostById(c.req.raw, c.env, postId);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/funding', async (c) => handleFundingFeed(c.req.raw, c.env));
  app.all('/api/feed/top', async (c) => handleTopFeed(c.req.raw, c.env));
  app.all('/api/feed/alt', async (c) => handleAltFeed(c.req.raw, c.env));
  app.all('/api/feed/communities', async (c) => handleCommunities(c.req.raw, c.env));
  app.all('/api/feed/newsletters', async (c) => handleNewsletterFeed(c.req.raw, c.env));
  app.all('/api/feed/related', async (c) => handleRelatedPosts(c.req.raw, c.env));
  app.all('/api/feed/presets', async (c) => handleFeedPresets(c.req.raw, c.env));
  app.all('/api/feed/stream', async (c) => handleStreamFeed(c.req.raw, c.env));
  app.all('/api/feed/curated', async (c) => handleCuratedFeed(c.req.raw, c.env, c.executionCtx));
  app.all('/api/feed/scroll-depth', async (c) => handleScrollDepth(c.req.raw, c.env));
  app.all('/api/feed/seen', async (c) => handleMarkSeen(c.req.raw, c.env));
  app.all('/api/feed/engagement-feedback', async (c) => handleEngagementFeedback(c.req.raw, c.env));
  app.all('/api/feed/category/:category', async (c) => {
    try {
      const result = await handleCategorySlugFeed(
        c.req.raw,
        c.env,
        c.req.param('category'),
        c.executionCtx,
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/mix', async (c) => {
    try {
      const result = await handleCategoryMixFeed(c.req.raw, c.env, c.executionCtx);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/everything', async (c) => {
    try {
      const result = await handleEverythingFeed(c.req.raw, c.env, c.executionCtx);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/per-protocol/:protocol/:category', async (c) => {
    try {
      const result = await handlePerProtocolCategoryFeed(
        c.req.raw,
        c.env,
        c.req.param('protocol'),
        c.req.param('category'),
        c.executionCtx,
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/unified', async (c) => {
    try {
      const result = await handleUnifiedFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/feed/unified/trending', async (c) => {
    try {
      const result = await handleTrendingContent(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/feed/unified/for-you', async (c) => {
    try {
      const result = await handleForYouFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/feed/unified/category/:id', async (c) => {
    try {
      const result = await handleCategoryFeed(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/feed/unified/search', async (c) => {
    try {
      const result = await handleUnifiedSearch(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/feed/unified/sources', async (c) => {
    try {
      const result = await handleSourceDiscovery(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/feed/unified/default', async (c) => {
    try {
      const result = await handleDefaultFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/feed/unified/network/:network', async (c) => {
    try {
      const result = await handleNetworkFeed(c.req.raw, c.env, c.req.param('network'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/visual', async (c) => {
    try {
      const result = await handleVisualFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/visual/trending', async (c) => {
    try {
      const result = await handleVisualTrending(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/visual/for-you', async (c) => {
    try {
      const result = await handleVisualForYou(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/images/trending', async (c) => {
    try {
      const result = await handleImagesTrending(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/images/latest', async (c) => {
    try {
      const result = await handleImagesLatest(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/images/category', async (c) => {
    try {
      const result = await handleImagesCategory(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/images/creator', async (c) => {
    try {
      const result = await handleImagesCreator(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Protocol-specific feeds — must be before provider catch-all ---
  app.get('/api/feed/protocols', async (c) => {
    try {
      const result = await handleProtocolsList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/feed/protocol/:protocol', async (c) => {
    try {
      const result = await handleProtocolFeed(
        c.req.raw,
        c.env,
        c.req.param('protocol'),
        c.executionCtx,
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/feed/protocol/:protocol/popular', async (c) => {
    try {
      const result = await handleProtocolPopular(
        c.req.raw,
        c.env,
        c.req.param('protocol'),
        c.executionCtx,
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/feed/protocol/:protocol/trending', async (c) => {
    try {
      const result = await handleProtocolTrendingRoute(
        c.req.raw,
        c.env,
        c.req.param('protocol'),
        c.executionCtx,
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/feed/protocol/:protocol/newest', async (c) => {
    try {
      const result = await handleProtocolNewest(
        c.req.raw,
        c.env,
        c.req.param('protocol'),
        c.executionCtx,
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/feed/protocol/:protocol/videos', async (c) => {
    try {
      const result = await handleProtocolVideos(
        c.req.raw,
        c.env,
        c.req.param('protocol'),
        c.executionCtx,
      );
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/feed/:provider', async (c) => {
    try {
      const result = await handleProviderFeed(c.req.raw, c.env, c.req.param('provider'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Custom Feeds (session-gated) ---
  app.post('/api/custom-feeds', async (c) => {
    try {
      return await withSession(c, () => handleCustomFeedCreate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/custom-feeds', async (c) => {
    try {
      const result = await handleCustomFeedList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/custom-feeds/public', async (c) => {
    try {
      const result = await handleCustomFeedPublic(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/custom-feeds/:id/subscribe', async (c) => {
    try {
      return await withSession(c, () =>
        handleCustomFeedSubscribe(c.req.raw, c.env, c.req.param('id')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/custom-feeds/:id/execute', async (c) => {
    try {
      const result = await handleCustomFeedExecute(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/custom-feeds/:id', async (c) => {
    try {
      const result = await handleCustomFeedGet(c.req.raw, c.env, c.req.param('id'));
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.put('/api/custom-feeds/:id', async (c) => {
    try {
      return await withSession(c, () =>
        handleCustomFeedUpdate(c.req.raw, c.env, c.req.param('id')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/custom-feeds/:id', async (c) => {
    try {
      return await withSession(c, () =>
        handleCustomFeedDelete(c.req.raw, c.env, c.req.param('id')),
      );
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Bluesky Feed Generator (live content feed) ---
  app.route('/api/bluesky/feed', blueskyFeedGen);

  // --- API: Feed Quality Dashboard (admin) ---
  app.route('/api/admin/feed-quality', qualityDashboardRoutes);

  // --- API: RMI ---
  app.all('/api/rmi/news/headlines', async (c) => {
    try {
      const result = await handleRmiHeadlines(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/rmi/news/sources', async (c) => {
    try {
      const result = await handleRmiSources(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/rmi/news/sentiment', async (c) => {
    try {
      const result = await handleRmiSentiment(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/rmi/news/stats', async (c) => {
    try {
      const result = await handleRmiStats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/rmi/health', async (c) => {
    try {
      const result = await handleRmiHealth(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/rmi/news', async (c) => {
    try {
      const result = await handleRmiNews(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/rmi/news/*', async (c) => {
    try {
      const result = await handleRmiNews(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Discover ---
  app.all('/api/discover', async (c) => {
    try {
      const result = await handleDiscover(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/discover/trending', async (c) => {
    try {
      const result = await handleDiscoverTrending(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/discover/communities', async (c) => {
    try {
      const result = await handleDiscoverCommunities(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/discover/people', async (c) => {
    try {
      const result = await handleDiscoverPeople(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/discover/topics', async (c) => {
    try {
      const result = await handleDiscoverTopics(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/discover/featured', async (c) => {
    try {
      const result = await handleDiscoverFeatured(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/discover/new', async (c) => {
    try {
      const result = await handleDiscoverNew(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Recommendations ---
  app.get('/api/recommendations/videos', async (c) => {
    try {
      const result = await handleVideoRecommendations(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/recommendations/shorts', async (c) => {
    try {
      const result = await handleShortsRecommendations(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/recommendations/streams', async (c) => {
    try {
      const result = await handleStreamRecommendations(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/recommendations/related', async (c) => {
    try {
      const result = await handleRelatedRecommendations(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/recommendations/trending', async (c) => {
    try {
      const result = await handlePersonalizedTrending(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/recommendations/discover', async (c) => {
    try {
      const result = await handleDiscoverRecommendations(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/recommendations/interaction', async (c) => {
    try {
      const result = await handleRecordInteraction(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Push ---
  app.all('/api/push/subscribe', async (c) => {
    try {
      return await withSession(c, () => handlePushSubscribe(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/push/send', async (c) => {
    try {
      const result = await handlePushSend(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Newsletter ---
  app.all('/api/newsletter/subscribe', async (c) => {
    try {
      const result = await handleNewsletterSubscribe(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/newsletter/status', async (c) => {
    try {
      const result = await handleNewsletterStatus(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/newsletter/digest', async (c) => {
    try {
      const result = await handleNewsletterDigest(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/newsletter/digest/*', async (c) => {
    try {
      const result = await handleNewsletterDigest(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Newsletter Send (SendGrid/Mailgun/SMTP) ---
  app.post('/api/newsletter/send', async (c) => {
    try {
      const result = await handleNewsletterSend(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/newsletter/subscribers', async (c) => {
    try {
      const result = await handleNewsletterSubscribersList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/newsletter/subscriber', async (c) => {
    try {
      const result = await handleNewsletterSubscriberRemove(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/newsletter/draft', async (c) => {
    try {
      const result = await handleNewsletterCreateDraft(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/newsletter/test', async (c) => {
    try {
      const result = await handleNewsletterSendTest(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Newsletter Bridge (Substack/Ghost) ---
  app.post('/api/newsletter/bridge/connect', async (c) => {
    try {
      const result = await handleNewsletterBridgeConnect(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/newsletter/bridge/disconnect', async (c) => {
    try {
      const result = await handleNewsletterBridgeDisconnect(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/newsletter/bridge/list', async (c) => {
    try {
      const result = await handleNewsletterBridgeList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/newsletter/bridge/poll', async (c) => {
    try {
      const result = await handleNewsletterBridgePoll(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/newsletter/bridge/auto-poll', async (c) => {
    try {
      const result = await handleNewsletterBridgeAutoPoll(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/newsletter/bridge/stats', async (c) => {
    try {
      const result = await handleNewsletterBridgeStats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Creator Newsletter (EmailEngine) ---
  app.post('/api/newsletter/creator/send', async (c) => {
    try {
      const result = await handleCreatorNewsletterSend(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/newsletter/creator/subscribers', async (c) => {
    try {
      const result = await handleCreatorNewsletterSubscribers(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/newsletter/creator/subscribe', async (c) => {
    try {
      const result = await handleCreatorNewsletterSubscribe(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.delete('/api/newsletter/creator/subscribe', async (c) => {
    try {
      const result = await handleCreatorNewsletterUnsubscribe(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/newsletter/creator/count', async (c) => {
    try {
      const result = await handleCreatorNewsletterCount(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/newsletter/creator/stats/*', async (c) => {
    try {
      const result = await handleCreatorNewsletterStats(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/newsletter/creator/webhook/mailgun', async (c) => {
    try {
      const result = await handleMailgunWebhook(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/newsletter/creator/health', async (c) => {
    try {
      const result = await handleCreatorNewsletterHealth(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Digest (Daily) ---
  app.all('/api/digest/today', async (c) => {
    try {
      const result = await handleDigestToday(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/digest/yesterday', async (c) => {
    try {
      const result = await handleDigestYesterday(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/digest/format', async (c) => {
    try {
      const result = await handleDigestFormat(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/digest/subscribe-email', async (c) => {
    try {
      const result = await handleDigestSubscribeEmail(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/digest/unsubscribe-email', async (c) => {
    try {
      const result = await handleDigestUnsubscribeEmail(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/digest/status', async (c) => {
    try {
      const result = await handleDigestStatus(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- Newsletter Creator Routes ---
  app.post('/api/news/newsletter/create', async (c) => {
    try {
      const result = await handleNewsletterCreatorCreate(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/news/newsletter/mine', async (c) => {
    try {
      const result = await handleNewsletterCreatorMine(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/news/newsletter/:id/issue', async (c) => {
    try {
      const result = await handleNewsletterCreatorIssue(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/news/newsletter/issues', async (c) => {
    try {
      const result = await handleNewsletterCreatorIssues(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.post('/api/news/newsletter/subscribe', async (c) => {
    try {
      const result = await handleNewsletterCreatorSubscribe(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/feed', async (c) => {
    try {
      const result = await handleNewsFeed(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/trending', async (c) => {
    try {
      const result = await handleNewsTrending(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/category/:category', async (c) => {
    try {
      const result = await handleNewsCategory(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/story/:storyId', async (c) => {
    try {
      const result = await handleNewsStory(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/search', async (c) => {
    try {
      const result = await handleNewsSearch(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/sources', async (c) => {
    try {
      const result = await handleNewsSourcesRoute(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/sources/health', async (c) => {
    try {
      const result = await handleNewsSourcesRoute(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/sources/refresh', async (c) => {
    try {
      const result = await handleNewsSourcesRoute(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/sources/stats', async (c) => {
    try {
      const result = await handleNewsSourcesRoute(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/preferences', async (c) => {
    try {
      const result = await handleNewsPreferences(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/digest/preview', async (c) => {
    try {
      const result = await handleNewsDigestPreview(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/digest/subscribe', async (c) => {
    try {
      const result = await handleNewsDigestSubscribe(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- New personalized/digest endpoints ---
  app.all('/api/news/for-you', async (c) => {
    try {
      const result = await handleNewsForYou(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/hot', async (c) => {
    try {
      const result = await handleNewsHot(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/deep-dives', async (c) => {
    try {
      const result = await handleNewsDeepDives(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/quick-reads', async (c) => {
    try {
      const result = await handleNewsQuickReads(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/protocol/:protocol', async (c) => {
    try {
      const result = await handleNewsProtocol(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/token/:token', async (c) => {
    try {
      const result = await handleNewsToken(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/author/:author', async (c) => {
    try {
      const result = await handleNewsAuthor(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/mark-read', async (c) => {
    try {
      const result = await handleNewsMarkRead(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/reading-list', async (c) => {
    try {
      const result = await handleReadingList(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.all('/api/news/reading-list/:id', async (c) => {
    try {
      const result = await handleReadingListToggle(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Trending Sidebar ---
  app.get('/api/trending/sidebar', async (c) => {
    try {
      const result = await handleTrendingSidebar(c.req.raw, c.env);
      return ok(result);
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });

  // --- API: Trending Scraper & Aggregation ---
  app.get('/api/trending/aggregated', async (c) => {
    try {
      const m = await import('../../routes/trending-scraper');
      const data = await m.scrapeTrendingContent(c.env);
      return jsonResponse({ items: m.mergeTrendingItems(data), generatedAt: Date.now() });
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
  app.get('/api/trending/per-platform', async (c) => {
    const { scrapeTrendingContent } = await import('../../routes/trending-scraper');
    const data = await scrapeTrendingContent(c.env);
    return ok(data.platforms);
  });
  app.get('/api/trending/now', async (c) => {
    const m = await import('../../routes/trending-scraper');
    const data = await m.scrapeTrendingContent(c.env);
    return jsonResponse({ items: m.mergeTrendingItems(data), generatedAt: Date.now() });
  });
  app.get('/api/trending/cross-network', async (c) => {
    const { scrapeTrendingContent } = await import('../../routes/trending-scraper');
    const data = await scrapeTrendingContent(c.env);
    return ok(data);
  });

  // --- V1: Source Discovery ---
  app.get('/api/sources/discover', async (c) => handleSourcesDiscover(c.req.raw, c.env));
  app.get('/api/sources/pending', async (c) => handleSourcesPending(c.req.raw, c.env));
  app.post('/api/sources/approve', async (c) =>
    withSession(c, () => handleSourcesApprove(c.req.raw, c.env)),
  );
  app.post('/api/sources/reject', async (c) =>
    withSession(c, () => handleSourcesReject(c.req.raw, c.env)),
  );
  app.get('/api/sources/health', async (c) => handleSourcesHealth(c.req.raw, c.env));
  app.get('/api/sources/trending', async (c) => handleSourcesTrending(c.req.raw, c.env));
  app.get('/api/sources/stale', async (c) => handleSourcesStale(c.req.raw, c.env));
  app.get('/api/sources/new-this-week', async (c) => handleSourcesNewThisWeek(c.req.raw, c.env));
  app.get('/api/sources/stats', async (c) => handleSourcesStats(c.req.raw, c.env));
  app.post('/api/sources/health-check', async (c) =>
    withSession(c, () => handleSourcesHealthCheck(c.req.raw, c.env)),
  );
  app.post('/api/sources/record-engagement', async (c) =>
    withSession(c, () => handleRecordEngagement(c.req.raw, c.env)),
  );

  // --- Feed cache management ---
  app.post('/api/feed/cache/invalidate', async (c) => {
    try {
      return await withSession(c, () => handleFeedCacheInvalidate(c.req.raw, c.env));
    } catch (err) {
      return serverError(err instanceof Error ? err.message : 'Unknown error');
    }
  });
}
