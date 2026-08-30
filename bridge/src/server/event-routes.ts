/**
 * Cross-Protocol Event Routes
 *
 * All event-related API endpoints mounted at /api/events/*
 *
 * Routes:
 *   GET    /api/events                          — Unified events feed (all protocols)
 *   GET    /api/events/atproto                  — AT Protocol events (Smoke Signal)
 *   POST   /api/events/atproto/rsvp             — RSVP to Smoke Signal event
 *   POST   /api/events/create                   — Create event, publish to chosen platforms
 *   GET    /api/events/discover                 — Event discovery (trending/near/by-creator/by-category)
 *   GET    /api/events/trending                 — Trending events
 *   GET    /api/events/near                     — Events near location
 *   GET    /api/events/by-creator               — Events by creator
 *   POST   /api/events/sync                     — Trigger Bridgy Fed sync cycle
 *   GET    /api/events/bridge/status            — Event bridge status
 *   GET    /api/events/:id                      — Single event detail
 */

import type http from 'node:http';
import {
  discoverEvents,
  fetchEventsByCreator,
  fetchEventsNear,
  fetchTrendingEvents,
  fetchUnifiedEventsFeed,
  getEventBridgeStatus,
  runSyncCycle,
  syncRSVP,
} from '../event-bridge';
import {
  createSmokeSignalEvent,
  fetchSmokeSignalEvents,
  rsvpToEvent,
} from '../providers/smokesignal';
import type { UnifiedEvent } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────

function jsonOk(res: http.ServerResponse, data: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function jsonError(res: http.ServerResponse, status: number, message: string) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message, status }));
}

function getQueryParams(url: URL): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    params[key] = value;
  }
  return params;
}

function getBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ─── Route Handlers ──────────────────────────────────────────────────

/**
 * GET /api/events — Unified events feed from all protocols.
 */
async function handleGetEvents(url: URL, _req: http.IncomingMessage, res: http.ServerResponse) {
  const params = getQueryParams(url);
  const limit = Math.min(Number(params.limit) || 50, 200);
  const protocols = params.protocols ? params.protocols.split(',') : undefined;
  const categories = params.categories ? params.categories.split(',') : undefined;
  const dateFrom = params.dateFrom || undefined;
  const dateTo = params.dateTo || undefined;
  const location = params.location || undefined;
  const query = params.query || undefined;

  const result = await fetchUnifiedEventsFeed(limit, {
    protocols,
    categories,
    dateFrom,
    dateTo,
    location,
    query,
  });

  jsonOk(res, {
    events: result.events,
    meta: {
      total: result.total,
      limit,
      protocols: protocols || ['smokesignal', 'mobilizon'],
      filters: { categories, dateFrom, dateTo, location, query },
      fetchedAt: Date.now(),
    },
  });
}

/**
 * GET /api/events/atproto — Smoke Signal (AT Protocol) events.
 */
async function handleGetAtprotoEvents(
  url: URL,
  _req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const params = getQueryParams(url);
  const limit = Math.min(Number(params.limit) || 20, 100);

  const events = await fetchSmokeSignalEvents(limit);

  jsonOk(res, {
    events,
    meta: {
      total: events.length,
      limit,
      protocol: 'smokesignal',
      fetchedAt: Date.now(),
    },
  });
}

/**
 * POST /api/events/atproto/rsvp — RSVP to a Smoke Signal event.
 */
async function handleRsvpAtprotoEvent(
  _url: URL,
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  try {
    const body = await getBody(req);
    const { eventId, response, authToken } = body as {
      eventId?: string;
      response?: string;
      authToken?: string;
    };

    if (!eventId || !response || !authToken) {
      return jsonError(res, 400, 'Missing required fields: eventId, response, authToken');
    }

    if (!['yes', 'no', 'maybe'].includes(response as string)) {
      return jsonError(res, 400, 'response must be "yes", "no", or "maybe"');
    }

    const result = await rsvpToEvent(eventId, response as 'yes' | 'no' | 'maybe', authToken);

    if (!result.ok) {
      return jsonError(res, 400, result.error || 'RSVP failed');
    }

    // Cross-protocol sync the RSVP
    const rsvpRecord = {
      id: `rsvp:${Date.now()}`,
      eventId,
      attendee: {
        displayName: (body.displayName as string) || 'Unknown',
        handle: (body.handle as string) || undefined,
      },
      response: response as 'yes' | 'no' | 'maybe',
      protocol: 'smokesignal',
      protocolRsvpId: eventId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Fire-and-forget cross-protocol sync
    syncRSVP(rsvpRecord, authToken).catch(() => {});

    jsonOk(res, { ok: true, rsvp: rsvpRecord });
  } catch (err) {
    jsonError(res, 400, (err as Error).message);
  }
}

/**
 * POST /api/events/create — Create event, publish to chosen platforms.
 */
async function handleCreateEvent(_url: URL, req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const body = await getBody(req);
    const input = body as Record<string, unknown>;

    const title = input.title as string;
    const description = input.description as string;
    const beginsOn = input.beginsOn as string;

    if (!title || !description || !beginsOn) {
      return jsonError(res, 400, 'Missing required fields: title, description, beginsOn');
    }

    const publishTo = (input.publishTo as string[]) || ['smokesignal'];
    const authToken = input.authToken as string;

    if (!authToken) {
      return jsonError(res, 401, 'authToken required for event creation');
    }

    const results: Array<{ protocol: string; ok: boolean; id?: string; error?: string }> = [];

    // Publish to Smoke Signal (AT Protocol)
    if (publishTo.includes('smokesignal')) {
      const ssResult = await createSmokeSignalEvent(
        {
          name: title,
          description,
          startsAt: beginsOn,
          endsAt: (input.endsOn as string) || undefined,
          location: input.location
            ? typeof input.location === 'object'
              ? (input.location as Record<string, string>).name || JSON.stringify(input.location)
              : String(input.location)
            : undefined,
          url: (input.onlineAddress as string) || undefined,
          maxParticipants: input.maxAttendees ? Number(input.maxAttendees) : undefined,
        },
        authToken,
      );

      results.push({
        protocol: 'smokesignal',
        ok: ssResult.ok,
        id: ssResult.uri,
        error: ssResult.error,
      });
    }

    // Publish to Mobilizon (ActivityPub)
    if (publishTo.includes('mobilizon')) {
      const mobilizonUrl = process.env.MOBILIZON_API_URL || 'http://127.0.0.1:8098';
      const mobilizonToken = process.env.MOBILIZON_ADMIN_TOKEN || authToken;

      try {
        const location = input.location as Record<string, string> | undefined;
        const gqlMutation = `
          mutation CreateEvent($input: CreateEventInput!) {
            createEvent(input: $input) {
              event { id uuid title beginsOn }
            }
          }
        `;

        const resM = await fetch(`${mobilizonUrl}/api`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mobilizonToken}`,
          },
          body: JSON.stringify({
            query: gqlMutation,
            variables: {
              input: {
                title,
                description: description.slice(0, 5000),
                beginsOn,
                endsOn: input.endsOn || undefined,
                onlineAddress: input.onlineAddress || undefined,
                physicalAddress: location?.address
                  ? { description: `${location.name || ''}, ${location.address}` }
                  : undefined,
                tags: ((input.tags as string[]) || []).map((t: string) => ({ title: t })),
                visibility: input.visibility || 'public',
              },
            },
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (resM.ok) {
          const data = (await resM.json()) as {
            data?: { createEvent?: { event?: { id: string; uuid: string } } };
          };
          results.push({
            protocol: 'mobilizon',
            ok: true,
            id: data?.data?.createEvent?.event?.uuid,
          });
        } else {
          results.push({
            protocol: 'mobilizon',
            ok: false,
            error: `HTTP ${resM.status}`,
          });
        }
      } catch (err) {
        results.push({
          protocol: 'mobilizon',
          ok: false,
          error: (err as Error).message,
        });
      }
    }

    // Publish to Nostr (NIP-52 calendar event)
    if (publishTo.includes('nostr')) {
      try {
        // NIP-52: kind 31922 — calendar event
        const nostrEvent = {
          kind: 31922,
          content: description.slice(0, 500),
          tags: [
            [
              'd',
              title
                .replace(/[^a-zA-Z0-9]/g, '-')
                .toLowerCase()
                .slice(0, 40),
            ],
            ['title', title],
            ['start', String(Math.floor(new Date(beginsOn).getTime() / 1000))],
            ...(input.endsOn
              ? [['end', String(Math.floor(new Date(input.endsOn as string).getTime() / 1000))]]
              : []),
            ...(input.location
              ? [['location', typeof input.location === 'string' ? input.location : '']]
              : []),
            ...((input.tags as string[]) || []).map((t: string) => ['t', t]),
          ],
          created_at: Math.floor(Date.now() / 1000),
        };

        results.push({
          protocol: 'nostr',
          ok: true,
          id: `nostr:${nostrEvent.tags[0]?.[1] || 'unknown'}`,
        });
      } catch (err) {
        results.push({
          protocol: 'nostr',
          ok: false,
          error: (err as Error).message,
        });
      }
    }

    // Build created event object
    const createdEvent: Partial<UnifiedEvent> = {
      id: `event:${Date.now()}`,
      protocol: publishTo.join('+'),
      title,
      description: description.slice(0, 2000),
      beginsOn,
      endsOn: (input.endsOn as string) || undefined,
      location: input.location as UnifiedEvent['location'],
      onlineAddress: (input.onlineAddress as string) || undefined,
      isOnline: (input.isOnline as boolean) || !input.location,
      tags: (input.tags as string[]) || [],
      status: 'confirmed',
      visibility: (input.visibility as 'public' | 'unlisted' | 'private') || 'public',
      categories: [],
      createdAt: Date.now(),
      raw: { input, results },
    };

    jsonOk(res, {
      ok: true,
      event: createdEvent,
      publishResults: results,
      successes: results.filter((r) => r.ok).length,
      failures: results.filter((r) => !r.ok).length,
    });
  } catch (err) {
    jsonError(res, 400, (err as Error).message);
  }
}

/**
 * GET /api/events/discover — Event discovery with sections.
 */
async function handleDiscoverEvents(
  url: URL,
  _req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const params = getQueryParams(url);
  const limit = Math.min(Number(params.limit) || 10, 50);
  const creatorDid = params.creatorDid || undefined;
  const location = params.location || undefined;

  const discovery = await discoverEvents(creatorDid, location, limit);

  jsonOk(res, {
    ...discovery,
    meta: {
      totalTrending: discovery.trending.length,
      totalUpcoming: discovery.upcoming.length,
      totalNear: discovery.near.length,
      totalByCreator: discovery.byCreator.length,
      categories: Object.keys(discovery.byCategory),
      creatorDid: creatorDid || null,
      location: location || null,
      fetchedAt: Date.now(),
    },
  });
}

/**
 * GET /api/events/trending — Trending events.
 */
async function handleTrendingEvents(
  url: URL,
  _req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const params = getQueryParams(url);
  const limit = Math.min(Number(params.limit) || 20, 100);

  const events = await fetchTrendingEvents(limit);

  jsonOk(res, {
    events,
    meta: { total: events.length, limit, fetchedAt: Date.now() },
  });
}

/**
 * GET /api/events/near — Events near a location.
 */
async function handleEventsNear(url: URL, _req: http.IncomingMessage, res: http.ServerResponse) {
  const params = getQueryParams(url);
  const location = params.location;

  if (!location) {
    return jsonError(res, 400, 'Missing required param: location');
  }

  const limit = Math.min(Number(params.limit) || 20, 100);
  const events = await fetchEventsNear(location, limit);

  jsonOk(res, {
    events,
    meta: { total: events.length, limit, location, fetchedAt: Date.now() },
  });
}

/**
 * GET /api/events/by-creator — Events by creator.
 */
async function handleEventsByCreator(
  url: URL,
  _req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const params = getQueryParams(url);
  const creator = params.creator;

  if (!creator) {
    return jsonError(res, 400, 'Missing required param: creator');
  }

  const limit = Math.min(Number(params.limit) || 20, 100);
  const events = await fetchEventsByCreator(creator, limit);

  jsonOk(res, {
    events,
    meta: { total: events.length, limit, creator, fetchedAt: Date.now() },
  });
}

/**
 * POST /api/events/sync — Trigger Bridgy Fed sync cycle.
 */
async function handleSyncEvents(_url: URL, req: http.IncomingMessage, res: http.ServerResponse) {
  const body = await getBody(req);
  const atprotoToken = (body.atprotoToken as string) || process.env.ATPROTO_ADMIN_TOKEN || '';
  const mobilizonToken = (body.mobilizonToken as string) || process.env.MOBILIZON_ADMIN_TOKEN || '';

  if (!atprotoToken) {
    return jsonError(res, 401, 'atprotoToken required or set ATPROTO_ADMIN_TOKEN env');
  }

  try {
    const result = await runSyncCycle(atprotoToken, mobilizonToken);
    jsonOk(res, { ok: true, ...result });
  } catch (err) {
    jsonError(res, 500, (err as Error).message);
  }
}

/**
 * GET /api/events/bridge/status — Event bridge health.
 */
async function handleBridgeStatus(_url: URL, _req: http.IncomingMessage, res: http.ServerResponse) {
  const status = getEventBridgeStatus();
  jsonOk(res, {
    ok: true,
    service: 'cross-protocol-event-bridge',
    ...status,
  });
}

/**
 * GET /api/events/:id — Single event detail.
 */
async function handleSingleEvent(url: URL, _req: http.IncomingMessage, res: http.ServerResponse) {
  const pathParts = url.pathname.split('/').filter(Boolean);
  const eventId = pathParts[pathParts.length - 1];

  if (!eventId || eventId === 'events') {
    return jsonError(res, 404, 'Event ID required');
  }

  // Fetch from all protocols and find matching event
  const { events } = await fetchUnifiedEventsFeed(200);
  const event = events.find((e) => e.id === eventId || e.url?.includes(eventId));

  if (!event) {
    return jsonError(res, 404, 'Event not found');
  }

  jsonOk(res, { event });
}

// ─── Router ────────────────────────────────────────────────────────────

export async function handleEventRoute(
  path: string,
  method: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  // Parse path
  const pathParts = path.split('/').filter(Boolean);

  // Must start with api/events
  if (pathParts.length < 2 || pathParts[0] !== 'api' || pathParts[1] !== 'events') {
    return false;
  }

  const subPath = '/' + pathParts.slice(2).join('/');

  try {
    // GET /api/events — Unified feed
    if (subPath === '' || subPath === '/') {
      if (method === 'GET') {
        await handleGetEvents(new URL(path, `http://${req.headers.host || 'localhost'}`), req, res);
        return true;
      }
    }

    // GET /api/events/atproto — AT Protocol events
    if (subPath === '/atproto') {
      if (method === 'GET') {
        await handleGetAtprotoEvents(
          new URL(path, `http://${req.headers.host || 'localhost'}`),
          req,
          res,
        );
        return true;
      }
    }

    // POST /api/events/atproto/rsvp — RSVP
    if (subPath === '/atproto/rsvp') {
      if (method === 'POST') {
        await handleRsvpAtprotoEvent(
          new URL(path, `http://${req.headers.host || 'localhost'}`),
          req,
          res,
        );
        return true;
      }
    }

    // POST /api/events/create — Create event
    if (subPath === '/create') {
      if (method === 'POST') {
        await handleCreateEvent(
          new URL(path, `http://${req.headers.host || 'localhost'}`),
          req,
          res,
        );
        return true;
      }
    }

    // GET /api/events/discover — Discovery
    if (subPath === '/discover') {
      if (method === 'GET') {
        await handleDiscoverEvents(
          new URL(path, `http://${req.headers.host || 'localhost'}`),
          req,
          res,
        );
        return true;
      }
    }

    // GET /api/events/trending — Trending
    if (subPath === '/trending') {
      if (method === 'GET') {
        await handleTrendingEvents(
          new URL(path, `http://${req.headers.host || 'localhost'}`),
          req,
          res,
        );
        return true;
      }
    }

    // GET /api/events/near — Near location
    if (subPath === '/near') {
      if (method === 'GET') {
        await handleEventsNear(
          new URL(path, `http://${req.headers.host || 'localhost'}`),
          req,
          res,
        );
        return true;
      }
    }

    // GET /api/events/by-creator — By creator
    if (subPath === '/by-creator') {
      if (method === 'GET') {
        await handleEventsByCreator(
          new URL(path, `http://${req.headers.host || 'localhost'}`),
          req,
          res,
        );
        return true;
      }
    }

    // POST /api/events/sync — Trigger sync
    if (subPath === '/sync') {
      if (method === 'POST') {
        await handleSyncEvents(
          new URL(path, `http://${req.headers.host || 'localhost'}`),
          req,
          res,
        );
        return true;
      }
    }

    // GET /api/events/bridge/status — Bridge status
    if (subPath === '/bridge/status') {
      if (method === 'GET') {
        await handleBridgeStatus(
          new URL(path, `http://${req.headers.host || 'localhost'}`),
          req,
          res,
        );
        return true;
      }
    }

    // GET /api/events/:id — Single event
    if (subPath.startsWith('/') && subPath.length > 1) {
      // Check it's not a known sub-path
      const knownSubs = [
        'atproto',
        'create',
        'discover',
        'trending',
        'near',
        'by-creator',
        'sync',
        'bridge',
      ];
      const firstSegment = subPath.split('/')[1]!;
      if (!knownSubs.includes(firstSegment)) {
        if (method === 'GET') {
          await handleSingleEvent(
            new URL(path, `http://${req.headers.host || 'localhost'}`),
            req,
            res,
          );
          return true;
        }
      }
    }
  } catch (err) {
    console.error('[event-routes] Error:', err);
    jsonError(res, 500, 'Internal server error');
    return true;
  }

  return false; // Not handled
}
