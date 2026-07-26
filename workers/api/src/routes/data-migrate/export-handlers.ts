import { log } from '../../logger';
import { badRequest, ok, serverError } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';
import type { MigrationDirection, MigrationJob, MigrationPlatform } from './types';

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
    return serverError(env, err, { route: 'handleExportToMastodon' });
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
    return serverError(env, err, { route: 'handleExportToNostr' });
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
    return serverError(env, err, { route: 'handleExportToBluesky' });
  }
}

// ─── Status & Job Listing ─────────────────────────────────────

/**
 * GET /api/account/migrate/status
 * Returns current migration status and recent jobs.
 */
