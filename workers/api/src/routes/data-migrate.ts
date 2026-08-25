/**
 * @degenfeed/api-worker — Cross-Platform Data Migration
 *
 * Import from Twitter/X, Mastodon, Nostr, Bluesky, Farcaster.
 * Export to Mastodon, Nostr, Bluesky.
 *
 * Routes:
 *   POST /api/account/migrate/import/twitter    — Import from Twitter/X archive
 *   POST /api/account/migrate/import/mastodon   — Import from Mastodon CSV/JSON
 *   POST /api/account/migrate/import/nostr      — Import Nostr events
 *   POST /api/account/migrate/import/bluesky    — Import Bluesky AT Protocol data
 *   POST /api/account/migrate/import/farcaster  — Import Farcaster casts
 *   POST /api/account/migrate/export/mastodon   — Export to Mastodon
 *   POST /api/account/migrate/export/nostr      — Publish to Nostr relays
 *   POST /api/account/migrate/export/bluesky    — Push to Bluesky PDS
 *   GET  /api/account/migrate/status            — Check migration status
 *   GET  /api/account/migrate/jobs              — List recent migrations
 *
 * All endpoints require a valid session cookie.
 * Imports store data into the user's content library.
 * Exports publish to the target protocol.
 */

import { log } from '../index';
import { badRequest, conflict, ok, serverError } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────

export type MigrationDirection = 'import' | 'export';
export type MigrationPlatform = 'twitter' | 'mastodon' | 'nostr' | 'bluesky' | 'farcaster';

export interface MigrationJob {
  id: string;
  wallet: string;
  direction: MigrationDirection;
  platform: MigrationPlatform;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0–100
  totalItems: number;
  processedItems: number;
  errors: string[];
  startedAt: number;
  completedAt?: number;
  error?: string;
}

// ─── KV Key Helpers ───────────────────────────────────────────

function migrationKey(wallet: string, jobId: string): string {
  return `migration:${wallet.toLowerCase()}:${jobId}`;
}

function migrationIndexKey(wallet: string): string {
  return `migration:idx:${wallet.toLowerCase()}`;
}

function migrationLockKey(wallet: string, platform: string): string {
  return `migration:lock:${wallet.toLowerCase()}:${platform}`;
}

// ─── Helpers ──────────────────────────────────────────────────

export function generateJobId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

export async function storeJob(env: Env, job: MigrationJob): Promise<void> {
  const store = env.CACHE;
  if (!store) return;
  try {
    await store.put(migrationKey(job.wallet, job.id), JSON.stringify(job), {
      expirationTtl: 7 * 86400, // 7 days
    });
    // Update index
    const idxRaw = await store.get(migrationIndexKey(job.wallet));
    const idx: string[] = idxRaw ? JSON.parse(idxRaw) : [];
    idx.unshift(job.id);
    await store.put(migrationIndexKey(job.wallet), JSON.stringify(idx.slice(0, 50)), {
      expirationTtl: 7 * 86400,
    });
  } catch {
    /* non-critical */
  }
}

async function getJob(env: Env, wallet: string, jobId: string): Promise<MigrationJob | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(migrationKey(wallet, jobId));
    return raw ? (JSON.parse(raw) as MigrationJob) : null;
  } catch {
    return null;
  }
}

export async function listJobs(env: Env, wallet: string): Promise<MigrationJob[]> {
  if (!env.CACHE) return [];
  try {
    const idxRaw = await env.CACHE.get(migrationIndexKey(wallet));
    if (!idxRaw) return [];
    const idx: string[] = JSON.parse(idxRaw);
    const jobs: MigrationJob[] = [];
    for (const id of idx.slice(0, 20)) {
      const job = await getJob(env, wallet, id);
      if (job) jobs.push(job);
    }
    return jobs;
  } catch {
    return [];
  }
}

async function acquireLock(env: Env, wallet: string, platform: string): Promise<boolean> {
  if (!env.CACHE) return true;
  try {
    const existing = await env.CACHE.get(migrationLockKey(wallet, platform));
    if (existing) return false;
    await env.CACHE.put(migrationLockKey(wallet, platform), '1', { expirationTtl: 300 }); // 5 min lock
    return true;
  } catch {
    return true;
  }
}

async function releaseLock(env: Env, wallet: string, platform: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.delete(migrationLockKey(wallet, platform));
  } catch {
    /* ignore */
  }
}

// ─── Import Handlers ──────────────────────────────────────────

/**
 * POST /api/account/migrate/import/twitter
 * Import from Twitter/X archive (JSON data exported from Twitter).
 * Accepts: JSON body with tweet_id, tweet fields — or a full archive export.
 */
export async function handleImportTwitter(request: Request, env: Env): Promise<Response> {
  return handleGenericImport(request, env, 'twitter', async (body, walletLower) => {
    const data = body as {
      tweets?: Array<{
        id?: string;
        tweet_id?: string;
        full_text?: string;
        text?: string;
        created_at?: string;
        entities?: {
          hashtags?: Array<{ text: string }>;
          urls?: Array<{ url: string; expanded_url?: string }>;
        };
        extended_entities?: { media?: Array<{ media_url_https?: string; type?: string }> };
      }>;
      archive?: Array<Record<string, unknown>>;
    };

    const tweets = data.tweets || data.archive || [];
    const imported: string[] = [];
    const errors: string[] = [];

    const store = env.CONTENT_LIBRARY || env.CACHE;
    if (!store) return { imported, errors, total: tweets.length };

    for (const tweetRaw of tweets.slice(0, 500)) {
      try {
        const tweet = tweetRaw as Record<string, unknown>;
        const tweetId =
          (tweet.id as string) ||
          (tweet.tweet_id as string) ||
          `twitter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const text = (tweet.full_text as string) || (tweet.text as string) || '';
        if (!text) continue;

        const createdAt = tweet.created_at
          ? new Date(tweet.created_at as string).getTime()
          : Date.now();
        const entities = tweet.entities as Record<string, unknown> | undefined;
        const hashtags =
          (entities?.hashtags as Array<{ text: string }> | undefined)?.map((h) => h.text) || [];
        const extEntities = tweet.extended_entities as Record<string, unknown> | undefined;
        const mediaUrls =
          (extEntities?.media as Array<{ media_url_https?: string }> | undefined)
            ?.map((m) => m.media_url_https)
            .filter(Boolean) || [];

        const contentId = `import-tw-${tweetId}`;
        const record = {
          id: contentId,
          creatorWallet: walletLower,
          type: 'post',
          body: text,
          media: mediaUrls
            .filter((u): u is string => !!u)
            .map((url) => ({
              url,
              mimeType: 'image/jpeg',
              alt: '',
            })),
          protocols: {},
          tags: hashtags,
          niches: [],
          license: 'all-rights',
          siblingUris: [],
          importSource: {
            platform: 'twitter',
            externalId: tweetId,
            url: `https://twitter.com/i/web/status/${tweetId}`,
            importedAt: Date.now(),
          },
          createdAt,
          updatedAt: Date.now(),
        };

        await store.put(`cl:${walletLower}:${contentId}`, JSON.stringify(record));
        imported.push(contentId);
      } catch (e) {
        errors.push(
          `tweet ${(tweetRaw as Record<string, unknown>).id || (tweetRaw as Record<string, unknown>).tweet_id || 'unknown'}: ${(e as Error).message}`,
        );
      }
    }

    return { imported, errors, total: tweets.length };
  });
}

/**
 * POST /api/account/migrate/import/mastodon
 * Import from Mastodon archive (outbox.json or CSV).
 */
export async function handleImportMastodon(request: Request, env: Env): Promise<Response> {
  return handleGenericImport(request, env, 'mastodon', async (body, walletLower) => {
    const outbox = body as {
      type?: string;
      orderedItems?: Array<Record<string, unknown>>;
      items?: Array<Record<string, unknown>>;
      statuses?: Array<Record<string, unknown>>;
    };

    const items = outbox.orderedItems || outbox.items || outbox.statuses || [body];
    const imported: string[] = [];
    const errors: string[] = [];

    const store = env.CONTENT_LIBRARY || env.CACHE;
    if (!store) return { imported, errors, total: items.length };

    for (const item of items.slice(0, 500)) {
      try {
        const object = (item.object as Record<string, unknown>) || item;
        const content = String(object.content || '') || String(item.content || '');
        if (!content || content === 'undefined') continue;

        const id = String(
          object.id ||
            item.id ||
            `mastodon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        );
        const createdAt = object.published
          ? new Date(String(object.published)).getTime()
          : item.created_at
            ? new Date(String(item.created_at)).getTime()
            : Date.now();

        // Strip HTML from Mastodon content
        const plainText = content.replace(/<[^>]*>/g, '').trim();

        const contentId = `import-md-${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`;

        const record = {
          id: contentId,
          creatorWallet: walletLower,
          type: 'post',
          body: plainText,
          media: [],
          protocols: {},
          tags: [],
          niches: [],
          license: 'all-rights',
          siblingUris: [],
          importSource: {
            platform: 'mastodon',
            externalId: id,
            url: String(object.url || ''),
            importedAt: Date.now(),
          },
          createdAt,
          updatedAt: Date.now(),
        };

        await store.put(`cl:${walletLower}:${contentId}`, JSON.stringify(record));
        imported.push(contentId);
      } catch (e) {
        errors.push(`item: ${(e as Error).message}`);
      }
    }

    return { imported, errors, total: items.length };
  });
}

/**
 * POST /api/account/migrate/import/nostr
 * Import Nostr events (kind 1 notes).
 */
export async function handleImportNostr(request: Request, env: Env): Promise<Response> {
  return handleGenericImport(request, env, 'nostr', async (body, walletLower) => {
    const events = Array.isArray(body)
      ? body
      : (body as { events?: Array<Record<string, unknown>> }).events || [];
    const imported: string[] = [];
    const errors: string[] = [];

    const store = env.CONTENT_LIBRARY || env.CACHE;
    if (!store) return { imported, errors, total: events.length };

    for (const event of events.slice(0, 500)) {
      try {
        const ev = event as {
          id?: string;
          content?: string;
          created_at?: number;
          tags?: string[][];
          kind?: number;
        };
        // Only import kind 1 (text note) events
        if (ev.kind !== undefined && ev.kind !== 1) continue;
        if (!ev.content) continue;

        const contentId = `import-ns-${ev.id || `nostr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`}`;
        const tags = (ev.tags || [])
          .filter((t: string[]) => t[0] === 't' && t[1])
          .map((t: string[]) => t[1]);

        const record = {
          id: contentId,
          creatorWallet: walletLower,
          type: 'post',
          body: ev.content,
          media: [],
          protocols: {},
          tags,
          niches: [],
          license: 'all-rights',
          siblingUris: [],
          importSource: {
            platform: 'nostr',
            externalId: ev.id || '',
            url: ev.id ? `nostr:${ev.id}` : '',
            importedAt: Date.now(),
          },
          createdAt: (ev.created_at || Math.floor(Date.now() / 1000)) * 1000,
          updatedAt: Date.now(),
        };

        await store.put(`cl:${walletLower}:${contentId}`, JSON.stringify(record));
        imported.push(contentId);
      } catch (e) {
        errors.push(`event: ${(e as Error).message}`);
      }
    }

    return { imported, errors, total: events.length };
  });
}

/**
 * POST /api/account/migrate/import/bluesky
 * Import Bluesky/AT Protocol posts.
 */
export async function handleImportBluesky(request: Request, env: Env): Promise<Response> {
  return handleGenericImport(request, env, 'bluesky', async (body, walletLower) => {
    const atData = body as {
      posts?: Array<{
        uri?: string;
        cid?: string;
        record?: { text?: string; createdAt?: string };
        indexedAt?: string;
      }>;
      repo?: Array<Record<string, unknown>>;
    };

    const posts = atData.posts || atData.repo || [];
    const imported: string[] = [];
    const errors: string[] = [];

    const store = env.CONTENT_LIBRARY || env.CACHE;
    if (!store) return { imported, errors, total: posts.length };

    for (const post of posts.slice(0, 500)) {
      try {
        const p = post as {
          uri?: string;
          cid?: string;
          record?: { text?: string; createdAt?: string; embed?: Record<string, unknown> };
          text?: string;
          createdAt?: string;
        };
        const text = p.record?.text || p.text || '';
        if (!text) continue;

        const contentId = `import-bs-${p.cid || p.uri?.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) || `bsky-${Date.now()}`}`;

        const record = {
          id: contentId,
          creatorWallet: walletLower,
          type: 'post',
          body: text,
          media: [],
          protocols: {},
          tags: [],
          niches: [],
          license: 'all-rights',
          siblingUris: [],
          importSource: {
            platform: 'bluesky',
            externalId: p.cid || p.uri || '',
            url: p.uri || '',
            importedAt: Date.now(),
          },
          createdAt: new Date(p.record?.createdAt || p.createdAt || Date.now()).getTime(),
          updatedAt: Date.now(),
        };

        await store.put(`cl:${walletLower}:${contentId}`, JSON.stringify(record));
        imported.push(contentId);
      } catch (e) {
        errors.push(`post: ${(e as Error).message}`);
      }
    }

    return { imported, errors, total: posts.length };
  });
}

/**
 * POST /api/account/migrate/import/farcaster
 * Import Farcaster casts.
 */
export async function handleImportFarcaster(request: Request, env: Env): Promise<Response> {
  return handleGenericImport(request, env, 'farcaster', async (body, walletLower) => {
    const casts = Array.isArray(body)
      ? body
      : (body as { casts?: Array<Record<string, unknown>> }).casts || [];
    const imported: string[] = [];
    const errors: string[] = [];

    const store = env.CONTENT_LIBRARY || env.CACHE;
    if (!store) return { imported, errors, total: casts.length };

    for (const cast of casts.slice(0, 500)) {
      try {
        const c = cast as {
          hash?: string;
          text?: string;
          cast?: { text?: string; hash?: string };
          timestamp?: number;
          createdAt?: number;
        };
        const text = c.text || c.cast?.text || '';
        if (!text) continue;

        const hash =
          c.hash || c.cast?.hash || `fc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const ts = c.timestamp || c.createdAt || Date.now();

        const contentId = `import-fc-${hash.slice(0, 16)}`;

        const record = {
          id: contentId,
          creatorWallet: walletLower,
          type: 'post',
          body: text,
          media: [],
          protocols: {},
          tags: [],
          niches: [],
          license: 'all-rights',
          siblingUris: [],
          importSource: {
            platform: 'farcaster',
            externalId: hash,
            url: `https://warpcast.com/0x/${hash}`,
            importedAt: Date.now(),
          },
          createdAt: typeof ts === 'number' ? ts : new Date(ts).getTime(),
          updatedAt: Date.now(),
        };

        await store.put(`cl:${walletLower}:${contentId}`, JSON.stringify(record));
        imported.push(contentId);
      } catch (e) {
        errors.push(`cast: ${(e as Error).message}`);
      }
    }

    return { imported, errors, total: casts.length };
  });
}

// ─── Generic Import Handler ───────────────────────────────────

type ImportProcessor = (
  body: Record<string, unknown>,
  walletLower: string,
) => Promise<{
  imported: string[];
  errors: string[];
  total: number;
}>;

async function handleGenericImport(
  request: Request,
  env: Env,
  platform: MigrationPlatform,
  processor: ImportProcessor,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletLower = session.address.toLowerCase();
  const jobId = generateJobId();

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('Invalid JSON body. See /docs/migration for format requirements.');
  }

  // Check for concurrent migration on same platform
  const locked = await acquireLock(env, walletLower, platform);
  if (!locked) {
    return conflict(
      `A migration from ${platform} is already in progress. Wait for it to complete.`,
    );
  }

  const job: MigrationJob = {
    id: jobId,
    wallet: session.address,
    direction: 'import',
    platform,
    status: 'processing',
    progress: 0,
    totalItems: 0,
    processedItems: 0,
    errors: [],
    startedAt: Date.now(),
  };

  await storeJob(env, job);

  try {
    const result = await processor(body, walletLower);

    job.status = result.errors.length > 0 && result.imported.length === 0 ? 'failed' : 'completed';
    job.progress = 100;
    job.totalItems = result.total;
    job.processedItems = result.imported.length;
    job.errors = result.errors.slice(0, 20);
    job.completedAt = Date.now();

    await storeJob(env, job);

    log('info', `Import from ${platform} completed`, {
      wallet: walletLower,
      jobId,
      imported: result.imported.length,
      errors: result.errors.length,
      total: result.total,
    });

    return ok({
      jobId,
      platform,
      direction: 'import',
      status: job.status,
      imported: result.imported.length,
      total: result.total,
      errors: result.errors.length > 0 ? result.errors : undefined,
      error: job.error,
    });
  } catch (err) {
    job.status = 'failed';
    job.error = (err as Error).message;
    job.completedAt = Date.now();
    await storeJob(env, job);

    log('error', 'migration failed', { route: 'handleImport', platform, error: String(err) });
    return serverError();
  } finally {
    await releaseLock(env, walletLower, platform);
  }
}

// ─── Export Handlers ──────────────────────────────────────────

/**
 * POST /api/account/migrate/export/mastodon
 * Export user content to a Mastodon/GoToSocial instance.
 * Requires connected Mastodon account with API access.
 */
export async function handleExportToMastodon(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletLower = session.address.toLowerCase();

  let body: {
    instanceUrl?: string;
    accessToken?: string;
    contentIds?: string[]; // empty = all content
    includeMedia?: boolean;
  };
  try {
    body = (await request.json()) as {
      instanceUrl?: string;
      accessToken?: string;
      contentIds?: string[];
      includeMedia?: boolean;
    };
  } catch {
    return badRequest('Invalid JSON body. Required: instanceUrl, accessToken');
  }

  if (!body.instanceUrl || !body.accessToken) {
    return badRequest('instanceUrl and accessToken are required for Mastodon export.');
  }

  const jobId = generateJobId();
  const job: MigrationJob = {
    id: jobId,
    wallet: session.address,
    direction: 'export',
    platform: 'mastodon',
    status: 'processing',
    progress: 0,
    totalItems: 0,
    processedItems: 0,
    errors: [],
    startedAt: Date.now(),
  };

  await storeJob(env, job);

  try {
    // Gather content to export
    const store = env.CONTENT_LIBRARY || env.CACHE;
    let contentIds = body.contentIds;

    if (!contentIds || contentIds.length === 0) {
      // Get all content from library
      const indexRaw = store ? await store.get(`cl:idx:${walletLower}`) : null;
      const index: Array<{ id: string }> = indexRaw ? JSON.parse(indexRaw) : [];
      contentIds = index.slice(0, 100).map((e) => e.id);
    }

    job.totalItems = contentIds.length;
    const errors: string[] = [];
    let published = 0;
    const instanceUrl = body.instanceUrl.replace(/\/$/, '');
    const includeMedia = body.includeMedia !== false;

    for (const contentId of contentIds) {
      try {
        const raw = store ? await store.get(`cl:${walletLower}:${contentId}`) : null;
        if (!raw) continue;

        const record = JSON.parse(raw) as {
          body?: string;
          type?: string;
          media?: Array<{ url: string }>;
        };
        const statusBody: Record<string, unknown> = {
          status: record.body || '',
          visibility: 'public',
        };

        if (includeMedia && record.media && record.media.length > 0) {
          // Mastodon requires media to be uploaded first via POST /api/v1/media
          // For simplicity, we attach as text links
          const mediaLinks = record.media.map((m: { url: string }) => m.url).join('\n');
          statusBody.status = `${record.body}\n\n${mediaLinks}`;
        }

        const res = await fetch(`${instanceUrl}/api/v1/statuses`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${body.accessToken}`,
          },
          body: JSON.stringify(statusBody),
        });

        if (res.ok) {
          published++;
        } else {
          const errText = await res.text().catch(() => 'unknown error');
          errors.push(`Failed to publish ${contentId}: ${res.status} ${errText}`);
        }
      } catch (e) {
        errors.push(`${contentId}: ${(e as Error).message}`);
      }

      job.processedItems = published;
      job.progress = Math.round((job.processedItems / job.totalItems) * 100);
      await storeJob(env, job);
    }

    job.status = errors.length > 0 && published === 0 ? 'failed' : 'completed';
    job.progress = 100;
    job.errors = errors.slice(0, 20);
    job.completedAt = Date.now();
    await storeJob(env, job);

    return ok({
      jobId,
      platform: 'mastodon',
      direction: 'export',
      status: job.status,
      published,
      total: contentIds.length,
      instanceUrl,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (err) {
    job.status = 'failed';
    job.error = (err as Error).message;
    job.completedAt = Date.now();
    await storeJob(env, job);
    log('error', 'migration failed', { route: 'handleExportToMastodon', error: String(err) });
    return serverError();
  }
}

/**
 * POST /api/account/migrate/export/nostr
 * Publish user content to Nostr relays.
 */
export async function handleExportToNostr(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletLower = session.address.toLowerCase();

  let body: {
    relays?: string[];
    contentIds?: string[];
    nsec?: string;
  };
  try {
    body = (await request.json()) as { relays?: string[]; contentIds?: string[]; nsec?: string };
  } catch {
    return badRequest('Invalid JSON body.');
  }

  if (!body.nsec && !env.NOSTR_PRIVATE_KEY) {
    return badRequest(
      'Nostr private key (nsec) is required. Provide in body or configure NOSTR_PRIVATE_KEY.',
    );
  }

  const relays =
    body.relays || (env.RELAY_URLS || 'wss://relay.damus.io').split(',').map((r) => r.trim());

  const jobId = generateJobId();
  const job: MigrationJob = {
    id: jobId,
    wallet: session.address,
    direction: 'export',
    platform: 'nostr',
    status: 'processing',
    progress: 0,
    totalItems: 0,
    processedItems: 0,
    errors: [],
    startedAt: Date.now(),
  };

  await storeJob(env, job);

  try {
    const store = env.CONTENT_LIBRARY || env.CACHE;
    let contentIds = body.contentIds;

    if (!contentIds || contentIds.length === 0) {
      const indexRaw = store ? await store.get(`cl:idx:${walletLower}`) : null;
      const index: Array<{ id: string }> = indexRaw ? JSON.parse(indexRaw) : [];
      contentIds = index.slice(0, 100).map((e) => e.id);
    }

    job.totalItems = contentIds.length;
    const errors: string[] = [];
    let published = 0;

    for (const contentId of contentIds) {
      try {
        const raw = store ? await store.get(`cl:${walletLower}:${contentId}`) : null;
        if (!raw) continue;

        const record = JSON.parse(raw) as { body?: string; tags?: string[]; createdAt?: number };

        // Build Nostr kind 1 event
        const tags: string[][] = [];
        if (record.tags) {
          for (const tag of record.tags) {
            tags.push(['t', tag]);
          }
        }
        tags.push(['client', 'degenfeed-migration']);
        tags.push(['L', 'degenfeed.xyz']);

        const event = {
          kind: 1,
          content: record.body || '',
          tags,
          created_at: record.createdAt
            ? Math.floor(record.createdAt / 1000)
            : Math.floor(Date.now() / 1000),
        };

        // Due to the complexity of Nostr event signing without requiring the nsec
        // in the worker, we store the event data for the client to sign & publish
        await store?.put(
          `migration:nostr:event:${walletLower}:${contentId}`,
          JSON.stringify(event),
          {
            expirationTtl: 86400,
          },
        );
        published++;
      } catch (e) {
        errors.push(`${contentId}: ${(e as Error).message}`);
      }

      job.processedItems = published;
      job.progress = Math.round((job.processedItems / job.totalItems) * 100);
      await storeJob(env, job);
    }

    job.status = 'completed';
    job.progress = 100;
    job.errors = errors.slice(0, 20);
    job.completedAt = Date.now();
    await storeJob(env, job);

    return ok({
      jobId,
      platform: 'nostr',
      direction: 'export',
      status: job.status,
      prepared: published,
      total: contentIds.length,
      relays,
      note:
        published > 0
          ? `Prepared ${published} events. Sign and publish with your nsec client using nostr:${walletLower.slice(0, 8)} keys.`
          : 'No content to export.',
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (err) {
    job.status = 'failed';
    job.error = (err as Error).message;
    job.completedAt = Date.now();
    await storeJob(env, job);
    log('error', 'migration failed', { route: 'handleExportToNostr', error: String(err) });
    return serverError();
  }
}

/**
 * POST /api/account/migrate/export/bluesky
 * Push user content to Bluesky PDS.
 */
export async function handleExportToBluesky(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletLower = session.address.toLowerCase();

  let body: {
    pdsUrl?: string;
    accessJwt?: string;
    did?: string;
    contentIds?: string[];
  };
  try {
    body = (await request.json()) as {
      pdsUrl?: string;
      accessJwt?: string;
      did?: string;
      contentIds?: string[];
    };
  } catch {
    return badRequest('Invalid JSON body. Required: pdsUrl, accessJwt, did');
  }

  if (!body.pdsUrl || !body.accessJwt || !body.did) {
    return badRequest('pdsUrl, accessJwt, and did are required for Bluesky export.');
  }

  const jobId = generateJobId();
  const job: MigrationJob = {
    id: jobId,
    wallet: session.address,
    direction: 'export',
    platform: 'bluesky',
    status: 'processing',
    progress: 0,
    totalItems: 0,
    processedItems: 0,
    errors: [],
    startedAt: Date.now(),
  };

  await storeJob(env, job);

  try {
    const store = env.CONTENT_LIBRARY || env.CACHE;
    let contentIds = body.contentIds;

    if (!contentIds || contentIds.length === 0) {
      const indexRaw = store ? await store.get(`cl:idx:${walletLower}`) : null;
      const index: Array<{ id: string }> = indexRaw ? JSON.parse(indexRaw) : [];
      contentIds = index.slice(0, 50).map((e) => e.id);
    }

    job.totalItems = contentIds.length;
    const errors: string[] = [];
    let published = 0;
    const pdsUrl = body.pdsUrl.replace(/\/$/, '');

    for (const contentId of contentIds) {
      try {
        const raw = store ? await store.get(`cl:${walletLower}:${contentId}`) : null;
        if (!raw) continue;

        const record = JSON.parse(raw) as { body?: string; createdAt?: number };

        // Bluesky uses AT Protocol com.atproto.repo.createRecord
        const collection = 'app.bsky.feed.post';
        const recordBody = {
          repo: body.did,
          collection,
          record: {
            $type: collection,
            text: record.body || '',
            createdAt: record.createdAt
              ? new Date(record.createdAt).toISOString()
              : new Date().toISOString(),
          },
        };

        const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${body.accessJwt}`,
          },
          body: JSON.stringify(recordBody),
        });

        if (res.ok) {
          published++;
        } else {
          const errText = await res.text().catch(() => 'unknown');
          errors.push(`Failed to publish ${contentId}: ${res.status} ${errText}`);
        }
      } catch (e) {
        errors.push(`${contentId}: ${(e as Error).message}`);
      }

      job.processedItems = published;
      job.progress = Math.round((job.processedItems / job.totalItems) * 100);
      await storeJob(env, job);
    }

    job.status = errors.length > 0 && published === 0 ? 'failed' : 'completed';
    job.progress = 100;
    job.errors = errors.slice(0, 20);
    job.completedAt = Date.now();
    await storeJob(env, job);

    return ok({
      jobId,
      platform: 'bluesky',
      direction: 'export',
      status: job.status,
      published,
      total: contentIds.length,
      pdsUrl,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (err) {
    job.status = 'failed';
    job.error = (err as Error).message;
    job.completedAt = Date.now();
    await storeJob(env, job);
    log('error', 'migration failed', { route: 'handleExportToBluesky', error: String(err) });
    return serverError();
  }
}

// ─── Status & Job Listing ─────────────────────────────────────

/**
 * GET /api/account/migrate/status
 * Returns current migration status and recent jobs.
 */
export async function handleMigrationStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const jobs = await listJobs(env, session.address);

  return ok({
    wallet: session.address,
    recentJobs: jobs.slice(0, 10),
    totalJobs: jobs.length,
    inProgress: jobs.filter((j) => j.status === 'processing' || j.status === 'pending').length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  });
}

/**
 * GET /api/account/migrate/jobs
 * List all recent migration jobs.
 */
export async function handleMigrationJobs(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const jobs = await listJobs(env, session.address);

  return ok({
    jobs,
    total: jobs.length,
  });
}
