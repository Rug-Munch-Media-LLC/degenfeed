/**
 * @degenfeed/api-worker - Feed route registration
 *
 * Register Feed-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { jsonResponse } from '../../index';
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
  app.get('/api/shorts/feed', async (c) => handleShortsFeed(c.req.raw, c.env));
  app.get('/api/shorts/trending', async (c) => handleShortsTrending(c.req.raw, c.env));
  app.get('/api/shorts/for-you', async (c) => handleShortsForYou(c.req.raw, c.env));
  app.get('/api/shorts/source/:source', async (c) => handleShortsBySource(c.req.raw, c.env));
  app.post('/api/shorts/create', async (c) => handleCreateShort(c.req.raw, c.env));

  // --- Unified multi-protocol publish & mint ---
  app.post('/api/shorts/publish', async (c) => handleUnifiedPublish(c.req.raw, c.env));
  app.post('/api/shorts/mint', async (c) => handleUnifiedMint(c.req.raw, c.env));

  // --- Unified multi-protocol feed ---
  app.get('/api/shorts/unified/feed', async (c) => handleUnifiedFeed(c.req.raw, c.env));
  app.get('/api/shorts/unified/:source', async (c) => handleUnifiedFeedBySource(c.req.raw, c.env));

  // --- Cross-platform actions on shorts ---
  app.post('/api/shorts/:id/tip', async (c) => handleShortsTip(c.req.raw, c.env));
  app.post('/api/shorts/:id/share', async (c) => handleShortsShare(c.req.raw, c.env));

  // --- V2 enhanced feed (ShortsAggregatorV2 + ShortsAlgorithm) ---
  app.get('/api/shorts/v2/feed', async (c) => handleShortsFeedV2(c.req.raw, c.env));
  app.get('/api/shorts/v2/trending', async (c) => handleShortsTrendingV2(c.req.raw, c.env));
  app.get('/api/shorts/category/:cat', async (c) => handleShortsByCategory(c.req.raw, c.env));
  app.post('/api/shorts/watch', async (c) => handleShortsWatch(c.req.raw, c.env));
  app.post('/api/shorts/feedback', async (c) => handleShortsFeedback(c.req.raw, c.env));
  app.get('/api/shorts/algorithm/status', async (c) => handleAlgorithmStatus(c.req.raw, c.env));

  // --- Shorts source management ---
  app.get('/api/shorts/sources', async (c) => handleListSources(c.req.raw, c.env));
  app.post('/api/shorts/sources', async (c) => handleAddSource(c.req.raw, c.env));
  app.delete('/api/shorts/sources/:id', async (c) => handleRemoveSource(c.req.raw, c.env));
  app.post('/api/shorts/sources/:id/refresh', async (c) => handleRefreshSource(c.req.raw, c.env));
  app.get('/api/shorts/sources/suggestions', async (c) =>
    handleSourceSuggestions(c.req.raw, c.env),
  );

  // --- Zora video NFT endpoints ---
  app.get('/api/shorts/zora/trending', async (c) => handleZoraTrending(c.req.raw, c.env));
  app.get('/api/shorts/zora/creator', async (c) => handleZoraCreator(c.req.raw, c.env));

  // --- API: Feed (specific routes before parameterized) ---
  app.all('/api/feed/home', async (c) => handleHomeFeed(c.req.raw, c.env, c.executionCtx));
  app.get('/api/feed/protocol-sections', async (c) => handleProtocolSections(c.req.raw, c.env));
  app.all('/api/feed/for-you', async (c) => handleForYouFeed(c.req.raw, c.env, c.executionCtx));
  app.post('/api/feed/dwell', async (c) => handleRecordDwell(c.req.raw, c.env));
  app.post('/api/feed/feedback', async (c) => handleFeedback(c.req.raw, c.env));
  app.all('/api/feed/trending', async (c) => handleTrendingFeed(c.req.raw, c.env, c.executionCtx));
  app.all('/api/feed/health', async (c) => handleFeedHealth(c.req.raw, c.env));
  app.all('/api/feed/pixelfed', async (c) => handlePixelfedFeed(c.req.raw, c.env));
  app.all('/api/pixelfed/trending', async (c) => handlePixelfedTrending(c.req.raw, c.env));
  app.all('/api/pixelfed/tags/:tag', async (c) =>
    handlePixelfedTag(c.req.raw, c.env, c.req.param('tag')),
  );
  app.all('/api/pixelfed/health', async (c) => handlePixelfedHealth(c.req.raw, c.env));
  app.all('/api/feed/rss.xml', async (c) => handleRssXml(c.req.raw, c.env));
  app.all('/api/feed/atom.xml', async (c) => handleRssXml(c.req.raw, c.env));
  app.all('/api/feed/news', async (c) => handleNewsFeed(c.req.raw, c.env));
  app.all('/api/feed/reddit', async (c) => handleRedditFeed(c.req.raw, c.env));
  app.all('/api/feed/activitypub', async (c) => handleActivityPubFeed(c.req.raw, c.env));
  app.all('/api/feed/threads', async (c) => handleThreadsFeed(c.req.raw, c.env));
  app.all('/api/feed/farcaster', async (c) => handleFarcasterFeed(c.req.raw, c.env));
  app.all('/api/feed/rss', async (c) => handleRssFeed(c.req.raw, c.env));
  app.all('/api/feed/post/:postId/replies', async (c) =>
    handlePostReplies(c.req.raw, c.env, c.req.param('postId')),
  );
  app.get('/api/og', async (c) => handleOgFetch(c.req.raw));
  app.all('/api/feed/post/:postId', async (c) => {
    const postId = c.req.param('postId');
    if (c.req.query('format') === 'og') return handlePostOg(c.req.raw, c.env, postId);
    return handlePostById(c.req.raw, c.env, postId);
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
  app.all('/api/feed/category/:category', async (c) =>
    handleCategorySlugFeed(c.req.raw, c.env, c.req.param('category'), c.executionCtx),
  );
  app.all('/api/feed/mix', async (c) => handleCategoryMixFeed(c.req.raw, c.env, c.executionCtx));
  app.all('/api/feed/everything', async (c) =>
    handleEverythingFeed(c.req.raw, c.env, c.executionCtx),
  );
  app.all('/api/feed/per-protocol/:protocol/:category', async (c) =>
    handlePerProtocolCategoryFeed(
      c.req.raw,
      c.env,
      c.req.param('protocol'),
      c.req.param('category'),
      c.executionCtx,
    ),
  );
  app.all('/api/feed/unified', async (c) => handleUnifiedFeed(c.req.raw, c.env));
  app.get('/api/feed/unified/trending', async (c) => handleTrendingContent(c.req.raw, c.env));
  app.get('/api/feed/unified/for-you', async (c) => handleForYouFeed(c.req.raw, c.env));
  app.get('/api/feed/unified/category/:id', async (c) =>
    handleCategoryFeed(c.req.raw, c.env, c.req.param('id')),
  );
  app.get('/api/feed/unified/search', async (c) => handleUnifiedSearch(c.req.raw, c.env));
  app.get('/api/feed/unified/sources', async (c) => handleSourceDiscovery(c.req.raw, c.env));
  app.post('/api/feed/unified/default', async (c) => handleDefaultFeed(c.req.raw, c.env));
  app.get('/api/feed/unified/network/:network', async (c) =>
    handleNetworkFeed(c.req.raw, c.env, c.req.param('network')),
  );
  app.all('/api/feed/visual', async (c) => handleVisualFeed(c.req.raw, c.env));
  app.all('/api/feed/visual/trending', async (c) => handleVisualTrending(c.req.raw, c.env));
  app.all('/api/feed/visual/for-you', async (c) => handleVisualForYou(c.req.raw, c.env));
  app.all('/api/feed/images/trending', async (c) => handleImagesTrending(c.req.raw, c.env));
  app.all('/api/feed/images/latest', async (c) => handleImagesLatest(c.req.raw, c.env));
  app.all('/api/feed/images/category', async (c) => handleImagesCategory(c.req.raw, c.env));
  app.all('/api/feed/images/creator', async (c) => handleImagesCreator(c.req.raw, c.env));

  // --- Protocol-specific feeds — must be before provider catch-all ---
  app.get('/api/feed/protocols', async (c) => handleProtocolsList(c.req.raw, c.env));
  app.get('/api/feed/protocol/:protocol', async (c) =>
    handleProtocolFeed(c.req.raw, c.env, c.req.param('protocol'), c.executionCtx),
  );
  app.get('/api/feed/protocol/:protocol/popular', async (c) =>
    handleProtocolPopular(c.req.raw, c.env, c.req.param('protocol'), c.executionCtx),
  );
  app.get('/api/feed/protocol/:protocol/trending', async (c) =>
    handleProtocolTrendingRoute(c.req.raw, c.env, c.req.param('protocol'), c.executionCtx),
  );
  app.get('/api/feed/protocol/:protocol/newest', async (c) =>
    handleProtocolNewest(c.req.raw, c.env, c.req.param('protocol'), c.executionCtx),
  );
  app.get('/api/feed/protocol/:protocol/videos', async (c) =>
    handleProtocolVideos(c.req.raw, c.env, c.req.param('protocol'), c.executionCtx),
  );
  app.all('/api/feed/:provider', async (c) =>
    handleProviderFeed(c.req.raw, c.env, c.req.param('provider')),
  );

  // --- API: Custom Feeds (session-gated) ---
  app.post('/api/custom-feeds', async (c) =>
    withSession(c, () => handleCustomFeedCreate(c.req.raw, c.env)),
  );
  app.get('/api/custom-feeds', async (c) => handleCustomFeedList(c.req.raw, c.env));
  app.get('/api/custom-feeds/public', async (c) => handleCustomFeedPublic(c.req.raw, c.env));
  app.post('/api/custom-feeds/:id/subscribe', async (c) =>
    withSession(c, () => handleCustomFeedSubscribe(c.req.raw, c.env, c.req.param('id'))),
  );
  app.get('/api/custom-feeds/:id/execute', async (c) =>
    handleCustomFeedExecute(c.req.raw, c.env, c.req.param('id')),
  );
  app.get('/api/custom-feeds/:id', async (c) =>
    handleCustomFeedGet(c.req.raw, c.env, c.req.param('id')),
  );
  app.put('/api/custom-feeds/:id', async (c) =>
    withSession(c, () => handleCustomFeedUpdate(c.req.raw, c.env, c.req.param('id'))),
  );
  app.delete('/api/custom-feeds/:id', async (c) =>
    withSession(c, () => handleCustomFeedDelete(c.req.raw, c.env, c.req.param('id'))),
  );

  // --- API: Bluesky Feed Generator (live content feed) ---
  app.route('/api/bluesky/feed', blueskyFeedGen);

  // --- API: RMI ---
  app.all('/api/rmi/news/headlines', async (c) => handleRmiHeadlines(c.req.raw, c.env));
  app.all('/api/rmi/news/sources', async (c) => handleRmiSources(c.req.raw, c.env));
  app.all('/api/rmi/news/sentiment', async (c) => handleRmiSentiment(c.req.raw, c.env));
  app.all('/api/rmi/news/stats', async (c) => handleRmiStats(c.req.raw, c.env));
  app.all('/api/rmi/health', async (c) => handleRmiHealth(c.req.raw, c.env));
  app.all('/api/rmi/news', async (c) => handleRmiNews(c.req.raw, c.env));
  app.all('/api/rmi/news/*', async (c) => handleRmiNews(c.req.raw, c.env));

  // --- API: Discover ---
  app.all('/api/discover', async (c) => handleDiscover(c.req.raw, c.env));
  app.get('/api/discover/trending', async (c) => handleDiscoverTrending(c.req.raw, c.env));
  app.get('/api/discover/communities', async (c) => handleDiscoverCommunities(c.req.raw, c.env));
  app.get('/api/discover/people', async (c) => handleDiscoverPeople(c.req.raw, c.env));
  app.get('/api/discover/topics', async (c) => handleDiscoverTopics(c.req.raw, c.env));
  app.get('/api/discover/featured', async (c) => handleDiscoverFeatured(c.req.raw, c.env));
  app.get('/api/discover/new', async (c) => handleDiscoverNew(c.req.raw, c.env));

  // --- API: Recommendations ---
  app.get('/api/recommendations/videos', async (c) => handleVideoRecommendations(c.req.raw, c.env));
  app.get('/api/recommendations/shorts', async (c) =>
    handleShortsRecommendations(c.req.raw, c.env),
  );
  app.get('/api/recommendations/streams', async (c) =>
    handleStreamRecommendations(c.req.raw, c.env),
  );
  app.get('/api/recommendations/related', async (c) =>
    handleRelatedRecommendations(c.req.raw, c.env),
  );
  app.get('/api/recommendations/trending', async (c) =>
    handlePersonalizedTrending(c.req.raw, c.env),
  );
  app.get('/api/recommendations/discover', async (c) =>
    handleDiscoverRecommendations(c.req.raw, c.env),
  );
  app.post('/api/recommendations/interaction', async (c) =>
    handleRecordInteraction(c.req.raw, c.env),
  );

  // --- API: Push ---
  app.all('/api/push/subscribe', async (c) =>
    withSession(c, () => handlePushSubscribe(c.req.raw, c.env)),
  );
  app.all('/api/push/send', async (c) => handlePushSend(c.req.raw, c.env));

  // --- API: Newsletter ---
  app.all('/api/newsletter/subscribe', async (c) => handleNewsletterSubscribe(c.req.raw, c.env));
  app.all('/api/newsletter/status', async (c) => handleNewsletterStatus(c.req.raw, c.env));
  app.all('/api/newsletter/digest', async (c) => handleNewsletterDigest(c.req.raw, c.env));
  app.all('/api/newsletter/digest/*', async (c) => handleNewsletterDigest(c.req.raw, c.env));

  // --- API: Newsletter Send (SendGrid/Mailgun/SMTP) ---
  app.post('/api/newsletter/send', async (c) => handleNewsletterSend(c.req.raw, c.env));
  app.get('/api/newsletter/subscribers', async (c) =>
    handleNewsletterSubscribersList(c.req.raw, c.env),
  );
  app.delete('/api/newsletter/subscriber', async (c) =>
    handleNewsletterSubscriberRemove(c.req.raw, c.env),
  );
  app.post('/api/newsletter/draft', async (c) => handleNewsletterCreateDraft(c.req.raw, c.env));
  app.post('/api/newsletter/test', async (c) => handleNewsletterSendTest(c.req.raw, c.env));

  // --- API: Newsletter Bridge (Substack/Ghost) ---
  app.post('/api/newsletter/bridge/connect', async (c) =>
    handleNewsletterBridgeConnect(c.req.raw, c.env),
  );
  app.delete('/api/newsletter/bridge/disconnect', async (c) =>
    handleNewsletterBridgeDisconnect(c.req.raw, c.env),
  );
  app.get('/api/newsletter/bridge/list', async (c) => handleNewsletterBridgeList(c.req.raw, c.env));
  app.post('/api/newsletter/bridge/poll', async (c) =>
    handleNewsletterBridgePoll(c.req.raw, c.env),
  );
  app.post('/api/newsletter/bridge/auto-poll', async (c) =>
    handleNewsletterBridgeAutoPoll(c.req.raw, c.env),
  );
  app.get('/api/newsletter/bridge/stats', async (c) =>
    handleNewsletterBridgeStats(c.req.raw, c.env),
  );

  // --- API: Creator Newsletter (EmailEngine) ---
  app.post('/api/newsletter/creator/send', async (c) =>
    handleCreatorNewsletterSend(c.req.raw, c.env),
  );
  app.get('/api/newsletter/creator/subscribers', async (c) =>
    handleCreatorNewsletterSubscribers(c.req.raw, c.env),
  );
  app.post('/api/newsletter/creator/subscribe', async (c) =>
    handleCreatorNewsletterSubscribe(c.req.raw, c.env),
  );
  app.delete('/api/newsletter/creator/subscribe', async (c) =>
    handleCreatorNewsletterUnsubscribe(c.req.raw, c.env),
  );
  app.get('/api/newsletter/creator/count', async (c) =>
    handleCreatorNewsletterCount(c.req.raw, c.env),
  );
  app.get('/api/newsletter/creator/stats/*', async (c) =>
    handleCreatorNewsletterStats(c.req.raw, c.env),
  );
  app.post('/api/newsletter/creator/webhook/mailgun', async (c) =>
    handleMailgunWebhook(c.req.raw, c.env),
  );
  app.get('/api/newsletter/creator/health', async (c) =>
    handleCreatorNewsletterHealth(c.req.raw, c.env),
  );

  // --- API: Digest (Daily) ---
  app.all('/api/digest/today', async (c) => handleDigestToday(c.req.raw, c.env));
  app.all('/api/digest/yesterday', async (c) => handleDigestYesterday(c.req.raw, c.env));
  app.all('/api/digest/format', async (c) => handleDigestFormat(c.req.raw, c.env));
  app.all('/api/digest/subscribe-email', async (c) => handleDigestSubscribeEmail(c.req.raw, c.env));
  app.all('/api/digest/unsubscribe-email', async (c) =>
    handleDigestUnsubscribeEmail(c.req.raw, c.env),
  );
  app.all('/api/digest/status', async (c) => handleDigestStatus(c.req.raw, c.env));

  // --- Newsletter Creator Routes ---
  app.post('/api/news/newsletter/create', async (c) =>
    handleNewsletterCreatorCreate(c.req.raw, c.env),
  );
  app.get('/api/news/newsletter/mine', async (c) => handleNewsletterCreatorMine(c.req.raw, c.env));
  app.post('/api/news/newsletter/:id/issue', async (c) =>
    handleNewsletterCreatorIssue(c.req.raw, c.env),
  );
  app.get('/api/news/newsletter/issues', async (c) =>
    handleNewsletterCreatorIssues(c.req.raw, c.env),
  );
  app.post('/api/news/newsletter/subscribe', async (c) =>
    handleNewsletterCreatorSubscribe(c.req.raw, c.env),
  );
  app.all('/api/news/feed', async (c) => handleNewsFeed(c.req.raw, c.env));
  app.all('/api/news/trending', async (c) => handleNewsTrending(c.req.raw, c.env));
  app.all('/api/news/category/:category', async (c) => handleNewsCategory(c.req.raw, c.env));
  app.all('/api/news/story/:storyId', async (c) => handleNewsStory(c.req.raw, c.env));
  app.all('/api/news/search', async (c) => handleNewsSearch(c.req.raw, c.env));
  app.all('/api/news/sources', async (c) => handleNewsSourcesRoute(c.req.raw, c.env));
  app.all('/api/news/sources/health', async (c) => handleNewsSourcesRoute(c.req.raw, c.env));
  app.all('/api/news/sources/refresh', async (c) => handleNewsSourcesRoute(c.req.raw, c.env));
  app.all('/api/news/sources/stats', async (c) => handleNewsSourcesRoute(c.req.raw, c.env));
  app.all('/api/news/preferences', async (c) => handleNewsPreferences(c.req.raw, c.env));
  app.all('/api/news/digest/preview', async (c) => handleNewsDigestPreview(c.req.raw, c.env));
  app.all('/api/news/digest/subscribe', async (c) => handleNewsDigestSubscribe(c.req.raw, c.env));

  // --- New personalized/digest endpoints ---
  app.all('/api/news/for-you', async (c) => handleNewsForYou(c.req.raw, c.env));
  app.all('/api/news/hot', async (c) => handleNewsHot(c.req.raw, c.env));
  app.all('/api/news/deep-dives', async (c) => handleNewsDeepDives(c.req.raw, c.env));
  app.all('/api/news/quick-reads', async (c) => handleNewsQuickReads(c.req.raw, c.env));
  app.all('/api/news/protocol/:protocol', async (c) => handleNewsProtocol(c.req.raw, c.env));
  app.all('/api/news/token/:token', async (c) => handleNewsToken(c.req.raw, c.env));
  app.all('/api/news/author/:author', async (c) => handleNewsAuthor(c.req.raw, c.env));
  app.all('/api/news/mark-read', async (c) => handleNewsMarkRead(c.req.raw, c.env));
  app.all('/api/news/reading-list', async (c) => handleReadingList(c.req.raw, c.env));
  app.all('/api/news/reading-list/:id', async (c) => handleReadingListToggle(c.req.raw, c.env));

  // --- API: Trending Sidebar ---
  app.get('/api/trending/sidebar', async (c) => handleTrendingSidebar(c.req.raw, c.env));

  // --- API: Trending Scraper & Aggregation ---
  app.get('/api/trending/aggregated', async (c) => {
    const m = await import('../../routes/trending-scraper');
    const data = await m.scrapeTrendingContent(c.env);
    return jsonResponse({ items: m.mergeTrendingItems(data), generatedAt: Date.now() });
  });
  app.get('/api/trending/per-platform', async (c) => {
    const { scrapeTrendingContent } = await import('../../routes/trending-scraper');
    const data = await scrapeTrendingContent(c.env);
    return jsonResponse(data.platforms);
  });
  app.get('/api/trending/now', async (c) => {
    const m = await import('../../routes/trending-scraper');
    const data = await m.scrapeTrendingContent(c.env);
    return jsonResponse({ items: m.mergeTrendingItems(data), generatedAt: Date.now() });
  });
  app.get('/api/trending/cross-network', async (c) => {
    const { scrapeTrendingContent } = await import('../../routes/trending-scraper');
    const data = await scrapeTrendingContent(c.env);
    return jsonResponse(data);
  });

  // --- V1: Source Discovery ---
  app.get('/api/sources/discover', async (c) => handleSourcesDiscover(c.req.raw, c.env));
  app.get('/api/sources/pending', async (c) => handleSourcesPending(c.req.raw, c.env));
  app.post('/api/sources/approve', async (c) => withSession(c, () => handleSourcesApprove(c.req.raw, c.env)));
  app.post('/api/sources/reject', async (c) => withSession(c, () => handleSourcesReject(c.req.raw, c.env)));
  app.get('/api/sources/health', async (c) => handleSourcesHealth(c.req.raw, c.env));
  app.get('/api/sources/trending', async (c) => handleSourcesTrending(c.req.raw, c.env));
  app.get('/api/sources/stale', async (c) => handleSourcesStale(c.req.raw, c.env));
  app.get('/api/sources/new-this-week', async (c) => handleSourcesNewThisWeek(c.req.raw, c.env));
  app.get('/api/sources/stats', async (c) => handleSourcesStats(c.req.raw, c.env));
  app.post('/api/sources/health-check', async (c) => withSession(c, () => handleSourcesHealthCheck(c.req.raw, c.env)));
  app.post('/api/sources/record-engagement', async (c) => withSession(c, () => handleRecordEngagement(c.req.raw, c.env)));

  // --- Feed cache management ---
  app.post('/api/feed/cache/invalidate', async (c) =>
    withSession(c, () => handleFeedCacheInvalidate(c.req.raw, c.env)),
  );
}

import { handleTrendingSidebar } from '../../routes/trending-sidebar';
