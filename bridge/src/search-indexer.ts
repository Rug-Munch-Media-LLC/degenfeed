/**
 * DegenFeed Unified Search Indexer
 *
 * Synchronizes ALL content from every protocol into Meilisearch for
 * unified cross-protocol search. Runs on startup and every 5 minutes.
 *
 * Content types indexed:
 *   - Social posts (Mastodon, Bluesky, Nostr, Farcaster, Lens)
 *   - News articles (RSS from 148+ sources, RSS-Bridge)
 *   - Community posts (Lemmy, Reddit)
 *   - Videos (PeerTube)
 *   - Photos (Pixelfed)
 *   - NFTs (Zora)
 *   - Newsletters (Substack, Medium, Mirror, Paragraph, Ghost, WordPress, Beehiiv)
 */

import type { UnifiedPost } from './server/types';

// ─── Configuration ─────────────────────────────────────────────────────

const MEILI_URL = process.env.MEILISEARCH_URL || 'http://127.0.0.1:7700';
const MEILI_KEY =
  process.env.MEILI_MASTER_KEY ||
  '01b9dbb2adc08f7aba179b30e0f215a76604180a4b736b0899204bf0f6f397fb';
const INDEX_NAME = 'posts';

const indexedIds = new Set<string>();
let isRunning = false;
let lastIndexTime = 0;
let indexCount = 0;
let indexErrors = 0;

// ─── Meilisearch Client ────────────────────────────────────────────────

let client: any;

// Lazy-init optional Meilisearch client
async function getClientAsync(): Promise<any> {
  if (client) return client;
  try {
    const { Meilisearch } = await import('meilisearch');
    client = new Meilisearch({
      host: MEILI_URL,
      apiKey: MEILI_KEY,
      timeout: 30000, // 30s timeout per request to prevent hung requests
    });
    console.log('[indexer] Meilisearch client created, host=' + MEILI_URL);
    return client;
  } catch (e) {
    console.error('[indexer] Failed to create Meilisearch client:', (e as Error).message);
    return null;
  }
}

// Synchronous fallback — returns null if client not yet initialized
function getClient(): any {
  return client;
}

// ─── Search Document Shape ─────────────────────────────────────────────

export interface SearchDocument {
  id: string;
  source: string;
  protocol: string;
  contentType: string;
  sourceLabel: string;
  text: string;
  html?: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  authorId: string;
  authorBio: string;
  createdAt: number;
  metrics: string;
  niches: string[];
  url: string;
  embeds: string;
  imageUrl: string;
  language: string;
  metadata: string;
}

// ─── Index Setup ───────────────────────────────────────────────────────

async function ensureIndex(): Promise<void> {
  const meili = await getClientAsync();
  if (!meili) return;

  try {
    const indexes = await meili.getRawIndexes();
    const exists = indexes.results?.some((i: { uid: string }) => i.uid === INDEX_NAME);

    if (!exists) {
      console.log('[indexer] Creating Meilisearch index:', INDEX_NAME);
      await meili.createIndex(INDEX_NAME, { primaryKey: 'id' });
    }

    await meili
      .index(INDEX_NAME)
      .updateFilterableAttributes(['source', 'protocol', 'contentType', 'niches', 'createdAt', 'authorId']);

    await meili.index(INDEX_NAME).updateSortableAttributes(['createdAt']);

    await meili
      .index(INDEX_NAME)
      .updateSearchableAttributes(['text', 'html', 'authorName', 'authorHandle', 'niches']);

    await meili
      .index(INDEX_NAME)
      .updateDisplayedAttributes([
        'id',
        'source',
        'protocol',
        'contentType',
        'sourceLabel',
        'text',
        'html',
        'authorName',
        'authorHandle',
        'authorAvatar',
        'authorId',
        'authorBio',
        'createdAt',
        'metrics',
        'niches',
        'url',
        'imageUrl',
        'language',
        'metadata',
      ]);

    await meili
      .index(INDEX_NAME)
      .updateRankingRules(['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness']);

    console.log('[indexer] Index configured successfully');
  } catch (err) {
    console.error('[indexer] Error configuring index:', err);
    throw err;
  }
}

// ─── Document Mapper ───────────────────────────────────────────────────

function sanitizeId(raw: string): string {
  // Meilisearch IDs: alphanumeric, hyphens, underscores, max 511 bytes
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 500);
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
    pixelfed: 'Pixelfed',
    zora: 'Zora NFT',
  };
  return labels[protocol] || protocol;
}

function postToDocument(post: UnifiedPost): SearchDocument {
  const authorHandle =
    post.author.handles?.[post.protocol] ||
    post.author.handles?.nostr ||
    post.author.handles?.farcaster ||
    post.author.handles?.bluesky ||
    post.author.handles?.mastodon ||
    post.author.primary?.id ||
    '';

  const url =
    post.embeds?.find((e) => e.kind === 'link')?.url ||
    ((post.raw as Record<string, unknown>)?.url as string) ||
    '';

  const imageUrl = post.embeds?.find((e) => e.kind === 'image')?.url || '';

  const contentType =
    post.contentType ||
    (post.protocol === 'peertube'
      ? 'video'
      : post.protocol === 'pixelfed'
        ? 'image'
        : post.protocol === 'zora'
          ? 'nft'
          : post.protocol === 'rss'
            ? 'article'
            : post.protocol === 'reddit' || post.protocol === 'lemmy'
              ? 'community'
              : 'post');

  return {
    id: sanitizeId(post.id),
    source: post.protocol,
    protocol: post.protocol,
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

async function fetchNewsletterDocuments(limit: number = 100): Promise<SearchDocument[]> {
  try {
    const mod = await import('./providers/rss');
    const fn = mod.fetchNewsletterPosts as (limit: number) => Promise<UnifiedPost[]>;
    if (typeof fn !== 'function') return [];
    const posts = await fn(limit);
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
    { name: 'pixelfed', module: './providers/pixelfed', fn: 'fetchPixelfedPosts', limit: 100 },
    { name: 'zora', module: './providers/zora', fn: 'fetchZoraPosts', limit: 100 },
  ];

  const results: SearchDocument[] = [];
  const errors: string[] = [];

  // Fetch all providers in parallel
  const promises = providers.map(async (p) => {
    try {
      let mod: Record<string, unknown>;
      try {
        mod = await import(p.module);
      } catch (importErr) {
        console.warn(`[indexer] ${p.name}: import failed — ${(importErr as Error).message}`);
        return [];
      }
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

  // Add newsletter fetcher
  promises.push(
    (async () => {
      try {
        const docs = await fetchNewsletterDocuments(100);
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

async function fullIndex(): Promise<{ count: number; errors: number }> {
  const meili = await getClientAsync();
  if (!meili) return { count: 0, errors: 1 };
  const start = Date.now();

  console.log('[indexer] Starting full index...');

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
      await meili.index(INDEX_NAME).addDocuments(batch, { primaryKey: 'id' });
      indexed += batch.length;

      for (const doc of batch) {
        indexedIds.add(doc.id);
      }
    } catch (err) {
      errors += batch.length;
      console.error(`[indexer] Batch index error (offset ${i}):`, (err as Error).message);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[indexer] Full index: ${indexed} documents in ${elapsed}s (${errors} errors)`);

  indexCount = indexed;
  indexErrors = errors;
  totalCycles++;
  lastCycleDuration = Date.now() - start;
  lastCycleNew = indexed;
  lastIndexTime = Date.now();

  return { count: indexed, errors };
}

async function incrementalIndex(): Promise<{ count: number; errors: number }> {
  const meili = await getClientAsync();
  if (!meili) return { count: 0, errors: 1 };
  const start = Date.now();

  console.log('[indexer] Starting incremental index...');

  const documents = await fetchAllProviderDocuments();

  const newDocs = documents.filter((doc) => !indexedIds.has(doc.id));

  if (newDocs.length === 0) {
    console.log('[indexer] No new documents to index');
    lastIndexTime = Date.now();
    return { count: 0, errors: 0 };
  }

  console.log(
    `[indexer] ${newDocs.length} new documents to index (${documents.length} total fetched)`,
  );

  const batchSize = 1000;
  let indexed = 0;
  let errors = 0;

  // Only index NEW documents (not all fetched)
  for (let i = 0; i < newDocs.length; i += batchSize) {
    const batch = newDocs.slice(i, i + batchSize);
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

  indexCount += indexed;
  indexErrors += errors;
  totalCycles++;
  lastCycleDuration = Date.now() - start;
  lastCycleNew = newDocs.length;
  lastIndexTime = Date.now();

  return { count: indexed, errors };
}

export async function indexPost(post: UnifiedPost): Promise<boolean> {
  try {
    const meili = await getClientAsync();
    if (!meili) return false;
    const doc = postToDocument(post);
    await meili.index(INDEX_NAME).addDocuments([doc], { primaryKey: 'id' });
    indexedIds.add(post.id);
    return true;
  } catch (err) {
    console.error('[indexer] Error indexing single post:', (err as Error).message);
    return false;
  }
}

export async function indexPosts(posts: UnifiedPost[]): Promise<number> {
  if (posts.length === 0) return 0;

  try {
    const meili = await getClientAsync();
    if (!meili) return 0;
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

// ─── Scheduler ─────────────────────────────────────────────────────────

let intervalHandle: ReturnType<typeof setInterval> | null = null;

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

  isRunning = true;
  try {
    await fullIndex();
  } catch (err) {
    console.error('[indexer] Initial index failed:', err);
  } finally {
    isRunning = false;
  }

  const INTERVAL_MS = 5 * 60 * 1000;
  intervalHandle = setInterval(async () => {
    if (isRunning) {
      console.log('[indexer] Previous index still running, skipping cycle');
      return;
    }

    isRunning = true;
    try {
      const result = await incrementalIndex();
      console.log(
        `[indexer] Cycle complete. ${result.count} new docs indexed. Next in ${INTERVAL_MS / 1000}s.`,
      );
    } catch (err) {
      console.error('[indexer] Incremental index failed:', err);
    } finally {
      isRunning = false;
    }
  }, INTERVAL_MS);

  console.log(`[indexer] Auto-indexer running every ${INTERVAL_MS / 1000}s`);
}

export function stopIndexer(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  console.log('[indexer] Stopped');
}

export async function reindex(): Promise<{ count: number; errors: number; elapsed: number }> {
  if (isRunning) {
    throw new Error('Indexer is already running');
  }

  isRunning = true;
  const start = Date.now();

  try {
    await ensureIndex();
    indexedIds.clear();

    // Clear all existing documents before reindexing so old fields (e.g.
    // missing `protocol`) don't persist across schema changes.
    const meili = await getClientAsync();
    if (meili) {
      await meili.index(INDEX_NAME).deleteAllDocuments();
    }

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
  totalCycles: number;
  lastCycleDuration: number;
  lastCycleNew: number;
  nextRunIn: number;
}

let totalCycles = 0;
let lastCycleDuration = 0;
let lastCycleNew = 0;

export function getIndexerStatus(): IndexerStatus {
  const nextAt = lastIndexTime > 0 ? lastIndexTime + 300_000 : 0;
  return {
    running: isRunning,
    initialized: lastIndexTime > 0,
    lastIndexTime,
    documentCount: indexCount,
    errorCount: indexErrors,
    indexedIds: indexedIds.size,
    totalCycles,
    lastCycleDuration,
    lastCycleNew,
    nextRunIn: nextAt > 0 ? Math.max(0, nextAt - Date.now()) : -1,
  };
}
