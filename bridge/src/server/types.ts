// ─── Types (mirror UnifiedPost shape) ──────────────────────────────────

export interface UnifiedIdentity {
  id: string;
  primary: { protocol: string; id: string };
  handles: Record<string, string | null>;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  links: { label: string; url: string }[];
  keys: Record<string, string | undefined>;
}

export interface UnifiedPost {
  id: string;
  protocol: string;
  author: UnifiedIdentity;
  text: string;
  html?: string;
  embeds: { kind: string; url: string; meta?: Record<string, unknown> }[];
  createdAt: number;
  metrics: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
    views?: number;
    zaps?: number;
  };
  engagement: {
    viewerLiked: boolean;
    viewerReposted: boolean;
    viewerBookmarked: boolean;
    raw: { likes: number; reposts: number; replies: number; quotes: number };
  };
  raw: unknown;
  niches: string[];
  contentType?: string;
}

// ─── Cross-Protocol Event Types ──────────────────────────────────────────

/**
 * UnifiedEvent — event-specific data on top of UnifiedPost.
 * Represents an event from ANY protocol (ATProto/ActivityPub/Nostr/Farcaster).
 */
export interface UnifiedEvent {
  id: string;
  protocol: string;
  title: string;
  description: string;
  beginsOn: string; // ISO 8601
  endsOn?: string;
  location?: {
    name?: string;
    address?: string;
    locality?: string;
    region?: string;
    country?: string;
    streetAddress?: string;
    lat?: number;
    lng?: number;
  };
  onlineAddress?: string;
  isOnline: boolean;
  organizer: UnifiedIdentity;
  tags: string[];
  picture?: { url: string; name?: string };
  url: string;
  rsvpCount: number;
  maxAttendees?: number;
  status: 'confirmed' | 'tentative' | 'cancelled';
  visibility: 'public' | 'unlisted' | 'private';
  categories: string[];
  createdAt: number;
  raw: unknown;
  /** Cross-protocol sync metadata */
  bridgedFrom?: string; // original event ID on source protocol
  bridgedTo?: string[]; // event IDs on bridged protocols
}

/**
 * Smoke Signal AT Protocol event record (events.smokesignal.event)
 */
export interface SmokeSignalEvent {
  name: string;
  description: string;
  startsAt: string; // ISO 8601
  endsAt?: string;
  location?: string;
  url?: string;
  image?: { url: string; alt?: string };
  maxParticipants?: number;
  createdAt: string;
  updatedAt?: string;
  rsvpCount?: number;
  status?: 'active' | 'cancelled' | 'completed';
  [key: string]: unknown;
}

/**
 * Mobilizon GraphQL event response shape
 */
export interface MobilizonEvent {
  id: string;
  title: string;
  uuid: string;
  beginsOn: string;
  endsOn?: string;
  description?: string;
  status?: string;
  visibility?: string;
  tags?: Array<{ id: string; slug: string; title: string }>;
  picture?: { id: string; url: string; name?: string };
  physicalAddress?: {
    description?: string;
    locality?: string;
    region?: string;
    country?: string;
    postalCode?: string;
    streetAddress?: string;
  };
  onlineAddress?: string;
  organizerActor?: { id: string; preferredUsername?: string; name?: string; summary?: string };
  attributedTo?: { id: string; preferredUsername?: string; name?: string; summary?: string };
  options?: {
    maximumAttendeeCapacity?: number;
    remainingAttendeeCapacity?: number;
    showAttendeeCapacity?: boolean;
    isOnline?: boolean;
  };
  contacts?: Array<{ name: string; email: string }>;
}

/**
 * NIP-52 Nostr calendar event (kind 31922)
 */
export interface NostrCalendarEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: 31922;
  tags: string[][];
  content: string;
  sig: string;
  /** Parsed fields */
  title?: string;
  description?: string;
  startUnix?: number;
  endUnix?: number;
  location?: string;
  geohash?: string;
  participants?: string[];
  reference?: string;
}

/**
 * Farcaster event frame cast
 */
export interface FarcasterEventFrame {
  fid: number;
  hash: string;
  text: string;
  embeds: Array<{ url: string }>;
  timestamp: number;
  parentHash?: string;
  parentFid?: number;
  /** Parsed event metadata from OpenGraph/twitter cards */
  eventUrl?: string;
  eventTitle?: string;
  eventDate?: string;
}

/**
 * RSVP record across protocols
 */
export interface RSVPCrossProtocol {
  id: string;
  eventId: string; // UnifiedEvent ID
  attendee: {
    did?: string;
    handle?: string;
    displayName: string;
    avatarUrl?: string;
  };
  response: 'yes' | 'no' | 'maybe' | 'pending';
  protocol: string; // which protocol this RSVP was made on
  protocolRsvpId: string; // native RSVP ID on that protocol
  createdAt: number;
  updatedAt: number;
}

/**
 * CreateEventInput — input for event creation
 */
export interface CreateEventInput {
  title: string;
  description: string;
  beginsOn: string;
  endsOn?: string;
  location?: {
    name?: string;
    address?: string;
    locality?: string;
    region?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
  onlineAddress?: string;
  isOnline?: boolean;
  tags?: string[];
  pictureUrl?: string;
  maxAttendees?: number;
  visibility?: 'public' | 'unlisted' | 'private';
  /** Which protocols to publish to */
  publishTo: string[]; // 'smokesignal', 'mobilizon', 'nostr', 'farcaster'
}

/**
 * SchemaGuard — provider metadata and validation contract.
 * Every provider module MUST export a `schema` of this type.
 */
export interface SchemaGuard {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  requiresAuth: boolean;
  authEnvVar?: string;
  contentType?: string;
}
