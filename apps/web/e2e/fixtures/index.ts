// ═══════════════════════════════════════════════════════════════
// E2E Test Fixtures — Mock data, wallet connections, protocol responses
// ═══════════════════════════════════════════════════════════════

import type { Page } from '@playwright/test';

// ─── Feed fixtures ───────────────────────────────────────────

export const MOCK_FEED_POSTS = {
  data: [
    {
      id: 'post-1',
      protocol: 'nostr',
      text: 'Bitcoin is the future of money!',
      html: '<p>Bitcoin is the future of money!</p>',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      author: {
        id: 'npub1abc',
        displayName: 'Satoshi',
        avatarUrl: '',
        handle: 'satoshi',
        metadata: {},
      },
      embeds: [],
      metrics: { likes: 42, reposts: 10, replies: 5, quotes: 2 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: ['bitcoin'],
      parentId: null,
      raw: {},
    },
    {
      id: 'post-2',
      protocol: 'farcaster',
      text: 'Just deployed my first smart contract on Base 🚀',
      html: '<p>Just deployed my first smart contract on Base 🚀</p>',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      author: {
        id: 'fid:123',
        displayName: 'Builder Guy',
        avatarUrl: '',
        handle: 'builder',
        metadata: {},
      },
      embeds: [],
      metrics: { likes: 128, reposts: 33, replies: 12, quotes: 5 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: ['base', 'solidity'],
      parentId: null,
      raw: {},
    },
    {
      id: 'post-3',
      protocol: 'bluesky',
      text: 'AT Protocol is the most underrated social graph protocol.',
      createdAt: new Date(Date.now() - 10800000).toISOString(),
      author: {
        id: 'did:plc:xyz',
        displayName: 'Protocol Maxi',
        avatarUrl: '',
        handle: 'maxi.bsky.social',
        metadata: {},
      },
      embeds: [],
      metrics: { likes: 67, reposts: 15, replies: 8, quotes: 1 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: ['atproto', 'decentralization'],
      parentId: null,
      raw: {},
    },
    {
      id: 'post-4',
      protocol: 'lens',
      text: 'Lens Protocol v3 is going to change everything for social graphs.',
      html: '<p>Lens Protocol v3 is going to change everything for social graphs.</p>',
      createdAt: new Date(Date.now() - 14400000).toISOString(),
      author: {
        id: 'lens:0x1234',
        displayName: 'Lens Maxi',
        avatarUrl: '',
        handle: 'lensmaxi',
        metadata: {},
      },
      embeds: [{ kind: 'image', url: 'https://cdn.degenfeed.xyz/lens-v3.png' }],
      metrics: { likes: 89, reposts: 22, replies: 15, quotes: 3 },
      engagement: { viewerLiked: true, viewerReposted: false, viewerBookmarked: true },
      niches: ['lens', 'web3'],
      parentId: null,
      raw: {},
    },
    {
      id: 'post-5',
      protocol: 'mastodon',
      text: 'Fediverse is growing faster than ever. Decentralize everything!',
      createdAt: new Date(Date.now() - 18000000).toISOString(),
      author: {
        id: 'mastodon:user1',
        displayName: 'Fediverse Fan',
        avatarUrl: '',
        handle: 'fedifan@social.degenfeed.xyz',
        metadata: {},
      },
      embeds: [],
      metrics: { likes: 34, reposts: 8, replies: 3, quotes: 0 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: ['fediverse', 'decentralization'],
      parentId: null,
      raw: {},
    },
  ],
  meta: {
    total: 5,
    limit: 50,
    perProtocol: { nostr: 1, farcaster: 1, bluesky: 1, lens: 1, mastodon: 1 },
    trending: [
      { topic: 'bitcoin', count: 1, score: 42 },
      { topic: 'base', count: 1, score: 128 },
    ],
    fetchedAt: Date.now(),
    topOfHour: 'post-2',
    personalization: {
      hasProfile: true,
      boostApplied: true,
      isOnboarding: false,
      reasons: ['you follow Builder Guy', 'trending in topics you like'],
    },
  },
};

export const MOCK_FOLLOWING_FEED = {
  data: [
    {
      id: 'post-2',
      protocol: 'farcaster',
      text: 'Just deployed my first smart contract on Base 🚀',
      html: '<p>Just deployed my first smart contract on Base 🚀</p>',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      author: {
        id: 'fid:123',
        displayName: 'Builder Guy',
        avatarUrl: '',
        handle: 'builder',
        metadata: {},
      },
      embeds: [],
      metrics: { likes: 128, reposts: 33, replies: 12, quotes: 5 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: ['base', 'solidity'],
      parentId: null,
      raw: {},
    },
  ],
  meta: {
    total: 1,
    limit: 50,
    perProtocol: { farcaster: 1 },
    fetchedAt: Date.now(),
  },
};

// ─── Post detail fixtures ────────────────────────────────────

export const MOCK_SINGLE_POST = {
  data: MOCK_FEED_POSTS.data[0],
};

export const MOCK_POST_REPLIES = {
  data: [
    {
      id: 'reply-1',
      protocol: 'nostr',
      text: 'Totally agree! Bitcoin fixes this.',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      author: {
        id: 'npub:def',
        displayName: 'Bitcoiner',
        avatarUrl: '',
        handle: 'bitcoiner',
        metadata: {},
      },
      embeds: [],
      metrics: { likes: 7, reposts: 1, replies: 0, quotes: 0 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: [],
      parentId: 'post-1',
      raw: {},
    },
    {
      id: 'reply-2',
      protocol: 'farcaster',
      text: 'Have you tried deploying on Optimism? Cheaper fees.',
      createdAt: new Date(Date.now() - 900000).toISOString(),
      author: {
        id: 'fid:456',
        displayName: 'Gas Saver',
        avatarUrl: '',
        handle: 'gassaver',
        metadata: {},
      },
      embeds: [],
      metrics: { likes: 3, reposts: 0, replies: 1, quotes: 0 },
      engagement: { viewerLiked: false, viewerReposted: false, viewerBookmarked: false },
      niches: [],
      parentId: 'post-1',
      raw: {},
    },
  ],
};

export const MOCK_THREAD_DATA = {
  post: MOCK_FEED_POSTS.data[0],
  replies: [
    {
      id: 'reply-1',
      protocol: 'nostr',
      text: 'Totally agree! Bitcoin fixes this.',
      createdAt: new Date(Date.now() - 1800000),
      author: { displayName: 'Bitcoiner', id: 'npub:def', handle: 'bitcoiner' },
      metrics: { likes: 7, reposts: 1, replies: 0, quotes: 0 },
      bridged: false,
      parentUri: 'df://post-1',
      depth: 0,
    },
    {
      id: 'reply-2',
      protocol: 'farcaster',
      text: 'Have you tried deploying on Optimism? Cheaper fees.',
      createdAt: new Date(Date.now() - 900000),
      author: { displayName: 'Gas Saver', id: 'fid:456', handle: 'gassaver' },
      metrics: { likes: 3, reposts: 0, replies: 1, quotes: 0 },
      bridged: true,
      bridgeFrom: 'farcaster',
      parentUri: 'df://post-1',
      depth: 0,
      viaCrossPost: true,
    },
  ],
  protocols: ['nostr', 'farcaster'],
  bridgeCount: 1,
  byProtocol: { nostr: 1, farcaster: 1 },
};

// ─── Auth fixtures ──────────────────────────────────────────

export const MOCK_SIGNED_IN_STATE = {
  signedInProtocols: { nostr: true, farcaster: true, lens: false, bluesky: false, mastodon: false },
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  primaryIdentity: {
    id: 'npub1abc',
    protocol: 'nostr',
    displayName: 'Alice',
    handle: 'alice',
    isPrimary: true,
    publicId: 'npub1abc',
  },
  linkedIdentities: [
    {
      id: 'npub1abc',
      protocol: 'nostr',
      displayName: 'Alice',
      handle: 'alice',
      isPrimary: true,
      publicId: 'npub1abc',
    },
    {
      id: 'fid:123',
      protocol: 'farcaster',
      displayName: 'Alice',
      handle: 'alice',
      isPrimary: false,
      publicId: 'fid:123',
    },
  ],
  tokens: {
    nostr_pubkey: 'npub1abc',
    nostr_privkey: 'nsec1...',
  },
};

export const MOCK_AUTH_CALLBACK_RESPONSE = {
  ok: true,
  identity: {
    id: 'npub1abc',
    protocol: 'nostr',
    displayName: 'Alice',
    handle: 'alice',
    publicId: 'npub1abc',
    isPrimary: true,
  },
  tokens: {
    nostr_pubkey: 'npub1abc',
    nostr_privkey: 'nsec1...',
  },
};

export const MOCK_SIGNED_OUT_STATE = {
  signedInProtocols: {
    nostr: false,
    farcaster: false,
    lens: false,
    bluesky: false,
    mastodon: false,
  },
  walletAddress: undefined,
  primaryIdentity: undefined,
  linkedIdentities: [],
  tokens: {},
};

export const MOCK_WALLET_CONNECT_OPTIONS = {
  solana: {
    adapter: 'solana',
    address: '8xJ4Jbb2V3Vb5YZb5YZb5YZb5YZb5YZb5YZb5YZb5',
    publicKey: '8xJ4Jb...',
  },
  ethereum: {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    chainId: 1,
  },
};

export const MOCK_PROTOCOL_AUTH_URLS = {
  nostr: '/auth/nostr',
  farcaster: '/auth/farcaster',
  lens: '/auth/lens',
  bluesky: '/auth/bluesky',
  mastodon: '/auth/mastodon',
};

// ─── Search fixtures ─────────────────────────────────────────

export const MOCK_SEARCH_RESULTS = {
  data: [
    {
      id: 'search-post-1',
      protocol: 'nostr',
      text: 'Bitcoin is the future of money!',
      author: { displayName: 'Satoshi', avatarUrl: '' },
      url: null,
      image: null,
      niches: ['bitcoin'],
      createdAt: Date.now() - 3600000,
      metrics: { likes: 42, reposts: 10, replies: 5, quotes: 2 },
    },
    {
      id: 'search-post-2',
      protocol: 'farcaster',
      text: 'Bitcoin L2s are the next big thing',
      author: { displayName: 'BTC Dev', avatarUrl: '' },
      url: null,
      image: null,
      niches: ['bitcoin'],
      createdAt: Date.now() - 7200000,
      metrics: { likes: 28, reposts: 7, replies: 3, quotes: 1 },
    },
  ],
  identities: [
    {
      id: 'npub1abc',
      protocol: 'nostr',
      displayName: 'Satoshi',
      handle: 'satoshi',
      avatarUrl: null,
      bio: 'Bitcoin enthusiast',
      postCount: 142,
    },
    {
      id: 'fid:789',
      protocol: 'farcaster',
      displayName: 'Bitcoin Dev',
      handle: 'btcdev',
      avatarUrl: null,
      bio: 'Building on Bitcoin',
      postCount: 89,
    },
  ],
  communities: [
    {
      id: 'c-bitcoin',
      name: 'Bitcoin',
      protocol: 'nostr',
      description: 'Bitcoin discussion community',
      memberCount: 1234,
      url: '/c/bitcoin',
      icon: null,
    },
  ],
  videos: [],
};

export const MOCK_EMPTY_SEARCH = {
  data: [],
  identities: [],
  communities: [],
  videos: [],
};

// ─── Community fixtures ──────────────────────────────────────

export const MOCK_COMMUNITIES_LIST = {
  data: [
    {
      id: 'c-bitcoin',
      slug: 'bitcoin',
      name: 'bitcoin',
      displayName: 'Bitcoin',
      description: 'Bitcoin discussion across all protocols',
      icon: null,
      banner: null,
      memberCount: 1234,
      tags: ['bitcoin', 'crypto'],
      protocols: { nostr: true, farcaster: true, mastodon: true },
      createdBy: 'npub1abc',
      createdAt: Date.now() - 86400000 * 30,
      moderators: ['npub1abc'],
      rules: ['Be respectful', 'No spam'],
    },
    {
      id: 'c-ethereum',
      slug: 'ethereum',
      name: 'ethereum',
      displayName: 'Ethereum',
      description: 'Ethereum ecosystem discussion',
      icon: null,
      banner: null,
      memberCount: 892,
      tags: ['ethereum', 'defi'],
      protocols: { nostr: true, farcaster: true, lens: true, bluesky: true },
      createdBy: 'fid:123',
      createdAt: Date.now() - 86400000 * 60,
      moderators: ['fid:123'],
      rules: ['No price talk', 'Stay on topic'],
    },
  ],
  meta: { total: 2 },
};

export const MOCK_COMMUNITY_DETAIL = {
  id: 'c-bitcoin',
  slug: 'bitcoin',
  name: 'bitcoin',
  displayName: 'Bitcoin',
  description: 'Bitcoin discussion across all protocols',
  icon: null,
  banner: null,
  memberCount: 1234,
  tags: ['bitcoin', 'crypto'],
  protocols: { nostr: true, farcaster: true, mastodon: true },
  createdBy: 'npub1abc',
  createdAt: Date.now() - 86400000 * 30,
  moderators: ['npub1abc'],
  rules: ['Be respectful', 'No spam'],
  isMember: false,
};

export const MOCK_COMMUNITY_FEED = [
  {
    id: 'community-post-1',
    protocol: 'nostr',
    text: 'Bitcoin is settling billions daily on-chain.',
    author: { displayName: 'Satoshi', handle: 'satoshi', avatar: '' },
    createdAt: Date.now() - 3600000,
    likes: 42,
    replies: 7,
  },
  {
    id: 'community-post-2',
    protocol: 'farcaster',
    text: 'Lightning network capacity just hit new ATH',
    author: { displayName: 'LN Fan', handle: 'lnfan', avatar: '' },
    createdAt: Date.now() - 7200000,
    likes: 28,
    replies: 3,
  },
];

export const MOCK_COMMUNITY_CREATE_RESPONSE = {
  ok: true,
  community: {
    id: 'c-new-community',
    slug: 'new-community',
    name: 'new-community',
    displayName: 'New Community',
    description: 'A brand new community',
    memberCount: 1,
    tags: ['test'],
    protocols: { nostr: true },
    createdBy: 'npub1abc',
  },
};

// ─── Message fixtures ────────────────────────────────────────

export const MOCK_CONVERSATIONS = {
  conversations: [
    {
      conversationId: 'conv-1',
      participants: ['npub1abc', 'npub:def'],
      protocol: 'nostr',
      lastMessage: {
        id: 'msg-3',
        content: 'Sounds great! Let me know when.',
        fromId: 'npub:def',
        createdAt: Date.now() - 600000,
        read: false,
      },
      unreadCount: 1,
      updatedAt: Date.now() - 600000,
    },
    {
      conversationId: 'conv-2',
      participants: ['npub1abc', 'fid:456'],
      protocol: 'farcaster',
      lastMessage: {
        id: 'msg-5',
        content: 'Check out this new project I found',
        fromId: 'fid:456',
        createdAt: Date.now() - 1800000,
        read: true,
      },
      unreadCount: 0,
      updatedAt: Date.now() - 1800000,
    },
    {
      conversationId: 'conv-3',
      participants: ['npub1abc', 'did:plc:xyz'],
      protocol: 'bluesky',
      lastMessage: {
        id: 'msg-7',
        content: 'Great catching up earlier!',
        fromId: 'npub1abc',
        createdAt: Date.now() - 86400000,
        read: true,
      },
      unreadCount: 0,
      updatedAt: Date.now() - 86400000,
    },
  ],
};

export const MOCK_MESSAGES = {
  messages: [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      fromId: 'npub:def',
      toId: 'npub1abc',
      protocol: 'nostr' as const,
      content: 'Hey, are you going to the Bitcoin meetup?',
      createdAt: Date.now() - 7200000,
      read: true,
      encrypted: true,
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      fromId: 'npub1abc',
      toId: 'npub:def',
      protocol: 'nostr' as const,
      content: 'Yes! Wouldnt miss it. Are you presenting?',
      createdAt: Date.now() - 3600000,
      read: true,
      encrypted: true,
    },
    {
      id: 'msg-3',
      conversationId: 'conv-1',
      fromId: 'npub:def',
      toId: 'npub1abc',
      protocol: 'nostr' as const,
      content: 'Sounds great! Let me know when.',
      createdAt: Date.now() - 600000,
      read: false,
      encrypted: true,
    },
  ],
};

export const MOCK_SEND_MESSAGE_RESPONSE = {
  ok: true,
  message: {
    id: 'msg-new',
    conversationId: 'conv-1',
    fromId: 'npub1abc',
    toId: 'npub:def',
    protocol: 'nostr' as const,
    content: 'New test message',
    createdAt: Date.now(),
    read: true,
    encrypted: true,
  },
};

export const MOCK_EMPTY_CONVERSATIONS = { conversations: [] };

// ─── Notification fixtures ───────────────────────────────────

export const MOCK_NOTIFICATIONS = {
  notifications: [
    {
      id: 'notif-1',
      type: 'like',
      protocol: 'nostr',
      actor: { displayName: 'Bitcoiner', handle: 'bitcoiner', avatarUrl: '' },
      content: 'Liked your post: Bitcoin is the future!',
      timestamp: Date.now() - 300000,
      read: false,
      targetPostId: 'post-1',
      targetPostText: 'Bitcoin is the future of money!',
    },
    {
      id: 'notif-2',
      type: 'repost',
      protocol: 'farcaster',
      actor: { displayName: 'Builder Guy', handle: 'builder', avatarUrl: '' },
      content: 'Reposted your post',
      timestamp: Date.now() - 1800000,
      read: false,
      targetPostId: 'post-2',
    },
    {
      id: 'notif-3',
      type: 'reply',
      protocol: 'bluesky',
      actor: { displayName: 'Protocol Maxi', handle: 'maxi.bsky.social', avatarUrl: '' },
      content: 'Replied to your post',
      timestamp: Date.now() - 7200000,
      read: true,
      targetPostId: 'post-3',
    },
  ],
};

export const MOCK_EMPTY_NOTIFICATIONS = { notifications: [] };

// ─── Preferences fixture ─────────────────────────────────────

export const MOCK_PREFERENCES = {
  hideLowQuality: false,
  hideLowQualityThreshold: 1.0,
  allowNonCrypto: false,
  recencyWeight: 1.0,
  engagementWeight: 1.0,
  showOriginalContent: false,
  minEngagement: 0,
  maxPerNiche: 5,
  notifications: {
    nostr: { likes: true, replies: true, follows: true, reposts: true, mentions: true },
  },
};

export const MOCK_PREFERENCES_SIGNED_OUT = {};

// ─── Cross-protocol fixtures ─────────────────────────────────

export const MOCK_CROSS_REPLY_RESPONSE = {
  ok: true,
  reply: {
    id: 'cross-reply-1',
    protocol: 'nostr',
    text: 'Cross-protocol reply from Nostr to Farcaster',
    createdAt: Date.now(),
    bridged: true,
    bridgeFrom: 'nostr',
  },
};

export const MOCK_BRIDGE_STATUS = {
  ok: true,
  bridges: [
    { from: 'nostr', to: 'farcaster', active: true, latency: 1200 },
    { from: 'farcaster', to: 'nostr', active: true, latency: 1500 },
    { from: 'nostr', to: 'bluesky', active: true, latency: 2000 },
    { from: 'bluesky', to: 'nostr', active: true, latency: 1800 },
    { from: 'lens', to: 'farcaster', active: true, latency: 900 },
    { from: 'farcaster', to: 'lens', active: true, latency: 1100 },
  ],
};

export const MOCK_CROSS_POST_IDENTITY = {
  nostr: { id: 'npub1abc', displayName: 'Alice' },
  farcaster: { id: 'fid:123', displayName: 'Alice' },
  bluesky: { id: 'did:plc:alice', displayName: 'Alice' },
};

// ─── Feed interaction fixtures ───────────────────────────────

export const MOCK_LIKE_RESPONSE = { ok: true };
export const MOCK_REPOST_RESPONSE = { ok: true };
export const MOCK_BOOKMARK_RESPONSE = { ok: true };

export const MOCK_COMPOSE_PREVIEW = {
  protocols: ['nostr', 'farcaster'],
  characterCount: 42,
  willCrossPost: true,
  estimatedReach: 1500,
};

// ─── Route helpers ───────────────────────────────────────────

/** Set up feed API mocks on the page. Accepts any preferences shape. */
export async function mockFeedApi(
  page: Page,
  posts = MOCK_FEED_POSTS,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prefs: Record<string, any> = MOCK_PREFERENCES,
) {
  await page.route('**/api/feed/home**', async (route) => {
    await route.fulfill({ json: posts });
  });
  await page.route('**/api/feed/for-you**', async (route) => {
    await route.fulfill({ json: posts });
  });
  await page.route('**/api/preferences', async (route) => {
    await route.fulfill({ json: prefs });
  });
}

/** Set up auth API mocks on the page. */
export async function mockAuthApi(page: Page) {
  // Auth callback
  await page.route('**/api/auth/callback**', async (route) => {
    await route.fulfill({ json: MOCK_AUTH_CALLBACK_RESPONSE });
  });
  // Auth status
  await page.route('**/api/auth/status**', async (route) => {
    await route.fulfill({ json: MOCK_SIGNED_IN_STATE });
  });
  // Wallet nonce
  await page.route('**/api/auth/nonce**', async (route) => {
    await route.fulfill({ json: { nonce: 'abc123' } });
  });
  // Sign out
  await page.route('**/api/auth/signout**', async (route) => {
    await route.fulfill({ json: { ok: true } });
  });
}

/** Set up post detail API mocks on the page. */
export async function mockPostApi(page: Page) {
  await page.route('**/api/feed/post/post-1', async (route) => {
    await route.fulfill({ json: MOCK_SINGLE_POST });
  });
  await page.route('**/api/feed/post/post-1/replies**', async (route) => {
    await route.fulfill({ json: MOCK_POST_REPLIES });
  });
  await page.route('**/api/thread/**', async (route) => {
    await route.fulfill({ json: MOCK_THREAD_DATA });
  });
  // Engagement endpoints
  await page.route('**/api/engage/**', async (route) => {
    await route.fulfill({ json: MOCK_LIKE_RESPONSE });
  });
}

/** Set up search API mocks on the page. */
export async function mockSearchApi(page: Page) {
  await page.route('**/api/search**', async (route) => {
    const url = route.request().url();
    if (url.includes('q=')) {
      await route.fulfill({ json: MOCK_SEARCH_RESULTS });
    } else {
      await route.fulfill({ json: MOCK_EMPTY_SEARCH });
    }
  });
}

/** Set up community API mocks on the page. */
export async function mockCommunityApi(page: Page) {
  await page.route('**/api/communities', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: MOCK_COMMUNITY_CREATE_RESPONSE });
    } else {
      await route.fulfill({ json: MOCK_COMMUNITIES_LIST });
    }
  });
  await page.route('**/api/communities/*', async (route) => {
    await route.fulfill({ json: MOCK_COMMUNITY_DETAIL });
  });
  await page.route('**/api/communities/*/feed**', async (route) => {
    await route.fulfill({ json: { data: MOCK_COMMUNITY_FEED } });
  });
  await page.route('**/api/communities/*/join', async (route) => {
    await route.fulfill({ json: { ok: true, isMember: true } });
  });
}

/** Set up message API mocks on the page. */
export async function mockMessagesApi(page: Page) {
  await page.route('**/api/messages/conversations', async (route) => {
    await route.fulfill({ json: MOCK_CONVERSATIONS });
  });
  await page.route('**/api/messages/conv-**', async (route) => {
    await route.fulfill({ json: MOCK_MESSAGES });
  });
  await page.route('**/api/messages/send', async (route) => {
    await route.fulfill({ json: MOCK_SEND_MESSAGE_RESPONSE });
  });
}

/** Set up notification API mocks on the page. */
export async function mockNotificationsApi(page: Page) {
  await page.route('**/api/notifications', async (route) => {
    await route.fulfill({ json: MOCK_NOTIFICATIONS });
  });
}

/** Set up cross-protocol bridge API mocks. */
export async function mockCrossProtocolApi(page: Page) {
  await page.route('**/api/bridge/reply', async (route) => {
    await route.fulfill({ json: MOCK_CROSS_REPLY_RESPONSE });
  });
  await page.route('**/api/bridge/status', async (route) => {
    await route.fulfill({ json: MOCK_BRIDGE_STATUS });
  });
  await page.route('**/api/cross-post/identity**', async (route) => {
    await route.fulfill({ json: MOCK_CROSS_POST_IDENTITY });
  });
}

/** Set up all standard API mocks at once. */
export async function mockAllApis(page: Page) {
  await mockFeedApi(page);
  await mockAuthApi(page);
  await mockPostApi(page);
  await mockSearchApi(page);
  await mockCommunityApi(page);
  await mockMessagesApi(page);
  await mockNotificationsApi(page);
  await mockCrossProtocolApi(page);
}
