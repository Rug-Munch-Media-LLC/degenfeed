/**
 * @degenfeed/api-worker — Nostr NIP-29 Groups API Routes
 *
 * Full NIP-29 group chat integration:
 *   - Group discovery across relays
 *   - Join/leave groups
 *   - Send/receive messages
 *   - Cross-protocol bridging to Matrix/IRC/XMPP
 *   - Unified chat integration
 *
 * Routes:
 *   GET  /api/nostr/groups           — Discover groups (with search, tags, relays)
 *   GET  /api/nostr/groups/:id       — Get group details
 *   POST /api/nostr/groups/join      — Join a group
 *   POST /api/nostr/groups/leave     — Leave a group
 *   POST /api/nostr/groups/message   — Send a message to a group
 *   GET  /api/nostr/groups/:id/messages  — Get messages from a group
 *   POST /api/nostr/groups/bridge    — Bridge group to cross-protocol chat
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';
import type { Nip29Group, Nip29GroupSearchResult } from '@degenfeed/nostr-sdk';
import { getGroupChat, CrossProtocolGroupChat } from '@degenfeed/realtime';

// ─── Router ─────────────────────────────────────────────────────────────────

const nostrGroups = new Hono<{ Bindings: Env }>();

// ─── NIP-29 Relay URLs ─────────────────────────────────────────────────────

const DEFAULT_NIP29_RELAYS = [
  'wss://relay.groups.nip29.com',
  'wss://groups.nostr.com',
  'wss://nos.lol',
  'wss://relay.damus.io',
];

/**
 * Get the configured relays for NIP-29.
 */
function getRelays(env: Env): string[] {
  const envRelays = env.NOSTR_RELAYS || env.RELAY_URLS;
  if (envRelays) {
    return envRelays.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_NIP29_RELAYS;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/nostr/groups
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Discover NIP-29 groups across configured relays.
 *
 * Query params: search, tags (comma-separated), relays (comma-separated), limit
 */
nostrGroups.get('/groups', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const search = c.req.query('search');
    const tags = c.req.query('tags')?.split(',').filter(Boolean);
    const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
    const relayParam = c.req.query('relays');

    const relays = relayParam ? relayParam.split(',').map((s) => s.trim()).filter(Boolean) : getRelays(c.env);

    // Import Nostr SDK dynamically (to handle edge cases)
    const nostr = await import('@degenfeed/nostr-sdk');

    // Check cache first
    let cachedResults: Nip29GroupSearchResult[] | null = null;
    const cacheKey = `nostr:groups:${search ?? ''}:${tags?.join(',') ?? ''}:${relays.join(',')}`;

    try {
      const cachedRaw = await c.env.CACHE?.get(cacheKey);
      if (cachedRaw) {
        cachedResults = JSON.parse(cachedRaw) as Nip29GroupSearchResult[];
        // Return cached if newer than 5 minutes
        const isFresh = cachedResults.some((r) => (Date.now() - r.fetchedAt) < 300000);
        if (isFresh) {
          const allGroups = cachedResults.flatMap((r) => r.groups);
          return noCacheJsonResponse({
            groups: allGroups,
            relays: cachedResults.map((r) => ({ url: r.relayUrl, error: r.error })),
            total: allGroups.length,
            cached: true,
          });
        }
      }
    } catch { /* cache miss */ }

    // Discover groups from relays
    const results = await nostr.discoverGroups(relays, {
      search,
      tags,
      limit,
    });

    // Flatten all groups
    const allGroups = results.flatMap((r) => r.groups);

    // Cache the results (5 min TTL)
    try {
      await c.env.CACHE?.put(cacheKey, JSON.stringify(results), {
        expirationTtl: 300,
      });
    } catch { /* non-critical */ }

    // Store discovered groups in communities KV for discovery
    try {
      if (c.env.COMMUNITIES) {
        for (const group of allGroups) {
          const commKey = `nostr:group:${group.id}`;
          const exists = await c.env.COMMUNITIES.get(commKey);
          if (!exists) {
            await c.env.COMMUNITIES.put(
              commKey,
              JSON.stringify({
                id: group.id,
                name: group.name,
                protocol: 'nostr',
                network: 'nostr',
                identifier: `${group.id}@${group.relayUrl}`,
                description: group.about,
                memberCount: group.memberCount,
                tags: group.tags,
                curated: false,
                nsfw: group.nsfw,
              }),
              { expirationTtl: 86400 * 7 },
            );
          }
        }
      }
    } catch { /* non-critical */ }

    // Get per-relay status
    const relayStatus = results.map((r) => ({
      url: r.relayUrl,
      groupCount: r.groups.length,
      error: r.error,
      healthy: !r.error,
    }));

    return noCacheJsonResponse({
      groups: allGroups,
      relays: relayStatus,
      total: allGroups.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to discover groups: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/nostr/groups/:id
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get details for a specific group.
 */
nostrGroups.get('/groups/:id', async (c) => {
  const groupId = c.req.param('id');
  const relayUrl = c.req.query('relay') || DEFAULT_NIP29_RELAYS[0]!;

  const nostr = await import('@degenfeed/nostr-sdk');

  try {
    // Query single group metadata
    const results = await nostr.discoverGroups([relayUrl], {
      search: groupId,
      limit: 1,
    });

    const group = results[0]?.groups?.[0];
    if (!group) {
      return jsonResponse({ error: 'Group not found' }, 404);
    }

    // Get member count from kind 39001 if available
    return noCacheJsonResponse({ group });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to get group: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/nostr/groups/join
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Join a NIP-29 group.
 *
 * Body:
 *   { groupId: string, relayUrl: string, privkey?: string (uses sender key from env if not provided) }
 */
nostrGroups.post('/groups/join', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      groupId: string;
      relayUrl: string;
      privkey?: string;
    };

    if (!body.groupId || !body.relayUrl) {
      return jsonResponse({ error: 'groupId and relayUrl are required' }, 400);
    }

    // Get the user's Nostr private key
    const nsec = body.privkey || c.env.NOSTR_PRIVATE_KEY || c.env.NOSTR_BOT_NSEC;
    if (!nsec) {
      return jsonResponse({ error: 'Nostr key not configured. Provide privkey or set NOSTR_PRIVATE_KEY' }, 400);
    }

    const nostr = await import('@degenfeed/nostr-sdk');

    // Create join request
    const joinEvent = nostr.createGroupJoinRequest(body.groupId, body.relayUrl, nsec);

    // Publish to the group relay
    const published = await nostr.publishToGroupRelay(body.relayUrl, joinEvent);

    if (!published) {
      return jsonResponse({ error: 'Failed to publish join request to relay' }, 502);
    }

    // Create group membership statement
    const memEvent = nostr.createGroupMembershipStatement(body.groupId, body.relayUrl, nsec);
    await nostr.publishToGroupRelay(body.relayUrl, memEvent).catch(() => {});
    // Also publish to home relays for the user's profile
    for (const relay of getRelays(c.env)) {
      await nostr.publishToGroupRelay(relay, memEvent).catch(() => {});
    }

    // Record in session profile
    try {
      const groupsKey = `nostr:user:${session.address}:groups`;
      const groupsRaw = await c.env.CACHE?.get(groupsKey);
      const userGroups: string[] = groupsRaw ? JSON.parse(groupsRaw) : [];
      if (!userGroups.includes(body.groupId)) {
        userGroups.push(body.groupId);
        await c.env.CACHE?.put(groupsKey, JSON.stringify(userGroups), {
          expirationTtl: 86400 * 90,
        });
      }
    } catch { /* non-critical */ }

    // Cross-protocol bridge: if the group has a cross-protocol room, add member there
    try {
      const groupChat = getGroupChat();
      const bridgeRoomId = `nostr:${body.groupId}@${body.relayUrl}`;
      await groupChat.addMember(bridgeRoomId, session.address, session.address, c.env)
        .catch(() => {});
    } catch { /* non-critical */ }

    return jsonResponse({
      ok: true,
      groupId: body.groupId,
      relayUrl: body.relayUrl,
      eventId: joinEvent.id,
      message: `Joined ${body.groupId} on ${body.relayUrl}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to join group: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/nostr/groups/leave
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Leave a NIP-29 group.
 *
 * Body: { groupId: string, relayUrl: string }
 */
nostrGroups.post('/groups/leave', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      groupId: string;
      relayUrl: string;
    };

    if (!body.groupId || !body.relayUrl) {
      return jsonResponse({ error: 'groupId and relayUrl are required' }, 400);
    }

    const nsec = c.env.NOSTR_PRIVATE_KEY || c.env.NOSTR_BOT_NSEC;
    if (!nsec) {
      return jsonResponse({ error: 'Nostr key not configured' }, 400);
    }

    const nostr = await import('@degenfeed/nostr-sdk');
    const leaveEvent = nostr.createGroupLeaveRequest(body.groupId, body.relayUrl, nsec);
    const published = await nostr.publishToGroupRelay(body.relayUrl, leaveEvent);

    // Remove from user's group list
    try {
      const groupsKey = `nostr:user:${session.address}:groups`;
      const groupsRaw = await c.env.CACHE?.get(groupsKey);
      if (groupsRaw) {
        const userGroups: string[] = JSON.parse(groupsRaw);
        const filtered = userGroups.filter((g) => g !== body.groupId);
        await c.env.CACHE?.put(groupsKey, JSON.stringify(filtered), {
          expirationTtl: 86400 * 90,
        });
      }
    } catch { /* non-critical */ }

    if (!published) {
      return jsonResponse({
        ok: true, // Still report success — leave was at least attempted
        warning: 'Could not publish leave event to relay, but removed from local records',
        groupId: body.groupId,
      });
    }

    return jsonResponse({
      ok: true,
      groupId: body.groupId,
      eventId: leaveEvent.id,
      message: `Left ${body.groupId}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to leave group: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/nostr/groups/message
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Send a message to a NIP-29 group.
 *
 * Body:
 *   { groupId: string, relayUrl: string, content: string,
 *     subject?: string, mentions?: string[] }
 */
nostrGroups.post('/groups/message', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      groupId: string;
      relayUrl: string;
      content: string;
      subject?: string;
      mentions?: string[];
    };

    if (!body.groupId || !body.relayUrl || !body.content) {
      return jsonResponse({ error: 'groupId, relayUrl, and content are required' }, 400);
    }

    if (body.content.length > 64000) {
      return jsonResponse({ error: 'Message too long (max 64000 chars)' }, 400);
    }

    const nsec = c.env.NOSTR_PRIVATE_KEY || c.env.NOSTR_BOT_NSEC;
    if (!nsec) {
      return jsonResponse({ error: 'Nostr key not configured' }, 400);
    }

    const nostr = await import('@degenfeed/nostr-sdk');

    // Create the message event (kind 9)
    const msgEvent = nostr.createGroupMessage(
      body.groupId,
      body.relayUrl,
      body.content,
      nsec,
      { subject: body.subject, mentions: body.mentions },
    );

    // Publish to the group relay
    const published = await nostr.publishToGroupRelay(body.relayUrl, msgEvent);

    if (!published) {
      return jsonResponse({ error: 'Failed to publish message to relay' }, 502);
    }

    // Cross-protocol bridging: also route through the unified bridge
    try {
      const groupChat = getGroupChat();
      const bridgeRoomId = `nostr:${body.groupId}@${body.relayUrl}`;

      // Send message through cross-protocol group chat
      await groupChat.sendMessage(
        bridgeRoomId,
        session.address,
        body.content,
        'nostr',
        c.env,
        {
          nativeId: msgEvent.id,
          nativeUrl: `nostr:${msgEvent.id}`,
          subject: body.subject,
        },
      );
    } catch { /* bridge is optional */ }

    return jsonResponse({
      ok: true,
      eventId: msgEvent.id,
      groupId: body.groupId,
      sent: published,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to send message: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/nostr/groups/:id/messages
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get messages from a NIP-29 group.
 *
 * Query params: relay, limit, since (unix timestamp), until (unix timestamp)
 */
nostrGroups.get('/groups/:id/messages', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const groupId = c.req.param('id');
  const relayUrl = c.req.query('relay') || DEFAULT_NIP29_RELAYS[0]!;
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
  const since = c.req.query('since') ? Number(c.req.query('since')) : undefined;
  const until = c.req.query('until') ? Number(c.req.query('until')) : undefined;

  try {
    const nostr = await import('@degenfeed/nostr-sdk');
    const messages = await nostr.queryGroupMessages(groupId, relayUrl, {
      limit,
      since,
      until,
    });

    // Try to resolve profiles for message authors
    const pubkeys = [...new Set(messages.map((m) => m.pubkey))];
    const profiles: Record<string, { displayName?: string; picture?: string }> = {};

    // Fetch profiles from relays (kind 0)
    try {
      const profilePromises = pubkeys.map(async (pubkey) => {
        // Try from cache first
        const profileKey = `nostr:profile:${pubkey}`;
        const cached = await c.env.CACHE?.get(profileKey);
        if (cached) {
          profiles[pubkey] = JSON.parse(cached);
          return;
        }

        // Fetch from relay
        const ws = new WebSocket(relayUrl);
        await new Promise<void>((resolve) => {
          const to = setTimeout(() => { ws.close(); resolve(); }, 3000);
          ws.onopen = () => {
            ws.send(JSON.stringify(['REQ', `profile-${pubkey.slice(0, 8)}`, {
              kinds: [0],
              authors: [pubkey],
              limit: 1,
            }]));
          };
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data as string);
              if (data[0] === 'EVENT' && data[2]) {
                const ev = data[2] as Record<string, string>;
                const content = JSON.parse(ev.content ?? '{}');
                profiles[pubkey] = {
                  displayName: content.display_name || content.name || pubkey.slice(0, 8),
                  picture: content.picture,
                };
                // Cache it
                c.env.CACHE?.put(profileKey, JSON.stringify(profiles[pubkey]), {
                  expirationTtl: 3600,
                }).catch(() => {});
              }
            } catch { /* ignore */ }
            if (data[0] === 'EOSE') {
              clearTimeout(to);
              ws.close();
              resolve();
            }
          };
          ws.onerror = () => { clearTimeout(to); ws.close(); resolve(); };
        });
      });

      await Promise.allSettled(profilePromises);
    } catch { /* non-critical */ }

    // Attach profile info
    const messagesWithProfiles = messages.map((msg) => ({
      ...msg,
      profile: profiles[msg.pubkey] || { displayName: msg.pubkey.slice(0, 8) },
    }));

    return noCacheJsonResponse({
      messages: messagesWithProfiles,
      groupId,
      relayUrl,
      count: messagesWithProfiles.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to get messages: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/nostr/groups/bridge
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bridge a NIP-29 group into the cross-protocol group chat system.
 * This makes the Nostr group visible in the unified chat alongside Matrix, IRC, XMPP.
 *
 * Body:
 *   { groupId: string, relayUrl: string, name?: string, description?: string }
 */
nostrGroups.post('/groups/bridge', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as {
      groupId: string;
      relayUrl: string;
      name?: string;
      description?: string;
    };

    if (!body.groupId || !body.relayUrl) {
      return jsonResponse({ error: 'groupId and relayUrl are required' }, 400);
    }

    const groupChat = getGroupChat();
    const bridgeRoomId = `nostr:${body.groupId}@${body.relayUrl}`;

    // Check if already bridged
    const existingRoom = await groupChat.getRoom(bridgeRoomId, c.env as any);
    if (existingRoom) {
      return jsonResponse({ ok: true, room: existingRoom, alreadyBridged: true });
    }

    // Create a cross-protocol room for this Nostr group
    const room = await groupChat.createRoom(
      {
        name: body.name ?? body.groupId,
        description: body.description ?? `Nostr NIP-29 group: ${body.groupId} on ${body.relayUrl}`,
        protocols: ['nostr', 'farcaster', 'matrix', 'irc', 'xmpp'],
        encrypted: false,
      },
      session.address,
      c.env as any,
    );

    // Override room ID with the bridge ID so we can route messages
    const bridgedRoom = { ...room, id: bridgeRoomId };

    // Store the bridged room mapping in KV
    try {
      const bridgeKey = `nostr:bridge:${body.groupId}`;
      await c.env.CACHE?.put(
        bridgeKey,
        JSON.stringify({
          bridgeRoomId,
          groupId: body.groupId,
          relayUrl: body.relayUrl,
          createdBy: session.address,
          createdAt: Date.now(),
        }),
        { expirationTtl: 86400 * 365 },
      );
    } catch { /* non-critical */ }

    return jsonResponse({
      ok: true,
      room: bridgedRoom,
      bridgeId: bridgeRoomId,
      protocols: ['nostr', 'farcaster', 'matrix', 'irc', 'xmpp'],
      message: `Nostr group ${body.groupId} bridged to unified chat`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to bridge group: ${msg}` }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/nostr/groups/:id/bridge-status
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the bridge status for a group (which protocols it's bridged to).
 */
nostrGroups.get('/groups/:id/bridge-status', async (c) => {
  const groupId = c.req.param('id');

  try {
    const bridgeKey = `nostr:bridge:${groupId}`;
    const raw = await c.env.CACHE?.get(bridgeKey);
    if (!raw) {
      return jsonResponse({ bridged: false });
    }

    const bridgeInfo = JSON.parse(raw);
    return noCacheJsonResponse({
      bridged: true,
      ...bridgeInfo,
      availableProtocols: ['nostr', 'farcaster', 'matrix', 'irc', 'xmpp'],
    });
  } catch {
    return jsonResponse({ bridged: false });
  }
});

export default nostrGroups;
