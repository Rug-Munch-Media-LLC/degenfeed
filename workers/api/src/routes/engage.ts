import { BskyClient } from '@degenfeed/bluesky-sdk';
import { HubClient } from '@degenfeed/farcaster-sdk';
import { LensClient } from '@degenfeed/lens-sdk';
import { GtSClient } from '@degenfeed/mastodon-sdk';
import { ThreadsClient } from '@degenfeed/threads-sdk';
import type { EngagementAction } from '@degenfeed/types';
import {
  BSKY_SOCIAL,
  type Env,
  FARCASTER_HUBS,
  jsonResponse,
  LENS_APIS,
  THREADS_PUBLIC,
} from '../index';
import { hasSuspiciousPayload, isAllowedProtocol, sanitizeString } from '../sanitize';

const ALLOWED_ACTIONS = new Set<EngagementAction>([
  'like',
  'unlike',
  'repost',
  'unrepost',
  'bookmark',
  'unbookmark',
  'reply',
  'react',
]);

interface EngageRequest {
  action?: string;
  postId?: string;
  protocol?: string;
  target?: { authorId?: string; publicationId?: string };
  content?: string;
  reaction?: string;
  auth?: Record<string, string>;
  authToken?: string;
}

function noAccountError(protocol: string): { ok: false; error: string } {
  return { ok: false, error: `No social account linked for ${protocol}` };
}

function nativeIdFromPostId(postId: string, protocol: string): string {
  const prefix = `${protocol}:`;
  if (postId.startsWith(prefix)) return postId.slice(prefix.length);
  return postId;
}

export async function handleEngage(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const body: EngageRequest = (await request.json()) as EngageRequest;
    const action = sanitizeString(body.action, 32) as EngagementAction;
    const postId = sanitizeString(body.postId, 256);
    const protocol = sanitizeString(body.protocol, 32);

    if (
      !action ||
      !postId ||
      !protocol ||
      !isAllowedProtocol(protocol) ||
      !ALLOWED_ACTIONS.has(action) ||
      hasSuspiciousPayload(`${action}${postId}${protocol}`)
    ) {
      return jsonResponse({ ok: false, error: 'action, postId, protocol required' }, 400);
    }

    const content = sanitizeString(body.content, 10000);
    const reaction = sanitizeString(body.reaction, 16);
    const target = {
      authorId: sanitizeString(body.target?.authorId, 256),
      publicationId: sanitizeString(body.target?.publicationId, 256),
    };
    const auth = body.auth ?? {};
    const nativeId = nativeIdFromPostId(postId, protocol);

    switch (protocol) {
      case 'nostr':
        return handleNostr(action, nativeId, target, content, reaction, auth, env);
      case 'farcaster':
        return handleFarcaster(action, nativeId, target, content, reaction, auth, env);
      case 'lens':
        return handleLens(action, nativeId, target, content, reaction, auth, env);
      case 'bluesky':
        return handleBluesky(action, nativeId, target, content, reaction, auth, env);
      case 'threads':
        return handleThreads(action, nativeId, target, content, reaction, auth, env);
      case 'mastodon':
        return handleMastodon(action, nativeId, target, content, reaction, auth, env);
      default:
        return jsonResponse({ ok: false, error: `${protocol} not supported` }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return jsonResponse({ ok: false, error: message }, 500);
  }
}

function handleNostr(
  _action: EngagementAction,
  _eventId: string,
  _target: { authorId: string; publicationId: string },
  _content: string,
  _reaction: string,
  _auth: Record<string, string>,
  _env: Env,
): Response {
  // SECURITY: Server-side nsec no longer accepted (2026-07-13).
  // Clients must sign engagement events locally using @degenfeed/nostr-sdk
  // and submit pre-signed events. Raw nsec in request body is rejected.
  return jsonResponse(
    {
      ok: false,
      error: 'Server-side Nostr signing is deprecated.',
      detail: 'Sign engagement events client-side using @degenfeed/nostr-sdk.',
      migration: 'Use the client-side engageNostr() in apps/web/src/lib/nostr.ts',
      docs: 'https://degenfeed.xyz/docs/nostr-publish',
    },
    410,
  );
}

async function handleFarcaster(
  _action: EngagementAction,
  _castHash: string,
  _target: { authorId: string; publicationId: string },
  _content: string,
  _reaction: string,
  auth: Record<string, string>,
  env: Env,
): Promise<Response> {
  const signedMessage = auth.farcaster_message ?? '';
  if (!signedMessage) {
    return jsonResponse(noAccountError('farcaster'), 401);
  }

  const hubUrl = env.FARCASTER_HUB_URL || FARCASTER_HUBS[0];
  const client = new HubClient(hubUrl);

  try {
    await client.submitMessage(signedMessage);
    return jsonResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Farcaster engagement failed';
    return jsonResponse({ ok: false, error: message }, 500);
  }
}

async function handleLens(
  action: EngagementAction,
  publicationId: string,
  _target: { authorId: string; publicationId: string },
  content: string,
  _reaction: string,
  auth: Record<string, string>,
  env: Env,
): Promise<Response> {
  const token = auth.lens ?? auth.accessToken ?? '';
  if (!token) {
    return jsonResponse(noAccountError('lens'), 401);
  }

  const client = new LensClient(env.LENS_API_URL || LENS_APIS[0]);
  client.setAuth(token);

  try {
    if (action === 'like') {
      await client.like(publicationId);
    } else if (action === 'unlike') {
      await client.unlike(publicationId);
    } else if (action === 'repost') {
      await client.mirror(publicationId);
    } else if (action === 'unrepost') {
      await client.unmirror(publicationId);
    } else if (action === 'reply') {
      await client.comment(publicationId, content);
    } else {
      return jsonResponse({ ok: false, error: `${action} not supported on lens` }, 400);
    }
    return jsonResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lens engagement failed';
    return jsonResponse({ ok: false, error: message }, 500);
  }
}

async function handleBluesky(
  action: EngagementAction,
  uri: string,
  target: { authorId: string; publicationId: string },
  content: string,
  _reaction: string,
  auth: Record<string, string>,
  env: Env,
): Promise<Response> {
  const jwt = auth.bluesky ?? auth.accessJwt ?? '';
  const did = auth.bluesky_did ?? auth.did ?? target.authorId ?? '';
  if (!jwt || !did) {
    return jsonResponse(noAccountError('bluesky'), 401);
  }

  const cid = target.publicationId || '';
  const client = new BskyClient(env.BSKY_SOCIAL_URL || BSKY_SOCIAL);
  client.setAuth(jwt);

  try {
    if (action === 'like') {
      await client.like(uri, cid, did);
    } else if (action === 'unlike') {
      await client.unlike(uri, did);
    } else if (action === 'repost') {
      await client.repost(uri, cid, did);
    } else if (action === 'unrepost') {
      await client.unrepost(uri, did);
    } else if (action === 'reply') {
      await client.reply(uri, cid, did, content);
    } else {
      return jsonResponse({ ok: false, error: `${action} not supported on bluesky` }, 400);
    }
    return jsonResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bluesky engagement failed';
    return jsonResponse({ ok: false, error: message }, 500);
  }
}

async function handleThreads(
  action: EngagementAction,
  uri: string,
  target: { authorId: string; publicationId: string },
  content: string,
  _reaction: string,
  auth: Record<string, string>,
  _env: Env,
): Promise<Response> {
  const jwt = auth.threads ?? auth.accessJwt ?? '';
  const did = auth.threads_did ?? auth.did ?? target.authorId ?? '';
  if (!jwt || !did) {
    return jsonResponse(noAccountError('threads'), 401);
  }

  const cid = target.publicationId || '';
  const client = new ThreadsClient(THREADS_PUBLIC);
  client.setAuth(jwt);

  try {
    if (action === 'like') {
      await client.like(uri, cid, did);
    } else if (action === 'unlike') {
      await client.unlike(uri, did);
    } else if (action === 'repost') {
      await client.repost(uri, cid, did);
    } else if (action === 'unrepost') {
      await client.unrepost(uri, did);
    } else if (action === 'reply') {
      await client.reply(uri, cid, did, content);
    } else {
      return jsonResponse({ ok: false, error: `${action} not supported on threads` }, 400);
    }
    return jsonResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Threads engagement failed';
    return jsonResponse({ ok: false, error: message }, 500);
  }
}

async function handleMastodon(
  action: EngagementAction,
  statusId: string,
  _target: { authorId: string; publicationId: string },
  content: string,
  _reaction: string,
  auth: Record<string, string>,
  _env: Env,
): Promise<Response> {
  const instance = auth.mastodon_instance || 'https://social.degenfeed.xyz';
  const token = auth.mastodon ?? auth.authToken ?? '';
  if (!token) {
    return jsonResponse(noAccountError('mastodon'), 401);
  }

  const client = new GtSClient(instance, token);

  try {
    if (action === 'like') {
      await client.like(statusId);
    } else if (action === 'unlike') {
      await client.unlike(statusId);
    } else if (action === 'repost') {
      await client.repost(statusId);
    } else if (action === 'unrepost') {
      await client.unrepost(statusId);
    } else if (action === 'bookmark') {
      await client.bookmark(statusId);
    } else if (action === 'unbookmark') {
      await client.unbookmark(statusId);
    } else if (action === 'reply') {
      await client.publish(content, { inReplyToId: statusId });
    } else {
      return jsonResponse({ ok: false, error: `${action} not supported on mastodon` }, 400);
    }
    return jsonResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Mastodon engagement failed';
    return jsonResponse({ ok: false, error: message }, 500);
  }
}
