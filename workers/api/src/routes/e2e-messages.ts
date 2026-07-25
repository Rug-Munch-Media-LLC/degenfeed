/**
 * /api/messages/keys — E2E Encryption Key Management & Encrypted Messaging
 *
 * Routes:
 *   POST /api/messages/keys/exchange        — X3DH key exchange
 *   POST /api/messages/keys/rotate          — Rotate key bundle
 *   GET  /api/messages/keys/public/:userId  — Get public key bundle
 *   POST /api/messages/keys/safety-numbers  — Get safety numbers
 *   POST /api/messages/send-encrypted       — Send encrypted message
 *   POST /api/messages/receive-encrypted    — Receive & decrypt
 *   GET  /api/messages/keys/status          — Check if keys exist
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

// ─── POST /api/messages/keys/exchange — X3DH Key Exchange ───────────────

export async function handleKeyExchange(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: { peerId: string };
  try {
    body = (await request.json()) as { peerId: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.peerId) {
    return jsonResponse({ error: 'Missing peerId' }, 400);
  }

  // Check if we have a key bundle
  const { hasKeyBundle, generateKeyBundle } = await import('@degenfeed/crypto');
  if (!(await hasKeyBundle(env, userId))) {
    await generateKeyBundle(env, userId);
  }

  const { initiateConversation, generateSafetyNumbers } = await import('@degenfeed/crypto');

  try {
    const { session: sessionState, usedOtp } = await initiateConversation(env, userId, body.peerId);

    // Generate safety numbers for verification
    const { getIdentityKey } = await import('@degenfeed/crypto');
    const ourIdentityKey = await getIdentityKey(env, userId);
    const theirIdentityKey = await getIdentityKey(env, body.peerId);

    let safetyNumbers = null;
    if (ourIdentityKey && theirIdentityKey) {
      safetyNumbers = await generateSafetyNumbers(ourIdentityKey, theirIdentityKey);
    }

    return noCacheJsonResponse({
      ok: true,
      usedOtp,
      sessionEstablished: true,
      ratchetCount: sessionState.ratchetCount,
      safetyNumbers,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Key exchange failed',
      },
      500,
    );
  }
}

// ─── GET /api/messages/keys/public/:userId — Get Public Key Bundle ──────

export async function handleGetPublicKeys(
  _request: Request,
  env: Env,
  targetUserId: string,
): Promise<Response> {
  const { getKeyBundle } = await import('@degenfeed/crypto');
  const bundle = await getKeyBundle(env, targetUserId);

  if (!bundle) {
    return jsonResponse({ error: 'No key bundle found for user' }, 404);
  }

  return noCacheJsonResponse({ bundle });
}

// ─── POST /api/messages/keys/rotate — Rotate Key Bundle ─────────────────

export async function handleRotateKeys(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  const { rotateKeys } = await import('@degenfeed/crypto');

  try {
    const bundle = await rotateKeys(env, userId);
    return noCacheJsonResponse({
      ok: true,
      message: 'Keys rotated successfully',
      identityKey: bundle.identityKey,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Key rotation failed',
      },
      500,
    );
  }
}

// ─── POST /api/messages/keys/safety-numbers — Get Safety Numbers ───────

export async function handleSafetyNumbers(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: { peerId: string };
  try {
    body = (await request.json()) as { peerId: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.peerId) {
    return jsonResponse({ error: 'Missing peerId' }, 400);
  }

  const { getIdentityKey, generateSafetyNumbers } = await import('@degenfeed/crypto');

  const ourIdentityKey = await getIdentityKey(env, userId);
  const theirIdentityKey = await getIdentityKey(env, body.peerId);

  if (!ourIdentityKey || !theirIdentityKey) {
    return jsonResponse({ error: 'Identity keys not found for one or both users' }, 404);
  }

  const safetyNumbers = await generateSafetyNumbers(ourIdentityKey, theirIdentityKey);

  return noCacheJsonResponse({ safetyNumbers });
}

// ─── POST /api/messages/send-encrypted — Send Encrypted Message ────────

export async function handleSendEncrypted(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: {
    to: string;
    body: string;
    preferredProtocol?: string;
  };
  try {
    body = (await request.json()) as {
      to: string;
      body: string;
      preferredProtocol?: string;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.to || !body.body) {
    return jsonResponse({ error: 'Missing required fields: to, body' }, 400);
  }

  try {
    // 1. Encrypt the message with double ratchet
    const { encryptMessage, hasKeyBundle, generateKeyBundle } = await import('@degenfeed/crypto');

    // Ensure we have keys
    if (!(await hasKeyBundle(env, userId))) {
      await generateKeyBundle(env, userId);
    }

    // Check if session exists, if not initiate key exchange
    const { loadSession, initiateConversation } = await import('@degenfeed/crypto');
    const sessionState = await loadSession(env, userId, body.to);

    if (!sessionState) {
      // Auto-initiate key exchange
      await initiateConversation(env, userId, body.to);
    }

    // Encrypt the message
    const { payload } = await encryptMessage(env, userId, body.to, body.body);

    // 2. Wrap the encrypted payload for transport
    const encryptedBlob = JSON.stringify(payload);

    // 3. Route through the message transport
    const { MessageTransport } = await import('../lib/message-transport');
    const transport = new MessageTransport();
    const transportResults = await transport.route(
      {
        id: crypto.randomUUID(),
        fromId: userId,
        toId: body.to,
        encryptedBlob,
        preferredProtocol: (body.preferredProtocol || 'nostr') as any,
        metadata: {
          sourceProtocol: 'wallet',
          contentType: 'application/vnd.degenfeed.e2e-msg',
        },
      },
      env,
    );

    // 4. Also save to KV conversation history (encrypted form for persistence)
    const { seal } = await import('../lib/crypto-seal');
    const _sealed = await seal(env, body.body, `e2e-msg:${userId}:${body.to}`);

    return noCacheJsonResponse({
      ok: true,
      encrypted: true,
      messageId: payload.deviceId === 'default' ? crypto.randomUUID() : crypto.randomUUID(),
      payloadVersion: payload.version,
      transportResults,
      deliveredTo: transportResults.filter((r) => r.ok).map((r) => r.protocol),
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Encrypted send failed',
      },
      500,
    );
  }
}

// ─── POST /api/messages/receive-encrypted — Receive & Decrypt ─────────

export async function handleReceiveEncrypted(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: {
    fromId: string;
    encryptedPayload: string;
  };
  try {
    body = (await request.json()) as {
      fromId: string;
      encryptedPayload: string;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.fromId || !body.encryptedPayload) {
    return jsonResponse({ error: 'Missing required fields: fromId, encryptedPayload' }, 400);
  }

  try {
    // Parse the encrypted payload
    const payload = JSON.parse(body.encryptedPayload);

    const { decryptMessage } = await import('@degenfeed/crypto');
    const decrypted = await decryptMessage(env, userId, body.fromId, payload);

    return noCacheJsonResponse({
      ok: true,
      plaintext: decrypted.plaintext,
      messageNum: decrypted.messageNum,
      ratchetCount: decrypted.ratchetCount,
      fromSkipped: decrypted.fromSkipped,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Decryption failed',
      },
      500,
    );
  }
}

// ─── GET /api/messages/keys/status — Check Key Status ──────────────────

export async function handleKeyStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  const { hasKeyBundle } = await import('@degenfeed/crypto');
  const hasKeys = await hasKeyBundle(env, userId);

  return noCacheJsonResponse({
    hasKeys,
    userId,
  });
}

// ─── Group Chat Routes ───────────────────────────────────────────────────

export async function handleCreateGroup(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: {
    name: string;
    description?: string;
    members: string[];
    settings?: Record<string, unknown>;
  };
  try {
    body = (await request.json()) as {
      name: string;
      description?: string;
      members: string[];
      settings?: Record<string, unknown>;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.name || !body.members || body.members.length === 0) {
    return jsonResponse({ error: 'Missing name or members' }, 400);
  }

  try {
    const { createGroup } = await import('../lib/group-chat');
    const group = await createGroup(env, userId, body.name, body.description || '', body.members);

    return noCacheJsonResponse({
      ok: true,
      groupId: group.id,
      memberCount: Object.keys(group.senderKeys).length,
      createdAt: group.createdAt,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Group creation failed',
      },
      500,
    );
  }
}

export async function handleGroupInfo(
  request: Request,
  env: Env,
  groupId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  const { decryptGroupInfo, isGroupMember } = await import('../lib/group-chat');

  if (!(await isGroupMember(env, groupId, userId))) {
    return jsonResponse({ error: 'Not a group member' }, 403);
  }

  const info = await decryptGroupInfo(env, groupId, userId);
  if (!info) {
    return jsonResponse({ error: 'Group not found' }, 404);
  }

  return noCacheJsonResponse({
    groupId,
    name: info.name,
    description: info.description,
    members: info.members,
    memberCount: info.members.length,
  });
}

export async function handleGroupSend(
  request: Request,
  env: Env,
  groupId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: { content: string };
  try {
    body = (await request.json()) as { content: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.content) {
    return jsonResponse({ error: 'Missing content' }, 400);
  }

  try {
    const { sendGroupMessage } = await import('../lib/group-chat');
    const msg = await sendGroupMessage(env, groupId, userId, body.content);

    return noCacheJsonResponse({
      ok: true,
      messageId: msg.id,
      createdAt: msg.createdAt,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to send group message',
      },
      500,
    );
  }
}

export async function handleGroupMessages(
  request: Request,
  env: Env,
  groupId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  const { getGroupMessages, isGroupMember, decryptGroupMessage } = await import(
    '../lib/group-chat'
  );

  if (!(await isGroupMember(env, groupId, userId))) {
    return jsonResponse({ error: 'Not a group member' }, 403);
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const before = url.searchParams.get('before')
    ? parseInt(url.searchParams.get('before')!, 10)
    : undefined;

  const messages = await getGroupMessages(env, groupId, Math.min(limit, 100), before);

  // Decrypt each message
  const decryptedMessages = await Promise.all(
    messages.map(async (msg) => {
      const plaintext = await decryptGroupMessage(env, groupId, userId, msg);
      return {
        id: msg.id,
        fromId: msg.fromId,
        content: plaintext || '[Unable to decrypt]',
        createdAt: msg.createdAt,
        senderKeyVersion: msg.senderKeyVersion,
      };
    }),
  );

  return noCacheJsonResponse({
    messages: decryptedMessages,
    total: decryptedMessages.length,
  });
}

export async function handleGroupAddMember(
  request: Request,
  env: Env,
  groupId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: { memberId: string };
  try {
    body = (await request.json()) as { memberId: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.memberId) {
    return jsonResponse({ error: 'Missing memberId' }, 400);
  }

  try {
    const { addGroupMember } = await import('../lib/group-chat');
    await addGroupMember(env, groupId, body.memberId, userId);

    return noCacheJsonResponse({ ok: true, memberAdded: body.memberId });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to add member',
      },
      500,
    );
  }
}

export async function handleGroupRemoveMember(
  request: Request,
  env: Env,
  groupId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  let body: { memberId: string };
  try {
    body = (await request.json()) as { memberId: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.memberId) {
    return jsonResponse({ error: 'Missing memberId' }, 400);
  }

  try {
    const { removeGroupMember } = await import('../lib/group-chat');
    await removeGroupMember(env, groupId, body.memberId, userId);

    return noCacheJsonResponse({ ok: true, memberRemoved: body.memberId });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to remove member',
      },
      500,
    );
  }
}

export async function handleUserGroups(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  const { getUserGroups } = await import('../lib/group-chat');
  const groups = await getUserGroups(env, userId);

  return noCacheJsonResponse({ groups });
}

// ─── Transport Preferences ─────────────────────────────────────────────

export async function handleTransportPrefs(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  if (request.method === 'GET') {
    const { getTransportPreferences } = await import('../lib/message-transport');
    const prefs = await getTransportPreferences(env, userId);
    return noCacheJsonResponse({ preferences: prefs });
  }

  if (request.method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { setTransportPreferences } = await import('../lib/message-transport');
    const merged = await setTransportPreferences(env, userId, body);

    return noCacheJsonResponse({ ok: true, preferences: merged });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

export async function handleGetOfflineMessages(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const userId = session.address.toLowerCase();

  const { MessageTransport } = await import('../lib/message-transport');
  const transport = new MessageTransport();
  const offlineMessages = await transport.getOfflineMessages(env, userId);

  return noCacheJsonResponse({
    messages: offlineMessages,
    count: offlineMessages.length,
  });
}
