/**
 * Lens Protocol Provider
 *
 * Fetches posts from the Lens v2 GraphQL API.
 * Endpoint: https://api.lens.xyz/graphql
 *
 * Uses Lens v2 `posts` query to fetch recent content from Lens network.
 * The API is public and does not require authentication for reads.
 */

import type { UnifiedPost } from '../server';

// ─── Configuration ────────────────────────────────────────────────────

const LENS_GRAPHQL_URL = 'https://api.lens.xyz/graphql';

// ─── Lens v2 GraphQL Types ────────────────────────────────────────────

interface LensAccountMetadata {
  name?: string | null;
  bio?: string | null;
  picture?: string | null; // URI scalar
}

interface LensUsername {
  localName?: string | null;
}

interface LensAccount {
  address: string;
  username: LensUsername | null;
  metadata?: LensAccountMetadata | null;
}

interface LensPostStats {
  reactions: number;
  comments: number;
  reposts: number;
  quotes: number;
}

interface LensPostOperations {
  hasReacted: boolean;
  hasBookmarked: boolean;
  hasReposted?: { optimistic: boolean; onChain: boolean } | null;
}

interface LensTextMetadata {
  __typename: 'TextOnlyMetadata';
  content?: string | null;
}

interface LensImageMetadata {
  __typename: 'ImageMetadata';
  content?: string | null;
  image?: { item?: string | null } | null;
}

interface LensVideoMetadata {
  __typename: 'VideoMetadata';
  content?: string | null;
  title?: string | null;
  video?: { item?: string | null } | null;
}

interface LensLinkMetadata {
  __typename: 'LinkMetadata';
  content?: string | null;
  sharingLink?: string | null;
}

type LensAnyMetadata = LensTextMetadata | LensImageMetadata | LensVideoMetadata | LensLinkMetadata;

interface LensPost {
  id: string;
  slug: string;
  author: LensAccount;
  timestamp: string;
  metadata: LensAnyMetadata | null;
  stats: LensPostStats | null;
  operations: LensPostOperations | null;
}

interface LensPostsResponse {
  data?: {
    posts?: {
      items: Array<{ __typename: string } & LensPost>;
    };
  };
  errors?: Array<{ message: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp|lending|compound|aave|uniswap)\b/.test(lower))
    niches.push('defi');
  if (/\b(nft|art|collectible|punk|bored|ape)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib|bonk|wif|trump)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base|polygon)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit|bug)\b/.test(lower)) niches.push('security');
  if (/\b(rust|typescript|python|programming|code|dev)\b/.test(lower)) niches.push('tech');
  if (/\b(lens|hey|orb)\b/.test(lower)) niches.push('lens');
  if (/\b(web3|blockchain|wallet|did)\b/.test(lower)) niches.push('web3');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function postToUnified(post: LensPost): UnifiedPost | null {
  const metadata = post.metadata;

  let content = '';
  let title = '';

  if (metadata) {
    content = metadata.content || '';
    if ('title' in metadata) {
      title = (metadata as LensVideoMetadata).title || '';
    }
  }

  if (!content.trim() && !title.trim()) return null;
  if (!content.trim() && title.trim()) {
    content = title;
  }

  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];

  // Check for image in ImageMetadata
  if (metadata?.__typename === 'ImageMetadata' && metadata.image?.item) {
    embeds.push({ kind: 'image', url: metadata.image.item });
  }

  // Check for video in VideoMetadata
  if (metadata?.__typename === 'VideoMetadata' && metadata.video?.item) {
    embeds.push({ kind: 'video', url: metadata.video.item });
  }

  // Check for sharing link in LinkMetadata
  if (metadata?.__typename === 'LinkMetadata' && metadata.sharingLink) {
    embeds.push({ kind: 'link', url: metadata.sharingLink });
  }

  // Extract URLs from content
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urlMatches = content.match(urlRegex);
  if (urlMatches) {
    for (const url of urlMatches) {
      if (!embeds.some((e) => e.url === url)) {
        const isImage = /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(url);
        embeds.push({ kind: isImage ? 'image' : 'link', url });
      }
    }
  }

  const stats = post.stats;
  const ops = post.operations;

  // Display name from metadata or username
  const displayName =
    post.author.metadata?.name ||
    post.author.username?.localName ||
    post.author.address.slice(0, 10);
  const avatarUri = post.author.metadata?.picture || '';
  const bio = post.author.metadata?.bio || '';

  return {
    id: `lens:${post.id}`,
    protocol: 'lens',
    author: {
      id: `lens:${post.author.address}`,
      primary: { protocol: 'lens', id: post.author.address },
      handles: { lens: post.author.username?.localName || post.author.address },
      displayName,
      bio,
      avatarUrl: avatarUri,
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { address: post.author.address },
    },
    text: content,
    embeds,
    createdAt: new Date(post.timestamp).getTime(),
    metrics: {
      likes: stats?.reactions ?? 0,
      reposts: stats?.reposts ?? 0,
      replies: stats?.comments ?? 0,
      quotes: stats?.quotes ?? 0,
    },
    engagement: {
      viewerLiked: ops?.hasReacted ?? false,
      viewerReposted: ops?.hasReposted?.optimistic ?? false,
      viewerBookmarked: ops?.hasBookmarked ?? false,
      raw: {
        likes: stats?.reactions ?? 0,
        reposts: stats?.reposts ?? 0,
        replies: stats?.comments ?? 0,
        quotes: stats?.quotes ?? 0,
      },
    },
    raw: post,
    niches: guessNiches(content),
  };
}

// ─── GraphQL Query (Lens v2) ──────────────────────────────────────────

const POSTS_QUERY = `
query Posts {
  posts(request: {
    filter: {
      metadata: {
        mainContentFocus: [TEXT_ONLY, IMAGE, VIDEO, LINK]
      }
    }
    pageSize: FIFTY
  }) {
    items {
      __typename
      ... on Post {
        id
        slug
        author {
          address
          username {
            localName
          }
          metadata {
            name
            bio
            picture
          }
        }
        timestamp
        metadata {
          ... on TextOnlyMetadata {
            content
          }
          ... on ImageMetadata {
            content
            image {
              item
            }
          }
          ... on VideoMetadata {
            content
            title
            video {
              item
            }
          }
          ... on LinkMetadata {
            content
            sharingLink
          }
        }
        stats {
          reactions
          comments
          reposts
          quotes
        }
        operations {
          hasReacted
          hasBookmarked
          hasReposted {
            optimistic
          }
        }
      }
    }
  }
}
`;

// ─── Fetch from Lens API ──────────────────────────────────────────────

async function fetchPosts(limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await fetch(LENS_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DegenFeed-Bridge/0.1',
      },
      body: JSON.stringify({ query: POSTS_QUERY }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[bridge] Lens: API returned ${res.status} ${res.statusText}`);
      return [];
    }

    const data = (await res.json()) as LensPostsResponse;

    if (data.errors) {
      for (const err of data.errors) {
        console.warn('[bridge] Lens: GraphQL error:', err.message);
      }
      return [];
    }

    const items = data.data?.posts?.items;
    if (!items || items.length === 0) {
      console.warn('[bridge] Lens: No posts returned');
      return [];
    }

    const posts: UnifiedPost[] = [];
    for (const item of items) {
      if (item.__typename !== 'Post') continue;
      const post = postToUnified(item);
      if (post) posts.push(post);
    }

    return posts.slice(0, limit);
  } catch (err) {
    console.warn('[bridge] Lens: Error fetching posts:', err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────

export async function fetchLensPosts(limit = 20): Promise<UnifiedPost[]> {
  const posts = await fetchPosts(limit);
  console.log(`[bridge] Lens: ${posts.length} posts`);
  return posts;
}
