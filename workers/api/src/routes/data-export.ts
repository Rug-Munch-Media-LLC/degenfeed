/**
 * @degenfeed/api-worker — Full Data Export
 *
 * Export ALL user data in multiple formats:
 *   GET /api/account/export/manifest       — export manifest (what data is available)
 *   GET /api/account/export/json           — full JSON export
 *   GET /api/account/export/csv            — CSV export (flat tables)
 *   GET /api/account/export/html           — browsable HTML archive
 *   GET /api/account/export/activitypub    — ActivityPub compatible export
 *   GET /api/account/export/mastodon       — Mastodon-compatible CSV
 *   GET /api/account/export/nostr          — Nostr events export
 *   GET /api/account/export/atproto        — AT Protocol CAR-style export
 *
 * Every endpoint requires a valid session cookie.
 * All exports are generated on-the-fly from KV data.
 */

import {
  buildActivityPubNotes,
  buildActivityPubProfile,
  buildAtProtoExport,
  buildDataTransferPackage,
  buildExportManifest,
  buildHtmlArchive,
  buildNostrExport,
  buildNostrNotes,
  buildSolidPodExport,
  jsonToCsv,
} from '../lib/data-portability';
import { log } from '../logger';
import { ok, serverError } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Type for gathered user data ──────────────────────────────

interface UserDataBundle {
  profile: {
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    wallet: string;
    chain: string;
  };
  preferences: Record<string, unknown> | null;
  follows: string[] | null;
  mutedAuthors: string[] | null;
  mutedWords: string[] | null;
  subscriptions: Record<string, unknown>;
  bookmarks: unknown;
  contentLibrary: Array<{
    id: string;
    type: string;
    body: string;
    createdAt: number;
    tags?: string[];
  }>;
  platformAccounts: Record<string, unknown>;
  identities: Record<string, unknown> | null;
  activityLog: Array<Record<string, unknown>>;
}

// ─── Data gathering ───────────────────────────────────────────

/**
 * Gather ALL user data from all KV namespaces.
 * This is the single-source-of-truth for all export formats.
 */
async function gatherAllUserData(
  walletAddress: string,
  env: Env,
  chain = 'ethereum',
): Promise<UserDataBundle> {
  const walletLower = walletAddress.toLowerCase();

  // Basic profile
  const profile: UserDataBundle['profile'] = {
    displayName: undefined,
    avatarUrl: undefined,
    bio: undefined,
    wallet: walletAddress,
    chain,
  };

  let preferences: Record<string, unknown> | null = null;
  let followsRaw: string[] | null = null;
  let mutedAuthorsRaw: string[] | null = null;
  let mutedWordsRaw: string[] | null = null;
  const subscriptions: Record<string, unknown> = {};
  let bookmarks: unknown = null;
  const contentLibrary: UserDataBundle['contentLibrary'] = [];
  let platformAccounts: Record<string, unknown> = {};
  let identities: Record<string, unknown> | null = null;
  const activityLog: Array<Record<string, unknown>> = [];

  // Gather from all KVs in parallel
  const tasks: Promise<void>[] = [];

  // ── CACHE KV ──────────────────────────────────────────────────
  if (env.CACHE) {
    tasks.push(
      (async () => {
        try {
          const [prefRaw, followsRaw2, mutedARaw, mutedWRaw, dwellRaw, topicsRaw] =
            await Promise.all([
              env.CACHE?.get(`user:prefs:${walletLower}`),
              env.CACHE?.get(`user:follows:${walletLower}`),
              env.CACHE?.get(`user:muted_authors:${walletLower}`),
              env.CACHE?.get(`user:muted_words:${walletLower}`),
              env.CACHE?.get(`user:dwell:${walletLower}`).catch(() => null),
              env.CACHE?.get(`user:topics:${walletLower}`).catch(() => null),
            ]);
          if (prefRaw) {
            const parsed = JSON.parse(prefRaw);
            preferences = parsed as Record<string, unknown>;
            profile.displayName = (parsed as Record<string, string>).displayName;
            profile.avatarUrl = (parsed as Record<string, string>).avatarUrl;
            profile.bio = (parsed as Record<string, string>).bio;
          }
          if (followsRaw2) followsRaw = JSON.parse(followsRaw2);
          if (mutedARaw) mutedAuthorsRaw = JSON.parse(mutedARaw);
          if (mutedWRaw) mutedWordsRaw = JSON.parse(mutedWRaw);
          if (dwellRaw) activityLog.push({ type: 'dwell', data: JSON.parse(dwellRaw) });
          if (topicsRaw) activityLog.push({ type: 'topics', data: JSON.parse(topicsRaw) });
        } catch {
          /* KV read failed */
        }
      })(),
    );
  }

  // ── SUBSCRIPTIONS KV ─────────────────────────────────────────
  if (env.SUBSCRIPTIONS) {
    tasks.push(
      (async () => {
        try {
          for (const prefix of ['newsletter:sub:', 'notify:sub:']) {
            const raw = await env.SUBSCRIPTIONS?.get(`${prefix}${walletLower}`);
            if (raw) subscriptions[prefix.replace(':', '')] = JSON.parse(raw);
          }
        } catch {
          /* skip */
        }
      })(),
    );
  }

  // ── BOOKMARKS — Cloudflare KV is the single store ─────────────
  tasks.push(
    (async () => {
      if (env.BOOKMARKS) {
        try {
          const raw = await env.BOOKMARKS.get(`bookmarks:${walletLower}`);
          if (raw) bookmarks = JSON.parse(raw);
        } catch {
          /* skip */
        }
      }
    })(),
  );

  // ── CONTENT_LIBRARY KV ───────────────────────────────────────
  if (env.CONTENT_LIBRARY || env.CACHE) {
    const store = env.CONTENT_LIBRARY || env.CACHE!;
    tasks.push(
      (async () => {
        try {
          const indexRaw = await store.get(`cl:idx:${walletLower}`);
          if (indexRaw) {
            const index = JSON.parse(indexRaw) as Array<{ id: string }>;
            for (const entry of index.slice(0, 500)) {
              const cr = await store.get(`cl:${walletLower}:${entry.id}`);
              if (cr) {
                const record = JSON.parse(cr) as {
                  id: string;
                  type: string;
                  body: string;
                  createdAt: number;
                  tags?: string[];
                };
                if (!record) continue;
                if ((record as unknown as Record<string, unknown>).deleted) continue;
                contentLibrary.push({
                  id: record.id,
                  type: record.type,
                  body: record.body,
                  createdAt: record.createdAt,
                  tags: record.tags,
                });
              }
            }
          }
        } catch {
          /* skip */
        }
      })(),
    );
  }

  // ── PLATFORM_ACCOUNTS KV ─────────────────────────────────────
  if (env.PLATFORM_ACCOUNTS) {
    tasks.push(
      (async () => {
        try {
          const raw = await env.PLATFORM_ACCOUNTS?.get(`account:${walletLower}`);
          if (raw) platformAccounts = JSON.parse(raw) as Record<string, unknown>;
          // Also gather per-protocol records
          for (const plat of ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon']) {
            const pr = await env.PLATFORM_ACCOUNTS?.get(`${plat}:${walletLower}`).catch(() => null);
            if (pr) {
              (platformAccounts as Record<string, unknown>)[plat] = JSON.parse(pr);
            }
          }
        } catch {
          /* skip */
        }
      })(),
    );
  }

  // ── IDENTITIES KV ────────────────────────────────────────────
  if (env.IDENTITIES) {
    tasks.push(
      (async () => {
        try {
          const raw = await env.IDENTITIES?.get(`identity:${walletLower}`);
          if (raw) identities = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          /* skip */
        }
      })(),
    );
  }

  // ── Audit trail ──────────────────────────────────────────────
  if (env.CACHE) {
    tasks.push(
      (async () => {
        try {
          const listResult = await env.CACHE?.list({ prefix: `security:audit:${walletLower}:` });
          for (const key of (listResult?.keys ?? []).slice(0, 200)) {
            const raw = await env.CACHE?.get(key.name);
            if (raw) activityLog.push({ type: 'security_audit', data: JSON.parse(raw) });
          }
        } catch {
          /* skip */
        }
      })(),
    );
  }

  await Promise.all(tasks);

  return {
    profile,
    preferences,
    follows: followsRaw,
    mutedAuthors: mutedAuthorsRaw,
    mutedWords: mutedWordsRaw,
    subscriptions,
    bookmarks,
    contentLibrary,
    platformAccounts,
    identities,
    activityLog,
  };
}

// ─── Handlers ─────────────────────────────────────────────────

/**
 * GET /api/account/export/manifest
 * Returns a manifest describing all available data for export.
 */
export async function handleExportManifest(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const data = await gatherAllUserData(session.address, env, session.chain);
    const stats = {
      posts: data.contentLibrary.length,
      replies: 0,
      likes: 0,
      reposts: 0,
      media: 0,
    };

    const manifest = buildExportManifest(session.address, stats, {
      displayName: data.profile.displayName,
      avatarUrl: data.profile.avatarUrl,
      bio: data.profile.bio,
    });

    return ok(manifest);
  } catch (err) {
    log('error', 'export failed', { route: 'handleExportManifest', error: String(err) });
    return serverError();
  }
}

/**
 * GET /api/account/export/json
 * Full JSON export of all user data.
 */
export async function handleExportJson(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const data = await gatherAllUserData(session.address, env, session.chain);

    const exportPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      platform: 'degenfeed',
      user: data.profile,
      preferences: data.preferences,
      social: {
        follows: data.follows,
        mutedAuthors: data.mutedAuthors,
        mutedWords: data.mutedWords,
      },
      subscriptions: data.subscriptions,
      bookmarks: data.bookmarks,
      contentLibrary: data.contentLibrary,
      platformAccounts: data.platformAccounts,
      identities: data.identities,
      activityLog: data.activityLog,
    };

    const _respData = JSON.stringify(exportPayload, null, 2);
    return new Response(_respData, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="degenfeed-export-${session.address.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    log('error', 'export failed', { route: 'handleExportJson', error: String(err) });
    return serverError();
  }
}

/**
 * GET /api/account/export/csv
 * CSV export of user data (flattened tables).
 */
export async function handleExportCsv(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const data = await gatherAllUserData(session.address, env, session.chain);

    // Build CSV sections
    const sections: string[] = [];

    // Posts CSV
    if (data.contentLibrary.length > 0) {
      const rows = data.contentLibrary.map((p) => ({
        id: p.id,
        type: p.type,
        body: p.body,
        createdAt: new Date(p.createdAt).toISOString(),
        tags: (p.tags || []).join('; '),
      }));
      sections.push('# === POSTS ===');
      sections.push(jsonToCsv(rows as unknown as Record<string, unknown>[]));
    }

    // Follows CSV
    if (data.follows && data.follows.length > 0) {
      const rows = data.follows.map((f) => ({ address: f }));
      sections.push('# === FOLLOWS ===');
      sections.push(jsonToCsv(rows));
    }

    // Muted CSV
    if (data.mutedAuthors && data.mutedAuthors.length > 0) {
      const rows = data.mutedAuthors.map((a) => ({ mutedAuthor: a }));
      sections.push('# === MUTED AUTHORS ===');
      sections.push(jsonToCsv(rows));
    }

    // Preferences as flat CSV
    if (data.preferences) {
      sections.push('# === PREFERENCES ===');
      sections.push(jsonToCsv([data.preferences]));
    }

    const csv = sections.join('\n\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="degenfeed-export-${session.address.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    log('error', 'export failed', { route: 'handleExportCsv', error: String(err) });
    return serverError();
  }
}

/**
 * GET /api/account/export/html
 * Browsable HTML archive of user data.
 */
export async function handleExportHtml(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const data = await gatherAllUserData(session.address, env, session.chain);

    const sections: Array<{ title: string; content: string }> = [];

    // Profile section
    sections.push({
      title: 'Profile',
      content: JSON.stringify(data.profile, null, 2),
    });

    // Preferences
    if (data.preferences) {
      sections.push({
        title: 'Preferences',
        content: JSON.stringify(data.preferences, null, 2),
      });
    }

    // Posts
    if (data.contentLibrary.length > 0) {
      sections.push({
        title: `Posts (${data.contentLibrary.length})`,
        content: data.contentLibrary
          .map(
            (p) =>
              `[${p.type.toUpperCase()}] ${p.body.slice(0, 200)}${p.body.length > 200 ? '...' : ''} — ${new Date(p.createdAt).toISOString()}`,
          )
          .join('\n---\n'),
      });
    }

    // Follows
    if (data.follows) {
      sections.push({
        title: `Following (${data.follows.length})`,
        content: data.follows.join('\n'),
      });
    }

    // Subscriptions
    if (Object.keys(data.subscriptions).length > 0) {
      sections.push({
        title: 'Subscriptions',
        content: JSON.stringify(data.subscriptions, null, 2),
      });
    }

    // Platform accounts
    if (Object.keys(data.platformAccounts).length > 0) {
      sections.push({
        title: 'Connected Platform Accounts',
        content: JSON.stringify(data.platformAccounts, null, 2),
      });
    }

    // Activity log
    if (data.activityLog.length > 0) {
      sections.push({
        title: `Activity Log (${data.activityLog.length} events)`,
        content: data.activityLog
          .slice(0, 100)
          .map((e) => JSON.stringify(e))
          .join('\n'),
      });
    }

    const html = buildHtmlArchive(session.address, sections);

    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-disposition': `attachment; filename="degenfeed-export-${session.address.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.html"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    log('error', 'export failed', { route: 'handleExportHtml', error: String(err) });
    return serverError();
  }
}

/**
 * GET /api/account/export/activitypub
 * ActivityPub-compatible export of user profile + posts.
 */
export async function handleExportActivityPub(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const data = await gatherAllUserData(session.address, env, session.chain);
    const handle = data.identities
      ? ((data.identities as Record<string, unknown>).mastodon as { handle?: string } | undefined)
          ?.handle || `df_${session.address.slice(2, 10)}`
      : `df_${session.address.slice(2, 10)}`;

    const profile = buildActivityPubProfile(session.address, handle, {
      displayName: data.profile.displayName,
      summary: data.profile.bio,
      avatarUrl: data.profile.avatarUrl,
    });

    const notes = buildActivityPubNotes(
      data.contentLibrary.map((p) => ({
        id: p.id,
        body: p.body,
        createdAt: p.createdAt,
        tags: p.tags,
      })),
      profile.id,
    );

    const exportPayload = {
      actor: profile,
      notes,
      totalItems: notes.length,
      exportedAt: new Date().toISOString(),
      '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
    };

    const _respData = JSON.stringify(exportPayload, null, 2);
    return new Response(_respData, {
      status: 200,
      headers: {
        'content-type': 'application/activity+json; charset=utf-8',
        'content-disposition': `attachment; filename="degenfeed-activitypub-${session.address.slice(0, 8)}.json"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    log('error', 'export failed', { route: 'handleExportActivityPub', error: String(err) });
    return serverError();
  }
}

/**
 * GET /api/account/export/nostr
 * Nostr-compatible events export.
 */
export async function handleExportNostr(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const data = await gatherAllUserData(session.address, env, session.chain);

    const profileEvent = buildNostrExport({
      displayName: data.profile.displayName,
      about: data.profile.bio,
      picture: data.profile.avatarUrl,
    });

    const noteEvents = buildNostrNotes(
      data.contentLibrary.map((p) => ({
        id: p.id,
        body: p.body,
        createdAt: p.createdAt,
        tags: p.tags,
      })),
    );

    const events = [...profileEvent, ...noteEvents];

    // NDJSON format — one JSON event per line (Nostr standard)
    const ndjson = events.map((e) => JSON.stringify(e)).join('\n');

    return new Response(ndjson, {
      status: 200,
      headers: {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'content-disposition': `attachment; filename="degenfeed-nostr-${session.address.slice(0, 8)}.ndjson"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    log('error', 'export failed', { route: 'handleExportNostr', error: String(err) });
    return serverError();
  }
}

/**
 * GET /api/account/export/atproto
 * AT Protocol (Bluesky) compatible export.
 */
export async function handleExportAtProto(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const data = await gatherAllUserData(session.address, env, session.chain);

    const atprotoIdentity = data.identities
      ? ((data.identities as Record<string, unknown>).atproto as
          | { did?: string; handle?: string }
          | undefined)
      : undefined;

    const did = atprotoIdentity?.did || `did:plc:${session.address.slice(2, 18)}`;
    const handle =
      atprotoIdentity?.handle || `df-${session.address.slice(2, 14)}.pds.degenfeed.xyz`;

    const atExport = buildAtProtoExport(did, handle, {
      posts: data.contentLibrary.map((p) => ({
        cid: p.id,
        text: p.body,
        createdAt: new Date(p.createdAt).toISOString(),
      })),
      follows: data.follows?.map((f) => ({ did: f })) || [],
      profile: data.preferences as Record<string, unknown> | undefined,
    });

    const packagePayload = buildDataTransferPackage('atproto.repository', {
      did: atExport.did,
      handle: atExport.handle,
      posts: atExport.posts,
      follows: atExport.follows,
      profile: atExport.profile,
    });

    const _respData = JSON.stringify(packagePayload, null, 2);
    return new Response(_respData, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="degenfeed-atproto-${session.address.slice(0, 8)}.json"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    log('error', 'export failed', { route: 'handleExportAtProto', error: String(err) });
    return serverError();
  }
}

/**
 * GET /api/account/export/solid
 * Solid POD compatible export — true data ownership.
 */
export async function handleExportSolid(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const data = await gatherAllUserData(session.address, env, session.chain);

    const resources: Array<{ id: string; type: string; size: number }> = [];

    if (data.preferences) {
      resources.push({
        id: 'preferences.json',
        type: 'http://www.w3.org/ns/ldp#Resource',
        size: JSON.stringify(data.preferences).length,
      });
    }
    if (data.follows) {
      resources.push({
        id: 'follows.json',
        type: 'http://www.w3.org/ns/ldp#Resource',
        size: JSON.stringify(data.follows).length,
      });
    }
    if (data.contentLibrary.length > 0) {
      resources.push({
        id: 'posts.json',
        type: 'http://www.w3.org/ns/ldp#Resource',
        size: JSON.stringify(data.contentLibrary).length,
      });
    }

    const podExport = buildSolidPodExport(session.address, resources);

    const _respData = JSON.stringify(podExport, null, 2);
    return new Response(_respData, {
      status: 200,
      headers: {
        'content-type': 'application/ld+json; charset=utf-8',
        'content-disposition': `attachment; filename="degenfeed-solid-${session.address.slice(0, 8)}.jsonld"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    log('error', 'export failed', { route: 'handleExportSolid', error: String(err) });
    return serverError();
  }
}
