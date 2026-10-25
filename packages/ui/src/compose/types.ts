/**
 * @degenfeed/ui — compose targets and shared constants.
 *
 * Single source of truth for the protocols the composer can post to, their
 * character limits, and the protocols the cross-reply bridge can reach.
 */

export interface ComposeTarget {
  id: string;
  label: string;
  enabled: boolean;
  connected: boolean;
  charLimit: number;
  status: 'idle' | 'sending' | 'sent' | 'failed';
  error?: string;
}

export const COMPOSE_TARGETS: Omit<ComposeTarget, 'enabled' | 'connected' | 'status'>[] = [
  { id: 'nostr', label: 'Nostr', charLimit: 50000 },
  { id: 'farcaster', label: 'Farcaster', charLimit: 320 },
  { id: 'lens', label: 'Lens', charLimit: 5000 },
  { id: 'bluesky', label: 'Bluesky', charLimit: 300 },
  { id: 'threads', label: 'Threads', charLimit: 500 },
  { id: 'mastodon', label: 'Mastodon', charLimit: 5000 },
];

/** Global ceiling for the draft textarea. */
export const MAX_CHARS = 50000;

/** Protocols the /api/cross-reply bridge can actually post to. */
export const BRIDGE_REPLY_PROTOCOLS: ReadonlySet<string> = new Set([
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'mastodon',
]);

export const FALLBACK_CHAR_LIMIT = 5000;

/** Character limit for a protocol id, with the reply-mode fallback. */
export function charLimitFor(id: string): number {
  return COMPOSE_TARGETS.find((t) => t.id === id)?.charLimit ?? FALLBACK_CHAR_LIMIT;
}

/** A post already on the schedule, as handed back by the host. */
export interface ScheduledPostItem {
  id: string;
  text: string;
  scheduledAt: string;
  targets: string[];
  createdAt: string;
}

/** Context for cross-protocol reply mode. */
export interface ReplyContext {
  /** The df:// URI of the post being replied to */
  parentPostUri: string;
  /** The protocol the parent post is on */
  parentProtocol: string;
  /** Optional short preview of the parent post text */
  parentPreview?: string;
}
