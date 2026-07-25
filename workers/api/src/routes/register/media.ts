/**
 * @degenfeed/api-worker - Media route registration
 *
 * Register Media-related routes on the Hono app instance.
 */

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { handleContentResolve } from '../../routes/content';
import {
  handleImportTwitter as handleContentImportTwitter,
  handleExportContentJson,
  handleExportContentMarkdown,
  handleExportContentOpml,
  handleImportMedium,
  handleImportRss,
  handleImportStatus,
  handleImportSubstack,
  handleImportYouTube,
} from '../../routes/content-import';
import {
  handleDeleteContentLibraryItem,
  handleGetContentLibraryItem,
  handleGetContentLicense,
  handleGetContentMonetization,
  handleGetContentUsage,
  handleListContentLibrary,
  handleSetContentLicense,
  handleSetContentMonetization,
  handleSyncAllContentEngagement,
  handleSyncContentEngagement,
  handleUpdateContentLibraryItem,
} from '../../routes/content-library-routes';
import {
  handleExecuteSyndication,
  handleGetSyndicationHistory,
  handleGetSyndicationRules,
  handleListSyndicationQueue,
  handleQueueSyndication,
  handleSetSyndicationRules,
  handleUpdateProtocolRule,
} from '../../routes/content-syndication-routes';
import { handleEmbedPost, handleEmbedResolve } from '../../routes/embed';
import { handleFrameAction, handleFrameResolve } from '../../routes/frame';
import {
  handleGhostCrossPost,
  handleGhostNewsletterSend,
  handleGhostPostBySlug,
  handleGhostPostCreate,
  handleGhostPosts,
  handleGhostSubscribe,
  handleGhostSubscribers,
  handleGhostTip,
  handleGhostUnsubscribe,
} from '../../routes/ghost';
import {
  handleGetImage,
  handleGetImageMetadata,
  handleImageUpload,
  handleMakePermanent,
  handleMediaGateway,
  handleMediaHealth,
  handleMediaUpload,
} from '../../routes/media';
import {
  handleMirrorArticleByTxId,
  handleMirrorArticles,
  handleMirrorImport,
  handleMirrorPublish,
  handleMirrorSearch,
  handleMirrorTrending,
} from '../../routes/mirror';
import {
  handleParagraphArticles,
  handleParagraphArticlesByFid,
  handleParagraphImport,
  handleParagraphNewsletterStats,
  handleParagraphPublish,
  handleParagraphSearch,
  handleParagraphSubscribe,
  handleParagraphTrending,
} from '../../routes/paragraph';
import unifiedVideoFeed from '../../routes/unified-video-feed';
import { videoAggregator } from '../../routes/video-aggregator';
import { videoBridges } from '../../routes/video-bridges';
import videoHub from '../../routes/video-hub';

export function registerMediaRoutes(app: Hono<{ Bindings: Env }>): void {
  // --- API: Decentralized Media Storage (IPFS + Arweave) ---
  app.post('/api/media/upload/image', async (c) => handleImageUpload(c.req.raw, c.env));
  app.post('/api/media/upload', async (c) => handleMediaUpload(c.req.raw, c.env));
  app.get('/api/media/image/:cid', async (c) =>
    handleGetImage(c.req.raw, c.env, c.req.param('cid')),
  );
  app.get('/api/media/image/:cid/metadata', async (c) =>
    handleGetImageMetadata(c.req.raw, c.env, c.req.param('cid')),
  );
  app.get('/api/media/gateway/:type/:id', async (c) =>
    handleMediaGateway(c.req.raw, c.env, c.req.param('type'), c.req.param('id')),
  );
  app.get('/api/media/health', async (c) => handleMediaHealth(c.req.raw, c.env));
  app.post('/api/media/make-permanent', async (c) => handleMakePermanent(c.req.raw, c.env));

  // --- API: Video Aggregator (cross-platform creator following) ---
  app.route('/api/video/aggregator', videoAggregator);

  // --- API: Video Bridges (per-platform content endpoints) ---
  app.route('/api/video/bridges', videoBridges);

  // --- API: Unified Video Feed (all platforms, zero-cost hosting) ---
  app.route('/api/video/unified-feed', unifiedVideoFeed);

  // --- API: Video Hub (categorized video discovery across all sources) ---
  app.route('/api/video', videoHub);

  // --- API: Ghost CMS Headless ---
  app.get('/api/ghost/posts', async (c) => handleGhostPosts(c.req.raw, c.env));
  app.get('/api/ghost/posts/:slug', async (c) => handleGhostPostBySlug(c.req.raw, c.env));
  app.post('/api/ghost/posts', async (c) => handleGhostPostCreate(c.req.raw, c.env));
  app.post('/api/ghost/posts/:id/tip', async (c) => handleGhostTip(c.req.raw, c.env));
  app.post('/api/ghost/posts/:id/cross-post', async (c) => handleGhostCrossPost(c.req.raw, c.env));
  app.post('/api/ghost/newsletter/send', async (c) => handleGhostNewsletterSend(c.req.raw, c.env));
  app.post('/api/ghost/subscribe', async (c) => handleGhostSubscribe(c.req.raw, c.env));
  app.post('/api/ghost/unsubscribe', async (c) => handleGhostUnsubscribe(c.req.raw, c.env));
  app.get('/api/ghost/subscribers', async (c) => handleGhostSubscribers(c.req.raw, c.env));

  // --- API: Mirror.xyz Bridge ---
  app.post('/api/mirror/publish', async (c) => handleMirrorPublish(c.req.raw, c.env));
  app.get('/api/mirror/articles', async (c) => handleMirrorArticles(c.req.raw, c.env));
  app.get('/api/mirror/articles/:txId', async (c) => handleMirrorArticleByTxId(c.req.raw, c.env));
  app.post('/api/mirror/import', async (c) => handleMirrorImport(c.req.raw, c.env));
  app.get('/api/mirror/trending', async (c) => handleMirrorTrending(c.req.raw, c.env));
  app.get('/api/mirror/search', async (c) => handleMirrorSearch(c.req.raw, c.env));

  // --- API: Paragraph.xyz Bridge ---
  app.post('/api/paragraph/publish', async (c) => handleParagraphPublish(c.req.raw, c.env));
  app.get('/api/paragraph/articles/:fid', async (c) =>
    handleParagraphArticlesByFid(c.req.raw, c.env),
  );
  app.get('/api/paragraph/articles', async (c) => handleParagraphArticles(c.req.raw, c.env));
  app.get('/api/paragraph/trending', async (c) => handleParagraphTrending(c.req.raw, c.env));
  app.post('/api/paragraph/import', async (c) => handleParagraphImport(c.req.raw, c.env));
  app.post('/api/paragraph/subscribe', async (c) => handleParagraphSubscribe(c.req.raw, c.env));
  app.get('/api/paragraph/newsletter/stats', async (c) =>
    handleParagraphNewsletterStats(c.req.raw, c.env),
  );
  app.get('/api/paragraph/search', async (c) => handleParagraphSearch(c.req.raw, c.env));

  // --- API: Content Library ---
  app.all('/api/content/library/sync-all', async (c) =>
    handleSyncAllContentEngagement(c.req.raw, c.env),
  );
  app.all('/api/content/library', async (c) => handleListContentLibrary(c.req.raw, c.env));
  app.all('/api/content/library/:contentId/sync', async (c) =>
    handleSyncContentEngagement(c.req.raw, c.env),
  );
  app.all('/api/content/library/:contentId/license', async (c) => {
    if (c.req.method === 'POST') return handleSetContentLicense(c.req.raw, c.env);
    return handleGetContentLicense(c.req.raw, c.env);
  });
  app.all('/api/content/library/:contentId/monetization', async (c) => {
    if (c.req.method === 'POST') return handleSetContentMonetization(c.req.raw, c.env);
    return handleGetContentMonetization(c.req.raw, c.env);
  });
  app.all('/api/content/library/:contentId/usage', async (c) =>
    handleGetContentUsage(c.req.raw, c.env),
  );
  app.all('/api/content/library/:contentId', async (c) => {
    if (c.req.method === 'PUT') return handleUpdateContentLibraryItem(c.req.raw, c.env);
    if (c.req.method === 'DELETE') return handleDeleteContentLibraryItem(c.req.raw, c.env);
    return handleGetContentLibraryItem(c.req.raw, c.env);
  });

  // --- API: Content Import/Export ---
  app.all('/api/content/import/youtube', async (c) => handleImportYouTube(c.req.raw, c.env));
  app.all('/api/content/import/medium', async (c) => handleImportMedium(c.req.raw, c.env));
  app.all('/api/content/import/substack', async (c) => handleImportSubstack(c.req.raw, c.env));
  app.all('/api/content/import/twitter', async (c) => handleContentImportTwitter(c.req.raw, c.env));
  app.all('/api/content/import/rss', async (c) => handleImportRss(c.req.raw, c.env));
  app.all('/api/content/import/status/:id', async (c) => handleImportStatus(c.req.raw, c.env));
  app.all('/api/content/export', async (c) => handleExportContentJson(c.req.raw, c.env));
  app.all('/api/content/export/markdown', async (c) =>
    handleExportContentMarkdown(c.req.raw, c.env),
  );
  app.all('/api/content/export/opml', async (c) => handleExportContentOpml(c.req.raw, c.env));

  // --- API: Content Syndication ---
  app.all('/api/content/syndication/rules/:protocol', async (c) =>
    handleUpdateProtocolRule(c.req.raw, c.env),
  );
  app.all('/api/content/syndication/rules', async (c) => {
    if (c.req.method === 'POST') return handleSetSyndicationRules(c.req.raw, c.env);
    return handleGetSyndicationRules(c.req.raw, c.env);
  });
  app.all('/api/content/syndication/queue/:queueId', async (c) =>
    handleExecuteSyndication(c.req.raw, c.env),
  );
  app.all('/api/content/syndication/queue', async (c) => {
    if (c.req.method === 'POST') return handleQueueSyndication(c.req.raw, c.env);
    return handleListSyndicationQueue(c.req.raw, c.env);
  });
  app.all('/api/content/syndication/history', async (c) =>
    handleGetSyndicationHistory(c.req.raw, c.env),
  );
  app.all('/api/content/syndication/can/:protocol', async (c) =>
    handleCanSyndicate(c.req.raw, c.env),
  );

  // --- API: Content Resolution (df:// URIs) ---
  app.all('/api/content/*', async (c) => handleContentResolve(c.req.raw, c.env));

  // --- API: Embed ---
  app.all('/api/embed/resolve', async (c) => handleEmbedResolve(c.req.raw, c.env));
  app.all('/api/embed/*', async (c) => handleEmbedPost(c.req.raw, c.env));

  // --- API: Frame ---
  app.all('/api/frame/resolve', async (c) => handleFrameResolve(c.req.raw, c.env));
  app.all('/api/frame/action', async (c) => handleFrameAction(c.req.raw, c.env));
}
