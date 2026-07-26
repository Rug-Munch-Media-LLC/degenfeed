/**
 * @degenfeed/api-worker — Universal Inbox Route Handlers
 *
 * HTTP route handlers that wrap the core inbox logic with
 * session auth, request parsing, and response formatting.
 */

import type { Env } from '../../index';
import { noCacheJsonResponse } from '../../index';
import { requireSession } from '../../session';
import type { InboxReplyRequest, InboxShareRequest, InboxReadRequest } from './types';
import { DEFAULT_PAGE_SIZE } from './constants';
import {
  aggregateUnifiedInbox, aggregateDMs, aggregateComments,
  replyToInboxItem, buildActivityFeed, shareCrossNetwork,
  getUserNetworkStatus, formatNetworkStatusReport, markInboxItemsRead,
} from './core';

/**
 * GET /api/inbox/unified — All messages, unified
 */
export async function handleInboxUnified(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_PAGE_SIZE, 100);
  const cursor = url.searchParams.get('cursor') || undefined;
  const includeRead = url.searchParams.get('includeRead') === 'true';

  try {
    const feed = await aggregateUnifiedInbox(walletAddress, env, { limit, cursor, includeRead });
    return noCacheJsonResponse(feed);
  } catch (e) {
    console.error('[inbox] unified fetch failed:', e);
    return noCacheJsonResponse({ items: [], meta: { total: 0, unread: 0, byKind: {}, byProtocol: {}, fetchedAt: Date.now() } });
  }
}

/**
 * GET /api/inbox/dms — DMs only
 */
export async function handleInboxDms(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_PAGE_SIZE, 100);
  const cursor = url.searchParams.get('cursor') || undefined;

  try {
    const feed = await aggregateDMs(walletAddress, env, { limit, cursor });
    return noCacheJsonResponse(feed);
  } catch (e) {
    console.error('[inbox] dms fetch failed:', e);
    return noCacheJsonResponse({ items: [], meta: { total: 0, unread: 0, byKind: {}, byProtocol: {}, fetchedAt: Date.now() } });
  }
}

/**
 * GET /api/inbox/comments — Comments only
 */
export async function handleInboxComments(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_PAGE_SIZE, 100);
  const cursor = url.searchParams.get('cursor') || undefined;

  try {
    const feed = await aggregateComments(walletAddress, env, { limit, cursor });
    return noCacheJsonResponse(feed);
  } catch (e) {
    console.error('[inbox] comments fetch failed:', e);
    return noCacheJsonResponse({ items: [], meta: { total: 0, unread: 0, byKind: {}, byProtocol: {}, fetchedAt: Date.now() } });
  }
}

/**
 * GET /api/inbox/activity — Activity feed
 */
export async function handleInboxActivity(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || DEFAULT_PAGE_SIZE, 100);

  try {
    const feed = await aggregateUnifiedInbox(walletAddress, env, { includeRead: true });
    const activities = buildActivityFeed(feed.items).slice(0, limit);
    return noCacheJsonResponse({ activities, meta: { total: activities.length, fetchedAt: Date.now() } });
  } catch (e) {
    console.error('[inbox] activity fetch failed:', e);
    return noCacheJsonResponse({ activities: [], meta: { total: 0, fetchedAt: Date.now() } });
  }
}

/**
 * POST /api/inbox/reply — Reply to anything from anywhere
 */
export async function handleInboxReply(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  let body: InboxReplyRequest;
  try {
    body = (await request.json()) as InboxReplyRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  if (!body.parentInboxId || !body.content) {
    return new Response(JSON.stringify({ error: 'Missing required fields: parentInboxId, content' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  try {
    const result = await replyToInboxItem(walletAddress, body, env);
    if (result.ok) return noCacheJsonResponse({ ok: true, nativeId: result.nativeId });
    return new Response(JSON.stringify({ error: result.error }), { status: 400, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    console.error('[inbox] reply failed:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

/**
 * POST /api/inbox/mark-read — Mark items as read
 */
export async function handleInboxMarkRead(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  let body: InboxReadRequest;
  try {
    body = (await request.json()) as InboxReadRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  if (!body.itemIds || !Array.isArray(body.itemIds) || body.itemIds.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing required field: itemIds (array)' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  try {
    const result = await markInboxItemsRead(walletAddress, body.itemIds, env);
    return noCacheJsonResponse({ ok: true, marked: result.marked });
  } catch (e) {
    console.error('[inbox] mark-read failed:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

/**
 * GET /api/inbox/status — Network connection status
 */
export async function handleInboxStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  try {
    const networkStatus = await getUserNetworkStatus(walletAddress, env);
    const report = formatNetworkStatusReport(networkStatus);
    return noCacheJsonResponse(report);
  } catch (e) {
    console.error('[inbox] status fetch failed:', e);
    return noCacheJsonResponse({ connected: [], disconnected: [], totalConnected: 0, totalAvailable: 0 });
  }
}

/**
 * POST /api/inbox/share — Cross-network share
 */
export async function handleInboxShare(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const walletAddress = session.address.toLowerCase();

  let body: InboxShareRequest;
  try {
    body = (await request.json()) as InboxShareRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  if (!body.sourceUri || !body.targetProtocols || body.targetProtocols.length === 0) {
    return new Response(JSON.stringify({ error: 'Missing required fields: sourceUri, targetProtocols' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  try {
    const result = await shareCrossNetwork(walletAddress, body, env);
    return noCacheJsonResponse(result);
  } catch (e) {
    console.error('[inbox] share failed:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
