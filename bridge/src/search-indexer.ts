/**
 * DegenFeed Unified Search Indexer
 *
 * Synchronizes ALL content from every protocol into Meilisearch for
 * unified cross-protocol search. Runs on startup and every 5 minutes.
 *
 * Content types indexed:
 *   - Social posts (Mastodon, Bluesky, Nostr, Farcaster, Lens)
 *   - News articles (RSS from 148+ sources)
 *   - Community posts (Lemmy, Reddit)
 *   - Videos (PeerTube, YouTube)
 *   - Photos (Pixelfed)
 *   - NFTs (Zora)
 *   - Newsletters (Substack, Medium, Mirror, Paragraph, Ghost, WordPress, Beehiiv)
 *   - Live streams
 */

import { Meilisearch } from 'meilisearch';
import type { UnifiedPost } from './server/types';

// ─── Configuration ─────────────────────────────────────────────────────

const MEILI_URL = process.env.MEILISEARCH_URL || 'http://127.0.0.1:7700';
const MEILI_KEY = process.env.MEILI_MASTER_KEY || '01b9dbb2adc08f7aba179b30e0f215a76604180a4b736b0899204bf0f6f397fb';
const INDEX_NAME = 'posts';

// Track what we've indexed for incremental updates
const indexedIds = new Set<string>();
let isRunning = false;
let lastIndexTime = 0;
let indexCount = 0;
let indexErrors = 0;

// ─── Meilisearch Client ────────────────────────────────────────────────

let client: MeiliSearch;

function getClient(): MeiliSearch {
  if (!client) {
    client = new Meilisearch({
      host: MEILI_URL,
      apiKey: MEILI_KEY,
    });
  }
  return client;
}

// ─── Search Document Shape ─────────────────────────────────────────────

export interface SearchDocument {
  /** Unique ID (protocol:content-id) */
  id: string;
  /** Source protocol: mastodon, bluesky, nostr, farcaster, lens, rss, lemmy, reddit, peertube, youtube, pixelfed, zora, newsletter-substack, etc. */
  source: string;
  /** Content type: post, article, video, image, nft, newsletter, live */
  contentType: string;
  /** Display name for the source */
  sourceLabel: string;
  /** Main text content */
  text: string;
  /** HTML version (if available) */
  html?: string;
  /** Author display name */
  authorName: string;
  /** Author handle */
  authorHandle: string;
  /** Author avatar URL */
  authorAvatar: string;
  /** Author unique ID */
  authorId: string;
  /** Author bio */
  authorBio: string;
  /** Timestamp (ms epoch) */
  createdAt: number;
  /** Engagement metrics JSON string */
  metrics: string;
  /** Niches/tags */
  niches: string[];
  /** URL to original content */
  url: string;
  /** Embed info JSON string */
  embeds: string;
  /** Image URL for thumbnails */
  imageUrl: string;
  /** Language hint */
  language: string;
  /** Additional metadata JSON */
  metadata: string;
}

// ─── Index Setup ───────────────────────────────────────────────────────

async function ensureIndex(): Promise<void> {
  const meili = getClient();
  
  try {
    const indexes = await meili.getRawIndexes();
    const exists = indexes.results?.some((i: { uid: string }) => i.uid === INDEX_NAME);
    
    if (!exists) {
      console.log('[indexer] Creating Meilisearch index:', INDEX_NAME);
      await meili.createIndex(INDEX_NAME, { primaryKey: 'id' });
    }
    
    // Update filterable attributes (for sources/contentType filtering)
    await meili.index(INDEX_NAME).updateFilterableAttributes([
      'source',
      'contentType',
      'niches',
      'createdAt',
      'authorId',
    ]);
    
    // Update sortable attributes
    await meili.index(INDEX_NAME).updateSortableAttributes([
      'createdAt',
    ]);
    
    // Update searchable attributes
    await meili.index(INDEX_NAME).updateSearchableAttributes([
      'text',
      'html',
      'authorName',
      'authorHandle',
      'niches',
    ]);
    
    // Update displayed attributes
    await meili.index(INDEX_NAME).updateDisplayedAttributes([
      'id', 'source', 'contentType', 'sourceLabel',
      'text', 'html', 'authorName', 'authorHandle',
      'authorAvatar', 'authorId', 'authorBio',
      'createdAt', 'metrics', 'niches', 'url',
      'imageUrl', 'language', 'metadata',
    ]);
    
    // Ranking rules — Meilisearch defaults + niche boost
    await meili.index(INDEX_NAME).updateRankingRules([
      'words',
      'typo',
      'proximity',
      'attribute',
      'sort',
      'exactness',
    ]);
    
    console.log('[indexer] Index configured successfully');
  } catch (err) {
    console.error('[indexer] Error configuring index:', err);
    throw err;
  }
}

// ─── Document Mapper ───────────────────────────────────────────────────

function postToDocument(post: UnifiedPost): SearchDocument {
  const authorHandle = post.author.handles?.[post.protocol] 
    || post.author.handles?.nostr 
    || post.author.handles?.farcaster
    || post.author.handles?.bluesky
    || post.author.handles?.mastodon
    || post.author.primary?.id 
    || '';
  
  const url = post.embeds?.find(e => e.kind === 'link')?.url 
    || (post.raw as Record<string, unknown>)?.url as string
    || '';
    
  const imageUrl = post.embeds?.find(e => e.kind === 'image')?.url || '';
  
  const contentType = post.contentType || 
    (post.protocol === 'youtube' || post.protocol === 'peertube' ? 'video' :
     post.protocol === 'pixelfed' ? 'image' :
     post.protocol === 'zora' ? 'nft' :
     post.protocol.startsWith('newsletter-') ? 'newsletter' :
     post.protocol === 'rss' ? 'article' :
     post.protocol === 'reddit' || post.protocol === 'lemmy' ? 'community' :
     'post');

  return {
    id: post.id,
    source: post.protocol,
    contentType,
    sourceLabel: getSourceLabel(post.protocol),
    text: post.text,
    html: post.html || '',
    authorName: post.author.displayName,
    authorHandle,
    authorAvatar: post.author.avatarUrl || '',
    authorId: post.author.id,
    authorBio: post.author.bio || '',
    createdAt: post.createdAt,
    metrics: JSON.stringify(post.metrics),
    niches: post.niches || [],
    url,
    embeds: JSON.stringify(post.embeds || []),
    imageUrl,
    language: 'en',
    metadata: JSON.stringify({
      sourceProtocol: post.protocol,
      primaryProtocol: post.author.primary?.protocol,
      hasEmbeds: (post.embeds?.length || 0) > 0,
      followerCount: post.author.followerCount,
    }),
  };
}

function getSourceLabel(protocol: string): string {
  const labels: Record<string, string> = {
    mastodon: 'Mastodon/GTS',
    bluesky: 'Bluesky',
    nostr: 'Nostr',
    farcaster: 'Farcaster',
    lens: 'Lens',
    rss: 'RSS News',
    lemmy: 'Lemmy',
    reddit: 'Reddit',
    peertube: 'PeerTube',
    youtube: 'YouTube',
    pixelfed: 'Pixelfed',
    zora: 'Zora NFT',
    live: 'Live Stream',
  };
  
  if (protocol.startsWith('newsletter-')) {
    const platform = protocol.replace('newsletter-', '');
    return `Newsletter/${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
  }
  
  return labels[protocol] || protocol;
}

// ─── Provider Fetching ─────────────────────────────────────────────────

async function fetchAllFromProvider(
  providerName: string,
  fetchFn: (limit: number) => Promise<UnifiedPost[]>,
  limit: number = 500,
): Promise<SearchDocument[]> {
  try {
    const posts = await fetchFn(limit);
    return posts.map(postToDocument);
  } catch (err) {
    console.warn(`[indexer] ${providerName}: fetch error:`, (err as Error).message);
    return [];
  }
}

async function fetchNewsletterDocuments(limit: number = 200): Promise<SearchDocument[]> {
  try {
    const { fetchNewsletterPosts, newsletterToUnifiedPost, fetchAllNewsletters } = await import('./providers/newsletter');
    const articles = await fetchAllNewsletters(limit);
    const posts = articles.map(newsletterToUnifiedPost);
    return posts.map(postToDocument);
  } catch (err) {
    console.warn('[indexer] Newsletter fetch error:', (err as Error).message);
    return [];
  }
}

async function fetchAllProviderDocuments(): Promise<SearchDocument[]> {
  const providers: Array<{ name: string; module: string; fn: string; limit?: number }> = [
    { name: 'mastodon', module: './providers/gotosocial', fn: 'fetchMastodonPosts', limit: 200 },
    { name: 'bluesky', module: './providers/bluesky', fn: 'fetchBlueskyPosts', limit: 200 },
    { name: 'nostr', module: './providers/nostr', fn: 'fetchNostrPosts', limit: 200 },
    { name: 'farcaster', module: './providers/farcaster', fn: 'fetchFarcasterPosts', limit: 200 },
    { name: 'lens', module: './providers/lens', fn: 'fetchLensPosts', limit: 200 },
    { name: 'rss', module: './providers/rssbridge', fn: 'fetchRssBridgePosts', limit: 100 },
    { name: 'lemmy', module: './providers/lemmy', fn: 'fetchLemmyPosts', limit: 200 },
    { name: 'reddit', module: './providers/redlib', fn: 'fetchRedditPosts', limit: 200 },
    { name: 'peertube', module: './providers/peertube', fn: 'fetchPeerTubePosts', limit: 100 },
    { name: 'youtube', module: './providers/youtube', fn: 'fetchYouTubeProviderPosts', limit: 100 },
    { name: 'pixelfed', module: './providers/pixelfed', fn: 'fetchPixelfedPosts', limit: 100 },
    { name: 'zora', module: './providers/zora', fn: 'fetchZoraPosts', limit: 100 },
  ];

  const results: SearchDocument[] = [];
  const errors: string[] = [];

  // Fetch all providers in parallel
  const promises = providers.map(async (p) => {
    try {
      const mod = await import(p.module);
      const fn = mod[p.fn] as (limit: number) => Promise<UnifiedPost[]>;
      if (typeof fn !== 'function') {
        console.warn(`[indexer] ${p.name}: ${p.fn} is not a function`);
        return [];
      }
      const docs = await fetchAllFromProvider(p.name, fn, p.limit);
      console.log(`[indexer] ${p.name}: ${docs.length} documents`);
      return docs;
    } catch (err) {
      const msg = (err as Error).message;
      errors.push(`${p.name}: ${msg}`);
      console.warn(`[indexer] ${p.name}: cannot load — ${msg}`);
      return [];
    }
  });

  // Add newsletter
  promises.push(
    (async () => {
      try {
        const docs = await fetchNewsletterDocuments(200);
        console.log(`[indexer] newsletters: ${docs.length} documents`);
        return docs;
      } catch (err) {
        errors.push(`newsletter: ${(err as Error).message}`);
        return [];
      }
    })(),
  );

  const settled = await Promise.allSettled(promises);
  for (const r of settled) {
    if (r.status === 'fulfilled') {
      results.push(...r.value);
    }
  }

  if (errors.length > 0) {
    console.warn(`[indexer] ${errors.length} provider(s) had errors:`, errors.join('; '));
  }

  return results;
}

// ─── Indexing ──────────────────────────────────────────────────────────

/**
 * Full re-index: fetch all content from all providers and index to Meilisearch.
 */
async function fullIndex(): Promise<{ count: number; errors: number }> {
  const meili = getClient();
  const start = Date.now();
  
  console.log('[indexer] Starting full index...');
  
  // Fetch all documents from all providers
  const documents = await fetchAllProviderDocuments();
  
  if (documents.length === 0) {
    console.warn('[indexer] No documents fetched from any provider');
    return { count: 0, errors: 0 };
  }
  
  // Batch index to Meilisearch (batches of 1000)
  const batchSize = 1000;
  let indexed = 0;
  let errors = 0;
  
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    try {
      const result = await meili.index(INDEX_NAME).addDocuments(batch, { primaryKey: 'id' });
      indexed += batch.length;
      
      // Track IDs for incremental updates
      for (const doc of batch) {
        indexedIds.add(doc.id);
      }
      
      if (result.taskUid) {
        // Wait for task to complete
        await waitForTask(result.taskUid);
      }
    } catch (err) {
      errors += batch.length;
      console.error(`[indexer] Batch index error (offset ${i}):`, (err as Error).message);
    }
  }
  
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[indexer] Indexed ${indexed} documents in ${elapsed}s (${errors} errors)`);
  
  indexCount = indexed;
  indexErrors = errors;
  lastIndexTime = Date.now();
  
  return { count: indexed, errors };
}

/**
 * Incremental update: only fetch new content and index it.
 * Deduplicates by checking indexedIds set.
 */
async function incrementalIndex(): Promise<{ count: number; errors: number }> {
  const meili = getClient();
  const start = Date.now();
  
  console.log('[indexer] Starting incremental index...');
  
  const documents = await fetchAllProviderDocuments();
  
  // Filter to only new documents (not previously indexed)
  const newDocs = documents.filter(doc => !indexedIds.has(doc.id));
  
  if (newDocs.length === 0) {
    console.log('[indexer] No new documents to index');
    return { count: 0, errors: 0 };
  }
  
  console.log(`[indexer] ${newDocs.length} new documents to index (${documents.length} total fetched)`);
  
  // Also update existing docs (re-index for freshness)
  // We send all docs but Meilisearch handles upsert by primary key
  const batchSize = 1000;
  let indexed = 0;
  let errors = 0;
  
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    try {
      await meili.index(INDEX_NAME).addDocuments(batch, { primaryKey: 'id' });
      indexed += batch.length;
      
      for (const doc of batch) {
        indexedIds.add(doc.id);
      }
    } catch (err) {
      errors += batch.length;
      console.error(`[indexer] Incremental batch error (offset ${i}):`, (err as Error).message);
    }
  }
  
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[indexer] Incremental index: ${indexed} docs in ${elapsed}s`);
  
  indexCount = indexed;
  indexErrors = errors;
  lastIndexTime = Date.now();
  
  return { count: indexed, errors };
}

/**
 * Index a single post (for real-time indexing when new content arrives).
 */
export async function indexPost(post: UnifiedPost): Promise<boolean> {
  try {
    const meili = getClient();
    const doc = postToDocument(post);
    await meili.index(INDEX_NAME).addDocuments([doc], { primaryKey: 'id' });
    indexedIds.add(post.id);
    return true;
  } catch (err) {
    console.error('[indexer] Error indexing single post:', (err as Error).message);
    return false;
  }
}

/**
 * Index multiple posts at once (batch).
 */
export async function indexPosts(posts: UnifiedPost[]): Promise<number> {
  if (posts.length === 0) return 0;
  
  try {
    const meili = getClient();
    const docs = posts.map(postToDocument);
    await meili.index(INDEX_NAME).addDocuments(docs, { primaryKey: 'id' });
    
    for (const doc of docs) {
      indexedIds.add(doc.id);
    }
    
    return docs.length;
  } catch (err) {
    console.error('[indexer] Error indexing batch posts:', (err as Error).message);
    return 0;
  }
}

// ─── Task Waiter ───────────────────────────────────────────────────────

async function waitForTask(taskUid: number, timeoutMs: number = 30000): Promise<void> {
  const meili = getClient();
  const start = Date.now();
  
  while (Date.now() - start < timeoutMs) {
    try {
      const task = await meili.getTask(taskUid);
      if (task.status === 'succeeded') return;
      if (task.status === 'failed') {
        console.error(`[indexer] Task ${taskUid} failed:`, task.error);
        return;
      }
      // still processing
      await new Promise(r => setTimeout(r, 200));
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  
  console.warn(`[indexer] Task ${taskUid} timed out after ${timeoutMs}ms`);
}

// ─── Scheduler ─────────────────────────────────────────────────────────

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the auto-indexer. Runs immediately on startup, then every 5 minutes.
 */
export async function startIndexer(): Promise<void> {
  if (isRunning) {
    console.log('[indexer] Already running, skipping start');
    return;
  }
  
  console.log('[indexer] Starting indexer...');
  
  try {
    await ensureIndex();
  } catch (err) {
    console.error('[indexer] Failed to configure index:', err);
    return;
  }
  
  // Run initial full index
  isRunning = true;
  try {
    await fullIndex();
  } catch (err) {
    console.error('[indexer] Initial index failed:', err);
  } finally {
    isRunning = false;
  }
  
  // Schedule incremental index every 5 minutes
  const INTERVAL_MS = 5 * 60 * 1000;
  intervalHandle = setInterval(async () => {
    if (isRunning) {
      console.log('[indexer] Previous index still running, skipping');
      return;
    }
    
    isRunning = true;
    try {
      await incrementalIndex();
    } catch (err) {
      console.error('[indexer] Incremental index failed:', err);
    } finally {
      isRunning = false;
    }
  }, INTERVAL_MS);
  
  console.log(`[indexer] Auto-indexer running every ${INTERVAL_MS / 1000}s`);
}

/**
 * Stop the auto-indexer.
 */
export function stopIndexer(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  console.log('[indexer] Stopped');
}

/**
 * Trigger a manual full re-index.
 */
export async function reindex(): Promise<{ count: number; errors: number; elapsed: number }> {
  if (isRunning) {
    throw new Error('Indexer is already running');
  }
  
  isRunning = true;
  const start = Date.now();
  
  try {
    await ensureIndex();
    indexedIds.clear();
    const result = await fullIndex();
    return { ...result, elapsed: Date.now() - start };
  } finally {
    isRunning = false;
  }
}

// ─── Status ────────────────────────────────────────────────────────────

export interface IndexerStatus {
  running: boolean;
  initialized: boolean;
  lastIndexTime: number;
  documentCount: number;
  errorCount: number;
  indexedIds: number;
}

export function getIndexerStatus(): IndexerStatus {
  return {
    running: isRunning,
    initialized: lastIndexTime > 0,
    lastIndexTime,
    documentCount: indexCount,
    errorCount: indexErrors,
    indexedIds: indexedIds.size,
  };
}

export { isRunning, lastIndexTime, indexCount, indexErrors };
