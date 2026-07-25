/**
 * @degenfeed/nostr-sdk — NIP-29 Group Chat Protocol
 *
 * Full NIP-29 implementation for Nostr group chat.
 * Handles group discovery, membership, messaging, and moderation.
 *
 * NIP-29 defines group chat on Nostr relays:
 *   - Kind 9: Group chat message
 *   - Kind 10: Group chat thread reply
 *   - Kind 11: Group thread (root)
 *   - Kind 12: Group reply
 *   - Kind 39000: Group metadata
 *   - Kind 39001: Group member list
 *   - Kind 39002: Group admin list
 *   - Kind 39003: Group moderation events
 *   - Kind 9000-9007: Join/leave/ moderation requests
 *   - Kind 9021: User group membership
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/29.md
 */

import type { NostrEvent } from './event';
import { getPublicKey, signEvent } from './event';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Nip29Group {
  /** Group ID (unique within a relay) */
  id: string;
  /** Relay URL where the group lives */
  relayUrl: string;
  /** Group display name */
  name: string;
  /** Group picture URL */
  picture?: string;
  /** Group description/about */
  about?: string;
  /** Group type: 'public' | 'private' | 'closed' */
  accessType: 'public' | 'private' | 'closed';
  /** List of moderators (pubkeys) */
  moderators: string[];
  /** List of members (pubkeys) */
  members: string[];
  /** Number of active members */
  memberCount: number;
  /** When the group was created */
  createdAt: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Group topics/tags */
  tags: string[];
  /** Whether the NSFW */
  nsfw: boolean;
  /** Whether this group is curated/official */
  curated: boolean;
}

export interface Nip29Message {
  /** Event ID */
  id: string;
  /** Group ID */
  groupId: string;
  /** Relay URL */
  relayUrl: string;
  /** Author pubkey */
  pubkey: string;
  /** Message content */
  content: string;
  /** Unix timestamp in seconds */
  createdAt: number;
  /** Kind: 9 (message), 10 (reply), 11 (thread), 12 (reply) */
  kind: 9 | 10 | 11 | 12;
  /** Thread ID (for replies) */
  threadId?: string;
  /** Root event ID (for threads) */
  rootId?: string;
  /** Mentioned pubkeys */
  mentions: string[];
  /** Subject (for threads) */
  subject?: string;
}

export interface Nip29GroupMember {
  pubkey: string;
  role: 'member' | 'moderator' | 'admin' | 'owner';
  joinedAt: number;
  displayName?: string;
  picture?: string;
}

export interface Nip29GroupSearchResult {
  groups: Nip29Group[];
  relayUrl: string;
  fetchedAt: number;
  error?: string;
}

// ─── Group Discovery ──────────────────────────────────────────────────────

const DEFAULT_GROUP_RELAYS = [
  'wss://relay.groups.nip29.com',
  'wss://groups.nostr.com',
  'wss://relay.damus.io',
  'wss://nos.lol',
];

/**
 * Discover NIP-29 groups from a set of relays.
 * Queries kind 39000 (group metadata) events.
 */
export async function discoverGroups(
  relays: string[] = DEFAULT_GROUP_RELAYS,
  options: {
    search?: string;
    tags?: string[];
    limit?: number;
    timeoutMs?: number;
    relayUrls?: string;
  } = {},
): Promise<Nip29GroupSearchResult[]> {
  const limit = options.limit ?? 20;
  const timeoutMs = options.timeoutMs ?? 8000;
  const search = options.search?.toLowerCase();
  const tags = options.tags?.map((t) => t.toLowerCase()) ?? [];

  // Use provided relay URLs
  const relayList = relays;

  const results: Nip29GroupSearchResult[] = [];

  for (const relayUrl of relayList) {
    try {
      const groups = await discoverGroupsFromRelay(relayUrl, {
        search,
        tags,
        limit,
        timeoutMs,
      });
      results.push({
        groups,
        relayUrl,
        fetchedAt: Date.now(),
      });
    } catch (err) {
      results.push({
        groups: [],
        relayUrl,
        fetchedAt: Date.now(),
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Discover groups from a single relay.
 */
async function discoverGroupsFromRelay(
  relayUrl: string,
  options: {
    search?: string;
    tags?: string[];
    limit: number;
    timeoutMs: number;
  },
): Promise<Nip29Group[]> {
  const { search, tags, limit, timeoutMs } = options;

  const ws = new WebSocket(relayUrl);
  const groups: Nip29Group[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Timeout discovering groups on ${relayUrl}`));
      }, timeoutMs);

      ws.onopen = () => {
        // Subscribe to group metadata events
        ws.send(
          JSON.stringify([
            'REQ',
            `discover-${relayUrl.replace(/[^a-zA-Z0-9]/g, '-')}`,
            { kinds: [39000], limit: Math.min(limit * 2, 100) },
          ]),
        );
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as unknown[];
          if (!Array.isArray(data)) return;

          const [type, , ...rest] = data;

          if (type === 'EVENT' && rest.length >= 1) {
            const ev = rest[0] as Record<string, unknown>;
            if (typeof ev !== 'object' || !ev) return;

            const content = ev.content as string | undefined;
            if (!content) return;

            let meta: Record<string, unknown> = {};
            try {
              meta = JSON.parse(content);
            } catch {
              /* ignore */
            }

            const groupId = (ev.tags as string[][])?.find((t: string[]) => t[0] === 'd')?.[1] ?? '';
            const name = (meta.name as string) || groupId;
            const picture = meta.picture as string | undefined;
            const about = meta.about as string | undefined;
            const accessType = ((meta.access as string) || 'public') as
              | 'public'
              | 'private'
              | 'closed';
            const nsfw = meta.nsfw === true || meta.nsfw === 'true';

            // Extract tags from content or event tags
            const groupTags: string[] = [];
            for (const tag of (ev.tags as string[][]) ?? []) {
              if (tag[0] === 't') groupTags.push(tag[1] ?? '');
            }
            if (meta.tags && Array.isArray(meta.tags)) {
              for (const t of meta.tags) {
                if (typeof t === 'string' && !groupTags.includes(t)) groupTags.push(t);
              }
            }

            // Search filter
            if (search) {
              const searchable = `${name} ${about ?? ''} ${groupTags.join(' ')}`.toLowerCase();
              if (!searchable.includes(search)) return;
            }

            // Tag filter
            const filterTags = tags ?? [];
            if (filterTags.length > 0) {
              const hasTag = filterTags.some((t) =>
                groupTags.some((gt) => gt.toLowerCase().includes(t)),
              );
              if (!hasTag) return;
            }

            groups.push({
              id: groupId,
              relayUrl,
              name,
              picture,
              about,
              accessType,
              moderators: [],
              members: [],
              memberCount:
                (ev.tags as string[][])?.filter((t: string[]) => t[0] === 'p').length ?? 0,
              createdAt: (ev.created_at as number) ?? 0,
              lastActivity: (ev.created_at as number) ?? 0,
              tags: groupTags,
              nsfw,
              curated: false,
            });
          }

          if (type === 'EOSE') {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`WebSocket error for ${relayUrl}`));
      };
    });
  } catch {
    // Return whatever we found
  }

  return groups.slice(0, limit);
}

// ─── Group Membership ─────────────────────────────────────────────────────

/**
 * Create a join group request event (kind 9000).
 */
export function createGroupJoinRequest(
  groupId: string,
  relayUrl: string,
  privkey: string,
): NostrEvent {
  return signEvent(
    {
      pubkey: getPublicKey(privkey),
      created_at: Math.floor(Date.now() / 1000),
      kind: 9000,
      tags: [
        ['h', groupId],
        ['relay', relayUrl],
      ],
      content: '',
    },
    privkey,
  );
}

/**
 * Create a leave group event (kind 9001).
 */
export function createGroupLeaveRequest(
  groupId: string,
  relayUrl: string,
  privkey: string,
): NostrEvent {
  return signEvent(
    {
      pubkey: getPublicKey(privkey),
      created_at: Math.floor(Date.now() / 1000),
      kind: 9001,
      tags: [
        ['h', groupId],
        ['relay', relayUrl],
      ],
      content: '',
    },
    privkey,
  );
}

/**
 * Create a group membership statement (kind 9021).
 * Proves the user is a member of a group for clients.
 */
export function createGroupMembershipStatement(
  groupId: string,
  relayUrl: string,
  privkey: string,
): NostrEvent {
  return signEvent(
    {
      pubkey: getPublicKey(privkey),
      created_at: Math.floor(Date.now() / 1000),
      kind: 9021,
      tags: [
        ['h', groupId],
        ['relay', relayUrl],
      ],
      content: '',
    },
    privkey,
  );
}

// ─── Group Messaging ─────────────────────────────────────────────────────

/**
 * Create a group chat message (kind 9).
 */
export function createGroupMessage(
  groupId: string,
  relayUrl: string,
  content: string,
  privkey: string,
  options?: {
    subject?: string;
    mentions?: string[];
  },
): NostrEvent {
  const tags: string[][] = [
    ['h', groupId],
    ['relay', relayUrl],
  ];

  if (options?.subject) {
    tags.push(['subject', options.subject]);
  }
  if (options?.mentions) {
    for (const mention of options.mentions) {
      tags.push(['p', mention]);
    }
  }

  return signEvent(
    {
      pubkey: getPublicKey(privkey),
      created_at: Math.floor(Date.now() / 1000),
      kind: 9,
      tags,
      content,
    },
    privkey,
  );
}

/**
 * Create a group thread root message (kind 11).
 */
export function createGroupThread(
  groupId: string,
  relayUrl: string,
  subject: string,
  content: string,
  privkey: string,
): NostrEvent {
  return signEvent(
    {
      pubkey: getPublicKey(privkey),
      created_at: Math.floor(Date.now() / 1000),
      kind: 11,
      tags: [
        ['h', groupId],
        ['relay', relayUrl],
        ['subject', subject],
      ],
      content,
    },
    privkey,
  );
}

/**
 * Create a group reply to thread (kind 12).
 */
export function createGroupReply(
  groupId: string,
  relayUrl: string,
  threadRootEventId: string,
  content: string,
  privkey: string,
): NostrEvent {
  return signEvent(
    {
      pubkey: getPublicKey(privkey),
      created_at: Math.floor(Date.now() / 1000),
      kind: 12,
      tags: [
        ['h', groupId],
        ['relay', relayUrl],
        ['e', threadRootEventId],
      ],
      content,
    },
    privkey,
  );
}

// ─── Group Moderation ────────────────────────────────────────────────────

/**
 * Create a group moderation event (kind 9006 — remove user).
 */
export function createRemoveUserEvent(
  groupId: string,
  relayUrl: string,
  targetPubkey: string,
  reason: string,
  privkey: string,
): NostrEvent {
  return signEvent(
    {
      pubkey: getPublicKey(privkey),
      created_at: Math.floor(Date.now() / 1000),
      kind: 9006,
      tags: [
        ['h', groupId],
        ['relay', relayUrl],
        ['p', targetPubkey],
      ],
      content: reason,
    },
    privkey,
  );
}

/**
 * Create a group metadata update event (kind 39000).
 */
export function createGroupMetadataEvent(
  groupId: string,
  relayUrl: string,
  metadata: {
    name?: string;
    about?: string;
    picture?: string;
    access?: string;
    nsfw?: boolean;
  },
  privkey: string,
): NostrEvent {
  return signEvent(
    {
      pubkey: getPublicKey(privkey),
      created_at: Math.floor(Date.now() / 1000),
      kind: 39000,
      tags: [
        ['d', groupId],
        ['relay', relayUrl],
      ],
      content: JSON.stringify(metadata),
    },
    privkey,
  );
}

// ─── Query Groups ─────────────────────────────────────────────────────────

/**
 * Query group messages from a relay (kind 9, 11, 12).
 */
export async function queryGroupMessages(
  groupId: string,
  relayUrl: string,
  options: {
    limit?: number;
    since?: number;
    until?: number;
    timeoutMs?: number;
  } = {},
): Promise<Nip29Message[]> {
  const limit = options.limit ?? 50;
  const timeoutMs = options.timeoutMs ?? 8000;

  const ws = new WebSocket(relayUrl);
  const messages: Nip29Message[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Timeout fetching messages from ${relayUrl}`));
      }, timeoutMs);

      ws.onopen = () => {
        const filter: Record<string, unknown> = {
          kinds: [9, 11, 12],
          limit,
          '#h': [groupId],
        };
        if (options.since) filter.since = options.since;
        if (options.until) filter.until = options.until;

        ws.send(JSON.stringify(['REQ', `msgs-${groupId}-${Date.now()}`, filter]));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string) as unknown[];
          if (!Array.isArray(data)) return;

          const [type, , ...rest] = data;

          if (type === 'EVENT' && rest.length >= 1) {
            const ev = rest[0] as Record<string, unknown>;
            if (typeof ev !== 'object' || !ev) return;

            const tags = (ev.tags as string[][]) ?? [];

            const message: Nip29Message = {
              id: ev.id as string,
              groupId,
              relayUrl,
              pubkey: ev.pubkey as string,
              content: ev.content as string,
              createdAt: ev.created_at as number,
              kind: ev.kind as 9 | 10 | 11 | 12,
              mentions: tags
                .filter((t) => t[0] === 'p')
                .map((t) => t[1] ?? '')
                .filter(Boolean),
              threadId: tags.find((t) => t[0] === 'e' && t[3] === 'reply')?.[1],
              rootId:
                tags.find((t) => t[0] === 'e' && t[3] === 'root')?.[1] ??
                tags.find((t) => t[0] === 'e')?.[1],
              subject: tags.find((t) => t[0] === 'subject')?.[1],
            };

            messages.push(message);
          }

          if (type === 'EOSE') {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`WebSocket error for ${relayUrl}`));
      };
    });
  } catch {
    // Return what we have
  }

  return messages.sort((a, b) => a.createdAt - b.createdAt).slice(-limit);
}

/**
 * Publish an event to a NIP-29 relay.
 */
export async function publishToGroupRelay(
  relayUrl: string,
  event: NostrEvent,
  timeoutMs = 5000,
): Promise<boolean> {
  const ws = new WebSocket(relayUrl);

  try {
    return await new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timeout publishing to relay'));
      }, timeoutMs);

      ws.onopen = () => {
        ws.send(JSON.stringify(['EVENT', event]));
      };

      ws.onmessage = (msgEvent: MessageEvent) => {
        try {
          const data = JSON.parse(msgEvent.data as string) as unknown[];
          if (!Array.isArray(data)) return;

          if (data[0] === 'OK' && data[1] === event.id) {
            clearTimeout(timeout);
            ws.close();
            resolve(data[2] === true || (typeof data[2] === 'string' && data[2] === ''));
          }
        } catch {
          /* ignore */
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        ws.close();
        reject(new Error('WebSocket error'));
      };
    });
  } catch {
    return false;
  }
}
