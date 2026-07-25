/**
 * @degenfeed/api-worker — Content Import/Export Routes
 *
 * Import content from external platforms and export content library data.
 *
 * Import:
 *   POST /api/content/import/youtube     — Import YouTube channel/videos
 *   POST /api/content/import/medium      — Import Medium blog posts
 *   POST /api/content/import/substack     — Import Substack newsletter
 *   POST /api/content/import/twitter      — Import Twitter/X archive
 *   POST /api/content/import/rss          — Import from RSS feed
 *   GET  /api/content/import/status/:id   — Check import status
 *
 * Export:
 *   GET /api/content/export         — Export all content as JSON
 *   GET /api/content/export/markdown — Export as markdown files
 *   GET /api/content/export/opml    — Export as OPML (RSS reader compatible)
 */

import { type Env, jsonResponse } from '../index';
import type { ContentRecord, ContentType } from '../lib/content-library';
import { generateContentId, storeContent } from '../lib/content-library';
import { requireSession } from '../session';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ImportJob {
  id: string;
  wallet: string;
  platform: string;
  status: 'queued' | 'in-progress' | 'completed' | 'failed';
  progress: number;
  total: number;
  imported: number;
  errors: string[];
  startedAt: number;
  completedAt?: number;
  config: Record<string, unknown>;
}

// ─── KV Keys ────────────────────────────────────────────────────────────────

function importJobKey(id: string): string {
  return `import:job:${id}`;
}

function importJobsIndexKey(wallet: string): string {
  return `import:jobs:${wallet.toLowerCase()}`;
}

// ─── Import Job Management ──────────────────────────────────────────────────

// biome-ignore lint/style/noNonNullAssertion: KV namespace is always bound in production via wrangler.toml
function importKv(env: Env): KVNamespace {
  return env.CONTENT_LIBRARY || env.CACHE!;
}

async function createImportJob(
  env: Env,
  wallet: string,
  platform: string,
  config: Record<string, unknown>,
): Promise<ImportJob> {
  const store = importKv(env);
  const id = `import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const job: ImportJob = {
    id,
    wallet: wallet.toLowerCase(),
    platform,
    status: 'queued',
    progress: 0,
    total: 0,
    imported: 0,
    errors: [],
    startedAt: Date.now(),
    config,
  };

  await store.put(importJobKey(id), JSON.stringify(job), {
    expirationTtl: 86400 * 7, // 7 days
  });

  // Index job
  try {
    const idxKey = importJobsIndexKey(wallet);
    const raw = await store.get(idxKey);
    const idx: string[] = raw ? JSON.parse(raw) : [];
    idx.push(id);
    await store.put(idxKey, JSON.stringify(idx.slice(-100)));
  } catch {
    // non-critical
  }

  return job;
}

async function updateImportJob(
  env: Env,
  id: string,
  updates: Partial<ImportJob>,
): Promise<ImportJob | null> {
  const store = importKv(env);
  try {
    const raw = await store.get(importJobKey(id));
    if (!raw) return null;
    const job = JSON.parse(raw) as ImportJob;
    Object.assign(job, updates);
    await store.put(importJobKey(id), JSON.stringify(job));
    return job;
  } catch {
    return null;
  }
}

async function getImportJob(env: Env, id: string): Promise<ImportJob | null> {
  const store = importKv(env);
  try {
    const raw = await store.get(importJobKey(id));
    return raw ? (JSON.parse(raw) as ImportJob) : null;
  } catch {
    return null;
  }
}

// ─── Routed Handlers ────────────────────────────────────────────────────────

/**
 * POST /api/content/import/youtube
 */
export async function handleImportYouTube(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      channelId?: string;
      channelUrl?: string;
      maxVideos?: number;
    };
    if (!body.channelId && !body.channelUrl) {
      return jsonResponse({ error: 'channelId or channelUrl required' }, 400);
    }

    const job = await createImportJob(env, session.address, 'youtube', {
      channelId: body.channelId,
      channelUrl: body.channelUrl,
      maxVideos: body.maxVideos ?? 50,
    });

    // Fire-and-forget the import
    executeYouTubeImport(env, job).catch((err) =>
      console.error(`[import-youtube] Job ${job.id} failed:`, err),
    );

    return jsonResponse({ jobId: job.id, status: 'queued', platform: 'youtube' }, 202);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/content/import/medium
 */
export async function handleImportMedium(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      username?: string;
      rssFeedUrl?: string;
    };
    if (!body.username && !body.rssFeedUrl) {
      return jsonResponse({ error: 'username or rssFeedUrl required' }, 400);
    }

    const job = await createImportJob(env, session.address, 'medium', {
      username: body.username,
      rssFeedUrl: body.rssFeedUrl ?? `https://medium.com/feed/${body.username}`,
    });

    executeRssImport(env, job, 'medium').catch((err) =>
      console.error(`[import-medium] Job ${job.id} failed:`, err),
    );

    return jsonResponse({ jobId: job.id, status: 'queued', platform: 'medium' }, 202);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/content/import/substack
 */
export async function handleImportSubstack(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      newsletterUrl?: string;
    };
    if (!body.newsletterUrl) {
      return jsonResponse({ error: 'newsletterUrl required' }, 400);
    }

    const rssUrl = `${body.newsletterUrl.replace(/\/+$/, '')}/feed`;
    const job = await createImportJob(env, session.address, 'substack', {
      newsletterUrl: body.newsletterUrl,
      rssFeedUrl: rssUrl,
    });

    executeRssImport(env, job, 'substack').catch((err) =>
      console.error(`[import-substack] Job ${job.id} failed:`, err),
    );

    return jsonResponse({ jobId: job.id, status: 'queued', platform: 'substack' }, 202);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/content/import/twitter
 */
export async function handleImportTwitter(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      archiveUrl?: string;
      username?: string;
    };
    if (!body.archiveUrl && !body.username) {
      return jsonResponse({ error: 'archiveUrl or username required' }, 400);
    }

    const job = await createImportJob(env, session.address, 'twitter', {
      archiveUrl: body.archiveUrl,
      username: body.username,
    });

    // For username-based import, we can try fetching from Nitter or similar
    executeTwitterImport(env, job).catch((err) =>
      console.error(`[import-twitter] Job ${job.id} failed:`, err),
    );

    return jsonResponse({ jobId: job.id, status: 'queued', platform: 'twitter' }, 202);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/content/import/rss
 */
export async function handleImportRss(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const body = (await request.json()) as {
      feedUrl: string;
      title?: string;
    };
    if (!body.feedUrl) {
      return jsonResponse({ error: 'feedUrl required' }, 400);
    }

    const job = await createImportJob(env, session.address, 'rss', {
      feedUrl: body.feedUrl,
      title: body.title ?? 'Imported RSS Feed',
    });

    executeRssImport(env, job, 'rss').catch((err) =>
      console.error(`[import-rss] Job ${job.id} failed:`, err),
    );

    return jsonResponse({ jobId: job.id, status: 'queued', platform: 'rss' }, 202);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/content/import/status/:id
 */
export async function handleImportStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1] ?? null;
    if (!id) return jsonResponse({ error: 'Missing import job ID' }, 400);

    const job = await getImportJob(env, id);
    if (!job) return jsonResponse({ error: 'Import job not found' }, 404);

    // Ensure user owns this import job
    if (job.wallet !== session.address.toLowerCase()) {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    return jsonResponse({ data: job });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Export Handlers ────────────────────────────────────────────────────────

/**
 * GET /api/content/export
 * Export all content as JSON.
 */
export async function handleExportContentJson(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { listContent } = await import('../lib/content-library');
    const result = await listContent(env, session.address, { limit: 1000 });

    const exportData = {
      exportedAt: new Date().toISOString(),
      wallet: session.address,
      total: result.items.length,
      content: result.items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        media: item.media,
        tags: item.tags,
        niches: item.niches,
        license: item.license,
        protocols: Object.entries(item.protocols).map(([protocol, copy]) => ({
          protocol,
          status: copy.status,
          url: copy.url,
          publishedAt: copy.publishedAt,
          engagement: copy.engagement,
        })),
        importSource: item.importSource,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    };

    const _respData = JSON.stringify(exportData, null, 2); return new Response(_respData, {
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="degenfeed-content-${Date.now()}.json"`,
      },
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/content/export/markdown
 * Export all content as markdown.
 */
export async function handleExportContentMarkdown(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { listContent } = await import('../lib/content-library');
    const result = await listContent(env, session.address, { limit: 500 });

    const mdParts: string[] = [];
    mdParts.push(`# DegenFeed Content Export\n`);
    mdParts.push(`**Wallet:** ${session.address}\n`);
    mdParts.push(`**Exported:** ${new Date().toISOString()}\n`);
    mdParts.push(`**Total Items:** ${result.items.length}\n`);
    mdParts.push('---\n\n');

    for (const item of result.items) {
      mdParts.push(`## ${item.title || `Untitled ${item.type}`}\n`);
      mdParts.push(`**Type:** ${item.type}  `);
      mdParts.push(`**ID:** ${item.id}  `);

      if (item.tags.length > 0) {
        mdParts.push(`**Tags:** ${item.tags.join(', ')}  `);
      }

      mdParts.push(`**License:** ${item.license}  `);
      mdParts.push(`**Published:** ${new Date(item.createdAt).toISOString()}  \n`);

      mdParts.push(`\n${item.body}\n`);

      // Protocol copies
      if (Object.keys(item.protocols).length > 0) {
        mdParts.push('### Published On\n');
        for (const [protocol, copy] of Object.entries(item.protocols)) {
          mdParts.push(`- **${protocol}**: ${copy.url || copy.postId} (${copy.status})`);
          mdParts.push(`  - Likes: ${copy.engagement.likes}, Reposts: ${copy.engagement.reposts}`);
        }
        mdParts.push('');
      }

      if (item.media.length > 0) {
        mdParts.push('### Media\n');
        for (const m of item.media) {
          mdParts.push(`- ${m.url}${m.alt ? ` (${m.alt})` : ''}`);
        }
        mdParts.push('');
      }

      mdParts.push('---\n');
    }

    const md = mdParts.join('\n');

    return new Response(md, {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="degenfeed-content-${Date.now()}.md"`,
      },
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/content/export/opml
 * Export content as OPML (for RSS readers).
 */
export async function handleExportContentOpml(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { listContent } = await import('../lib/content-library');
    const result = await listContent(env, session.address, { limit: 500 });

    const opmlParts: string[] = [];
    opmlParts.push('<?xml version="1.0" encoding="UTF-8"?>');
    opmlParts.push('<opml version="2.0">');
    opmlParts.push('  <head>');
    opmlParts.push(`    <title>DegenFeed Content Export - ${session.address.slice(0, 10)}</title>`);
    opmlParts.push(`    <dateCreated>${new Date().toISOString()}</dateCreated>`);
    opmlParts.push('  </head>');
    opmlParts.push('  <body>');

    for (const item of result.items) {
      // Each content item as an outline
      const title = (item.title || `Untitled ${item.type}`)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;');
      const bodyPreview = item.body.slice(0, 200).replace(/&/g, '&amp;').replace(/</g, '&lt;');

      opmlParts.push('    <outline type="rss"');
      opmlParts.push(`      text="${title}"`);
      opmlParts.push(`      title="${title}"`);
      opmlParts.push(`      description="${bodyPreview}"`);
      opmlParts.push(`      type="${item.type}"`);
      opmlParts.push(`      created="${new Date(item.createdAt).toISOString()}"`);

      // Include protocol URLs as sub-outlines
      if (Object.keys(item.protocols).length > 0) {
        opmlParts.push('>');
        for (const [protocol, copy] of Object.entries(item.protocols)) {
          if (copy.url) {
            const url = copy.url.replace(/&/g, '&amp;');
            opmlParts.push(`      <outline text="${protocol}" type="link" url="${url}" />`);
          }
        }
        opmlParts.push('    </outline>');
      } else {
        opmlParts.push(' /');
      }
    }

    opmlParts.push('  </body>');
    opmlParts.push('</opml>');

    return new Response(opmlParts.join('\n'), {
      headers: {
        'content-type': 'text/xml; charset=utf-8',
        'content-disposition': `attachment; filename="degenfeed-content-${Date.now()}.opml"`,
      },
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Background Import Executors ───────────────────────────────────────────

/**
 * Execute a YouTube channel import.
 */
async function executeYouTubeImport(env: Env, job: ImportJob): Promise<void> {
  await updateImportJob(env, job.id, { status: 'in-progress' });

  const channelId = job.config.channelId as string;
  const maxVideos = (job.config.maxVideos as number) || 50;

  try {
    let videos: Array<{
      title: string;
      description: string;
      videoId: string;
      publishedAt: string;
    }> = [];

    // Try YouTube Data API if key is configured
    if (env.YOUTUBE_API_KEY && channelId) {
      const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=${Math.min(maxVideos, 50)}&order=date&type=video&key=${env.YOUTUBE_API_KEY}`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = (await res.json()) as {
          items?: Array<{
            id?: { videoId?: string };
            snippet?: { title?: string; description?: string; publishedAt?: string };
          }>;
        };
        videos = (data.items || []).map((item) => ({
          title: item.snippet?.title || '',
          description: item.snippet?.description || '',
          videoId: item.id?.videoId || '',
          publishedAt: item.snippet?.publishedAt || '',
        }));
      }
    }

    // Fallback: try to fetch from the channel's RSS feed
    if (videos.length === 0 && channelId) {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      videos = await fetchRssItems(rssUrl, maxVideos);
    }

    await updateImportJob(env, job.id, { total: videos.length });

    let imported = 0;
    for (const video of videos) {
      try {
        const contentId = generateContentId(job.wallet);
        const record: ContentRecord = {
          id: contentId,
          creatorWallet: job.wallet,
          type: 'video',
          title: video.title,
          body: video.description || video.title,
          media: [
            {
              url: `https://www.youtube.com/watch?v=${video.videoId}`,
              mimeType: 'text/html',
              alt: video.title,
            },
          ],
          protocols: {},
          tags: ['youtube-import'],
          niches: [],
          license: 'all-rights',
          siblingUris: [],
          importSource: {
            platform: 'youtube',
            externalId: video.videoId,
            url: `https://www.youtube.com/watch?v=${video.videoId}`,
            importedAt: Date.now(),
          },
          createdAt: new Date(video.publishedAt).getTime(),
          updatedAt: Date.now(),
        };

        await storeContent(env, job.wallet, record);
        imported++;
        await updateImportJob(env, job.id, {
          imported,
          progress: Math.round((imported / videos.length) * 100),
        });
      } catch {
        // Skip individual video failures
      }
    }

    await updateImportJob(env, job.id, { status: 'completed', completedAt: Date.now() });
  } catch (err) {
    await updateImportJob(env, job.id, {
      status: 'failed',
      errors: [err instanceof Error ? err.message : String(err)],
    });
  }
}

/**
 * Execute an RSS-based import (Medium, Substack, generic RSS).
 */
async function executeRssImport(env: Env, job: ImportJob, platform: string): Promise<void> {
  await updateImportJob(env, job.id, { status: 'in-progress' });

  const feedUrl = job.config.rssFeedUrl as string;
  const maxItems = (job.config.maxItems as number) || 50;

  try {
    const items = await fetchRssItems(feedUrl, maxItems);
    await updateImportJob(env, job.id, { total: items.length });

    const contentType: ContentType =
      platform === 'medium' || platform === 'substack' ? 'article' : 'post';
    let imported = 0;

    for (const item of items) {
      try {
        const contentId = generateContentId(job.wallet);
        const record: ContentRecord = {
          id: contentId,
          creatorWallet: job.wallet,
          type: contentType,
          title: item.title,
          body: item.description || item.title,
          media: [],
          protocols: {},
          tags: [`${platform}-import`],
          niches: [],
          license: 'all-rights',
          siblingUris: [],
          importSource: {
            platform,
            externalId: item.videoId || item.title,
            url: item.link || feedUrl,
            importedAt: Date.now(),
          },
          createdAt: item.publishedAt ? new Date(item.publishedAt).getTime() : Date.now(),
          updatedAt: Date.now(),
        };

        await storeContent(env, job.wallet, record);
        imported++;
        await updateImportJob(env, job.id, {
          imported,
          progress: Math.round((imported / items.length) * 100),
        });
      } catch {
        // skip
      }
    }

    await updateImportJob(env, job.id, { status: 'completed', completedAt: Date.now() });
  } catch (err) {
    await updateImportJob(env, job.id, {
      status: 'failed',
      errors: [err instanceof Error ? err.message : String(err)],
    });
  }
}

/**
 * Execute a Twitter/X import (via Nitter or basic scraping).
 */
async function executeTwitterImport(env: Env, job: ImportJob): Promise<void> {
  await updateImportJob(env, job.id, { status: 'in-progress' });

  const username = job.config.username as string;
  const archiveUrl = job.config.archiveUrl as string;

  try {
    let tweets: Array<{
      title: string;
      description: string;
      videoId: string;
      publishedAt: string;
      link: string;
    }> = [];

    // Try Nitter RSS (if available)
    if (username) {
      try {
        const nitterUrl = 'https://nitter.net';
        const rssUrl = `${nitterUrl}/${username}/rss`;
        tweets = await fetchRssItems(rssUrl, 50);
      } catch {
        // Nitter may be unavailable
      }
    }

    // If we have an archive URL, we can't parse it server-side easily,
    // but we can accept the JSON format from Twitter's data export
    if (tweets.length === 0 && archiveUrl) {
      try {
        const res = await fetch(archiveUrl, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const text = await res.text();
          // Try to parse as JSON (Twitter archive format)
          try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
              tweets = data.slice(0, 50).map((t: Record<string, unknown>) => ({
                title: (t.text as string)?.slice(0, 100) || 'Twitter Post',
                description: (t.text as string) || '',
                videoId: String(t.id_str || t.id || ''),
                publishedAt: (t.created_at as string) || '',
                link: `https://twitter.com/${username}/status/${t.id_str || t.id}`,
              }));
            }
          } catch {
            // Not JSON, try other formats
          }
        }
      } catch {
        // Archive URL may not be accessible
      }
    }

    await updateImportJob(env, job.id, { total: tweets.length });

    let imported = 0;
    for (const tweet of tweets) {
      try {
        const contentId = generateContentId(job.wallet);
        const record: ContentRecord = {
          id: contentId,
          creatorWallet: job.wallet,
          type: 'post',
          title: tweet.title,
          body: tweet.description,
          media: [],
          protocols: {},
          tags: ['twitter-import'],
          niches: [],
          license: 'all-rights',
          siblingUris: [],
          importSource: {
            platform: 'twitter',
            externalId: tweet.videoId,
            url: tweet.link || `https://twitter.com/${username}/status/${tweet.videoId}`,
            importedAt: Date.now(),
          },
          createdAt: tweet.publishedAt ? new Date(tweet.publishedAt).getTime() : Date.now(),
          updatedAt: Date.now(),
        };

        await storeContent(env, job.wallet, record);
        imported++;
        await updateImportJob(env, job.id, { imported });
      } catch {
        // skip
      }
    }

    await updateImportJob(env, job.id, { status: 'completed', completedAt: Date.now() });
  } catch (err) {
    await updateImportJob(env, job.id, {
      status: 'failed',
      errors: [err instanceof Error ? err.message : String(err)],
    });
  }
}

// ─── RSS Helpers ────────────────────────────────────────────────────────────

interface RssItem {
  title: string;
  description: string;
  videoId: string;
  publishedAt: string;
  link: string;
}

async function fetchRssItems(feedUrl: string, maxItems: number): Promise<RssItem[]> {
  const res = await fetch(feedUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) { const _throwErr = new Error(`RSS fetch failed: ${res.status}`); throw _throwErr; }

  const text = await res.text();

  // Simple XML parsing for RSS/Atom feeds
  const items: RssItem[] = [];
  const itemRegex = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
  let match: RegExpExecArray | null = itemRegex.exec(text);

  while (match !== null && items.length < maxItems) {
    const xml: string = match[1] || '';
    match = itemRegex.exec(text);

    const title: string = extractXmlField(xml, 'title') || '';
    const description: string =
      extractXmlField(xml, 'description') ||
      extractXmlField(xml, 'content:encoded') ||
      extractXmlField(xml, 'summary') ||
      '';
    const id: string = extractXmlField(xml, 'guid') || extractXmlField(xml, 'id') || '';
    const publishedAt: string =
      extractXmlField(xml, 'pubDate') ||
      extractXmlField(xml, 'published') ||
      extractXmlField(xml, 'updated') ||
      '';
    const link: string = extractXmlField(xml, 'link', true) || '';

    items.push({
      title: decodeHtmlEntities(title || 'Untitled'),
      description: decodeHtmlEntities(description || ''),
      videoId: id || `${Date.now()}-${items.length}`,
      publishedAt,
      link,
    });
  }

  return items;
}

function extractXmlField(xml: string, field: string, isLink = false): string {
  if (isLink) {
    const hrefMatch = new RegExp(`<${field}[^>]*href=["']([^"']*)["']`, 'i').exec(xml);
    if (hrefMatch?.[1]) return hrefMatch[1];
  }
  const match = new RegExp(`<${field}[^>]*>([\\s\\S]*?)<\\/${field}>`, 'i').exec(xml);
  return match?.[1] ? match[1].trim() : '';
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_m: string, code: string) => String.fromCharCode(parseInt(code, 10)));
}
