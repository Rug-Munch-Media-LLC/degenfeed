/**
 * @degenfeed/bluesky-sdk — AT Protocol App Directory
 *
 * Complete directory of AT Protocol ecosystem applications.
 * Users with one Bluesky account (DID) can access ALL AT Protocol apps.
 *
 * @module @degenfeed/bluesky-sdk/atproto-directory
 */

// ─── Types ─────────────────────────────────────────────────────────────

export interface AtProtocolApp {
  /** Unique key for the app (e.g. 'bluesky', 'whitewind') */
  key: string;
  /** Human-readable name */
  name: string;
  /** Short description of what the app does */
  description: string;
  /** Category: microblogging, blogging, link-aggregation, events, video */
  category: AtProtocolAppCategory;
  /** Official app URL */
  url: string;
  /** URL for one-click login (at:// protocol or OAuth) */
  loginUrl?: string;
  /** Icon URL or icon identifier */
  icon: string;
  /** Whether the app is officially launched */
  isLaunched: boolean;
  /** Developer / organization */
  developer: string;
  /** App-specific AT Protocol lexicon namespace */
  lexiconNamespace: string;
  /** Authentication type: 'atproto' | 'oauth' | 'both' */
  authType: 'atproto' | 'oauth' | 'both';
}

export type AtProtocolAppCategory =
  | 'microblogging'
  | 'blogging'
  | 'link-aggregation'
  | 'events'
  | 'video'
  | 'social-reading'
  | 'music'
  | 'development'
  | 'feed-generator'
  | 'labeler'
  | 'analytics'
  | 'search';

export interface AppDirectoryResponse {
  apps: AtProtocolApp[];
  categories: AtProtocolAppCategory[];
  totalApps: number;
  yourIdentity: {
    did: string;
    handle: string;
  };
  /** URIs for one-click login to each app */
  loginUris: Record<string, string>;
}

export interface CrossAppContent {
  /** Unique ID for this content item */
  id: string;
  /** The AT Protocol URI (at://did/collection/rkey) */
  uri: string;
  /** Source app key (e.g. 'bluesky', 'whitewind') */
  sourceApp: string;
  /** Source app name for display */
  sourceAppName: string;
  /** Type of content */
  type: 'post' | 'article' | 'link' | 'event' | 'video';
  /** Author information */
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  /** Title (for articles, links, events) */
  title?: string;
  /** Text content / excerpt */
  text: string;
  /** URL to the content on the native app */
  url?: string;
  /** When it was published (ISO 8601) */
  publishedAt: string;
  /** Engagement metrics */
  metrics?: {
    likes?: number;
    reposts?: number;
    replies?: number;
  };
  /** Badge color for the protocol app */
  badgeColor: string;
}

// ─── Constants ─────────────────────────────────────────────────────────

/**
 * Master list of known AT Protocol applications.
 * One Bluesky account grants access to ALL of these.
 */
export const AT_PROTOCOL_APPS: AtProtocolApp[] = [
  {
    key: 'bluesky',
    name: 'Bluesky',
    description: 'Decentralized microblogging — short posts, photos, and conversations',
    category: 'microblogging',
    url: 'https://bsky.app',
    loginUrl: 'https://bsky.app/login',
    icon: 'bluesky',
    isLaunched: true,
    developer: 'Bluesky Social PBC',
    lexiconNamespace: 'app.bsky',
    authType: 'atproto',
  },
  {
    key: 'whitewind',
    name: 'WhiteWind',
    description: 'Long-form blogging on AT Protocol — write articles, essays, and newsletters',
    category: 'blogging',
    url: 'https://whtwnd.com',
    loginUrl: 'https://whtwnd.com/oauth',
    icon: 'whitewind',
    isLaunched: true,
    developer: '@alice.bsky.social',
    lexiconNamespace: 'com.whtwnd',
    authType: 'oauth',
  },
  {
    key: 'frontpage',
    name: 'Frontpage',
    description: 'Link aggregation and community discussions, like Reddit on AT Protocol',
    category: 'link-aggregation',
    url: 'https://frontpage.fyi',
    loginUrl: 'https://frontpage.fyi/login',
    icon: 'frontpage',
    isLaunched: true,
    developer: '@shreyan.bsky.social',
    lexiconNamespace: 'fyi.frontpage',
    authType: 'oauth',
  },
  {
    key: 'smokesignal',
    name: 'Smoke Signal',
    description: 'Event planning and discovery — create, share, and RSVP to events',
    category: 'events',
    url: 'https://smokesignal.events',
    loginUrl: 'https://smokesignal.events/login',
    icon: 'smokesignal',
    isLaunched: true,
    developer: '@jaz.bsky.social',
    lexiconNamespace: 'events.smokesignal',
    authType: 'oauth',
  },
  {
    key: 'skylight',
    name: 'Skylight',
    description: 'Decentralized video platform — upload, share, and discover videos',
    category: 'video',
    url: 'https://skylight.social',
    loginUrl: 'https://skylight.social/login',
    icon: 'skylight',
    isLaunched: false,
    developer: 'Skylight Team',
    lexiconNamespace: 'social.skylight',
    authType: 'oauth',
  },
  {
    key: 'deckblue',
    name: 'DeckBlue',
    description: 'Multi-column Bluesky client for power users — tweetdeck-style interface',
    category: 'microblogging',
    url: 'https://deck.blue',
    loginUrl: 'https://deck.blue/login',
    icon: 'deckblue',
    isLaunched: true,
    developer: '@deck.blue',
    lexiconNamespace: 'app.bsky',
    authType: 'atproto',
  },
  {
    key: 'graze',
    name: 'Graze',
    description: 'Curated feed browser — browse and subscribe to custom feeds',
    category: 'feed-generator',
    url: 'https://graze.social',
    loginUrl: 'https://graze.social/login',
    icon: 'graze',
    isLaunched: true,
    developer: '@graze.social',
    lexiconNamespace: 'app.bsky',
    authType: 'atproto',
  },
  {
    key: 'labelbase',
    name: 'Labelbase',
    description: 'Community labeling service — label and moderate content collaboratively',
    category: 'labeler',
    url: 'https://labelbase.app',
    loginUrl: 'https://labelbase.app/login',
    icon: 'labelbase',
    isLaunched: true,
    developer: '@emily.bsky.social',
    lexiconNamespace: 'app.bsky.labeler',
    authType: 'oauth',
  },
  {
    key: 'bskysearch',
    name: 'BskySearch',
    description: 'Full-text search for Bluesky and AT Protocol content',
    category: 'search',
    url: 'https://bskysearch.app',
    loginUrl: 'https://bskysearch.app/login',
    icon: 'bskysearch',
    isLaunched: true,
    developer: '@skymaker.bsky.social',
    lexiconNamespace: 'app.bsky',
    authType: 'oauth',
  },
  {
    key: 'tangent',
    name: 'Tangent',
    description: 'Threaded discussions and long conversations with rich threading',
    category: 'microblogging',
    url: 'https://tangent.app',
    loginUrl: 'https://tangent.app/login',
    icon: 'tangent',
    isLaunched: true,
    developer: '@tangent.app',
    lexiconNamespace: 'app.bsky',
    authType: 'oauth',
  },
  {
    key: 'skyfleet',
    name: 'SkyFleet',
    description: 'Community groups and private communities on AT Protocol',
    category: 'social-reading',
    url: 'https://skyfleet.app',
    loginUrl: 'https://skyfleet.app/login',
    icon: 'skyfleet',
    isLaunched: true,
    developer: '@skyfleet.app',
    lexiconNamespace: 'com.skyfleet',
    authType: 'oauth',
  },
  {
    key: 'clocktower',
    name: 'Clocktower',
    description: 'Music sharing and discovery on AT Protocol',
    category: 'music',
    url: 'https://clocktower.app',
    loginUrl: 'https://clocktower.app/login',
    icon: 'clocktower',
    isLaunched: true,
    developer: '@clocktower.app',
    lexiconNamespace: 'app.clocktower',
    authType: 'oauth',
  },
  {
    key: 'degenfeed',
    name: 'DegenFeed',
    description: 'Crypto-native social discovery and on-chain content feeds',
    category: 'feed-generator',
    url: 'https://app.degenfeed.xyz',
    loginUrl: 'https://app.degenfeed.xyz/bluesky/connect',
    icon: 'degenfeed',
    isLaunched: true,
    developer: 'Rug Munch Media LLC',
    lexiconNamespace: 'xyz.degenfeed',
    authType: 'atproto',
  },
  {
    key: 'hueview',
    name: 'HueView',
    description: 'Photo and album sharing — Instagram alternative on AT Protocol',
    category: 'microblogging',
    url: 'https://hueview.app',
    loginUrl: 'https://hueview.app/login',
    icon: 'hueview',
    isLaunched: true,
    developer: '@hueview.app',
    lexiconNamespace: 'app.hueview',
    authType: 'oauth',
  },
];

/**
 * Category display metadata.
 */
export const APP_CATEGORIES: Record<AtProtocolAppCategory, { label: string; icon: string }> = {
  microblogging: { label: 'Microblogging', icon: 'message-square' },
  blogging: { label: 'Blogging', icon: 'file-text' },
  'link-aggregation': { label: 'Link Aggregation', icon: 'link' },
  events: { label: 'Events', icon: 'calendar' },
  video: { label: 'Video', icon: 'video' },
  'social-reading': { label: 'Social Reading', icon: 'book-open' },
  music: { label: 'Music', icon: 'music' },
  development: { label: 'Development', icon: 'code' },
  'feed-generator': { label: 'Feed Generator', icon: 'rss' },
  labeler: { label: 'Labeler', icon: 'tag' },
  analytics: { label: 'Analytics', icon: 'bar-chart' },
  search: { label: 'Search', icon: 'search' },
};

/**
 * Badge colors for each app (for UI).
 */
export const APP_BADGE_COLORS: Record<string, string> = {
  bluesky: '#0285FF',
  whitewind: '#8B5CF6',
  frontpage: '#10B981',
  smokesignal: '#F59E0B',
  skylight: '#EF4444',
  deckblue: '#3B82F6',
  graze: '#6366F1',
  labelbase: '#EC4899',
  bskysearch: '#14B8A6',
  tangent: '#A855F7',
  skyfleet: '#06B6D4',
  clocktower: '#F97316',
  degenfeed: '#22C55E',
  hueview: '#E879F9',
};

// ─── App Directory Functions ───────────────────────────────────────────

/**
 * Get the full AT Protocol app directory.
 * Optionally filter by category.
 */
export function getAppDirectory(category?: AtProtocolAppCategory): AtProtocolApp[] {
  if (!category) return [...AT_PROTOCOL_APPS];
  return AT_PROTOCOL_APPS.filter((app) => app.category === category);
}

/**
 * Get a specific app by its key.
 */
export function getAppByKey(key: string): AtProtocolApp | undefined {
  return AT_PROTOCOL_APPS.find((app) => app.key === key);
}

/**
 * Get all available categories.
 */
export function getAppCategories(): AtProtocolAppCategory[] {
  return Object.keys(APP_CATEGORIES) as AtProtocolAppCategory[];
}

/**
 * Build one-click login URIs for a user based on their DID.
 * Each AT Protocol app can be logged into using the user's DID
 * and the app's specific authentication mechanism.
 */
export function buildLoginUris(did: string, handle: string): Record<string, string> {
  const uris: Record<string, string> = {};

  for (const app of AT_PROTOCOL_APPS) {
    if (!app.isLaunched) continue;

    if (app.authType === 'atproto') {
      // AT Protocol native auth — uses at:// protocol
      uris[app.key] = `at://${did}/app.${app.lexiconNamespace}/login`;
    } else {
      // OAuth-based login — pass DID as identity hint
      const baseUrl = app.loginUrl || app.url;
      const separator = baseUrl.includes('?') ? '&' : '?';
      uris[app.key] =
        `${baseUrl}${separator}did=${encodeURIComponent(did)}&handle=${encodeURIComponent(handle)}`;
    }
  }

  return uris;
}

/**
 * Build the full app directory response for a user.
 */
export function buildAppDirectoryResponse(
  did: string,
  handle: string,
  category?: AtProtocolAppCategory,
): AppDirectoryResponse {
  const apps = getAppDirectory(category);
  const loginUris = buildLoginUris(did, handle);

  return {
    apps,
    categories: getAppCategories(),
    totalApps: apps.length,
    yourIdentity: { did, handle },
    loginUris,
  };
}
