/**
 * Arweave Gateway Bridge Provider
 *
 * Fetches content from the Arweave permaweb using GraphQL (ArQL).
 * Queries recent transactions that have human-readable content
 * (text/html, text/plain, application/json) and maps them to posts.
 *
 * API: POST https://arweave.net/graphql
 *
 * Query pattern:
 *   transactions(tags: [{name: "Content-Type", values: ["text/html"]}], first: 20) {
 *     edges { node { id, owner, tags, block, data } }
 *   }
 */

import { guessNiches } from '../lib/utils';
import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const ARWEAVE_GATEWAY = 'https://arweave.net/graphql';
const ARWEAVE_VIEW = 'https://arweave.net';

interface ArweaveTag {
  name: string;
  value: string;
}

interface ArweaveTransaction {
  id: string;
  owner: { address: string };
  tags: ArweaveTag[];
  block: { height: number; timestamp: number } | null;
  data: { type: string; size: string };
}

interface ArweavePageInfo {
  hasNextPage: boolean;
  cursor: string | null;
}

interface ArweaveGraphQLResponse {
  data?: {
    transactions?: {
      pageInfo: ArweavePageInfo;
      edges: Array<{
        node: ArweaveTransaction;
        cursor: string;
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

interface ArweavePost {
  txId: string;
  title: string;
  content: string;
  contentType: string;
  owner: string;
  timestamp: number;
  tags: ArweaveTag[];
}

const CONTENT_TYPES_TO_SCAN = [
  'text/html',
  'text/plain',
  'text/markdown',
  'application/json',
];

// Known Arweave apps and their tag patterns
const CURATED_APPS = [
  { name: 'Arweave News', appName: 'ArweaveNews' },
  { name: 'ArDrive', appName: 'ArDrive' },
  { name: 'ArweaveBlocks', appName: 'ArweaveBlocks' },
  { name: 'Permaweb Press', appName: 'PermawebPress' },
];

async function graphQLQuery(query: string): Promise<ArweaveGraphQLResponse> {
  const res = await $fetch(ARWEAVE_GATEWAY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'DegenFeed-Bridge/0.1 (Arweave)',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return {};
  return (await res.json()) as ArweaveGraphQLResponse;
}

function extractTag(tags: ArweaveTag[], name: string): string | null {
  const t = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
  return t ? t.value : null;
}

function bytesToSize(bytes: string): string {
  const n = parseInt(bytes, 10);
  if (isNaN(n)) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function parsePermawebPost(node: ArweaveTransaction): ArweavePost | null {
  const contentType = extractTag(node.tags, 'Content-Type') || 'unknown';
  const title = extractTag(node.tags, 'Title') ||
    extractTag(node.tags, 'title') ||
    extractTag(node.tags, 'Topic') ||
    `Permaweb Content ${node.id.slice(0, 8)}`;
  const appName = extractTag(node.tags, 'App-Name') ||
    extractTag(node.tags, 'Application') ||
    'Unknown';
  const unixTime = node.block?.timestamp || Math.floor(Date.now() / 1000);

  return {
    txId: node.id,
    title: title.slice(0, 200),
    content: `[Arweave Content] ${title}`,
    contentType,
    owner: node.owner.address,
    timestamp: unixTime * 1000,
    tags: node.tags,
  };
}

export async function fetchArweavePosts(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];

  // Query 1: Recent content-type tagged transactions
  const contentTypeQuery = `
    {
      transactions(
        tags: { name: "Content-Type", values: ${JSON.stringify(CONTENT_TYPES_TO_SCAN)} }
        first: ${Math.min(limit * 2, 50)}
        sort: HEIGHT_DESC
      ) {
        pageInfo { hasNextPage cursor }
        edges {
          cursor
          node {
            id
            owner { address }
            tags { name value }
            block { height timestamp }
            data { type size }
          }
        }
      }
    }
  `;

  try {
    const contentTypeResult = await graphQLQuery(contentTypeQuery);
    const edges = contentTypeResult?.data?.transactions?.edges || [];
    for (const edge of edges) {
      const post = parsePermawebPost(edge.node);
      if (!post) continue;

      all.push({
        id: `arweave:${post.txId}`,
        protocol: 'arweave',
        author: {
          id: `arweave:${post.owner}`,
          primary: { protocol: 'arweave', id: post.owner },
          handles: { arweave: post.owner.slice(0, 10) },
          displayName: `Arweave ${post.owner.slice(0, 8)}...`,
          bio: '',
          avatarUrl: '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: { address: post.owner },
        },
        text: post.content.slice(0, 2000),
        embeds: [
          { kind: 'link', url: `${ARWEAVE_VIEW}/${post.txId}`, meta: { txId: post.txId } },
        ],
        contentType: 'article',
        createdAt: post.timestamp,
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: edge.node,
        niches: guessNiches(`${post.title} ${post.content}`),
      } as UnifiedPost);
    }
  } catch (err) {
    console.log(`[bridge] Arweave GraphQL error: ${(err as Error).message}`);
  }

  // Query 2: Curated app content
  if (all.length < limit) {
    try {
      const appQuery = `
        {
          transactions(
            tags: { name: "App-Name", values: ${JSON.stringify(CURATED_APPS.map(a => a.appName))} }
            first: ${Math.min(limit - all.length, 20)}
            sort: HEIGHT_DESC
          ) {
            edges {
              node {
                id
                owner { address }
                tags { name value }
                block { height timestamp }
                data { type size }
              }
            }
          }
        }
      `;
      const appResult = await graphQLQuery(appQuery);
      const appEdges = appResult?.data?.transactions?.edges || [];
      for (const edge of appEdges) {
        const post = parsePermawebPost(edge.node);
        if (!post) continue;
        const exists = all.some((p) => p.id === `arweave:${post.txId}`);
        if (!exists) {
          all.push({
            id: `arweave:${post.txId}`,
            protocol: 'arweave',
            author: {
              id: `arweave:${post.owner}`,
              primary: { protocol: 'arweave', id: post.owner },
              handles: { arweave: post.owner.slice(0, 10) },
              displayName: `Arweave ${post.owner.slice(0, 8)}...`,
              bio: '',
              avatarUrl: '',
              followerCount: 0,
              followingCount: 0,
              links: [],
              keys: { address: post.owner },
            },
            text: post.content.slice(0, 2000),
            embeds: [
              { kind: 'link', url: `${ARWEAVE_VIEW}/${post.txId}`, meta: { txId: post.txId } },
            ],
            contentType: 'article',
            createdAt: post.timestamp,
            metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
            engagement: {
              viewerLiked: false,
              viewerReposted: false,
              viewerBookmarked: false,
              raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
            },
            raw: edge.node,
            niches: guessNiches(`${post.title} ${post.content}`),
          } as UnifiedPost);
        }
      }
    } catch (err) {
      console.log(`[bridge] Arweave app query error: ${(err as Error).message}`);
    }
  }

  console.log(`[bridge] Arweave: ${all.length} permaweb items`);
  return all.slice(0, limit);
}

export const schema: SchemaGuard = {
  id: 'arweave',
  name: 'Arweave',
  description: 'Permaweb — permanent decentralized content via GraphQL',
  endpoint: '/api/feed/arweave',
  requiresAuth: false,
  contentType: 'data',
};

export const fetch = fetchArweavePosts;
