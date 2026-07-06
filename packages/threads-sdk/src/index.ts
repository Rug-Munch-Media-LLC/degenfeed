/**
 * @degenfeed/threads-sdk
 *
 * Threads (AT Protocol) client. Threads runs on the same AT Protocol
 * as Bluesky, so this is a thin wrapper around @degenfeed/bluesky-sdk
 * pointing at Threads' public PDS endpoint.
 *
 * Threads public API endpoint: https://public.threads.net
 *
 * All posts normalize to @degenfeed/types `UnifiedPost`.
 *
 * ## Architecture
 *
 *   ThreadsClient.connect(pdsUrl) → ThreadsClient
 *     .getTimeline(limit, cursor)  → UnifiedPost[]
 *     .getAuthorFeed(did)          → UnifiedPost[]
 *     .getPost(uri)                → UnifiedPost
 *     .getProfile(did)             → UnifiedIdentity
 *
 * Read endpoints (free, no auth required):
 *   - https://public.threads.net (public AppView)
 *
 * ## Differences from Bluesky
 *   - Threads uses the same XRPC endpoints under app.bsky.* lexicons
 *   - Post content may include Threads-specific embed types
 *   - Like/repost counts come from Threads' internal engagement tracking
 *   - Threads DIDs are AT Protocol DIDs (did:plc: or did:web:)
 *
 * TODO(v1):
 *   - Handle Threads-specific embed types (carousel, poll)
 *   - Add auth via Threads AT Protocol session
 *   - Add post/like/repost/reply helpers
 */

import { BskyClient, type BskyPostView } from '@degenfeed/bluesky-sdk';
import { buildUnifiedPost, emptyIdentity } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity, UnifiedPost, BskyPostView };

/** Threads public AppView endpoint. */
export const THREADS_PUBLIC_URL = 'https://public.threads.net';

/** Threads PDS endpoint for authenticated writes. */
export const THREADS_PDS_URL = 'https://threads.net';

/**
 * Threads-specific post view.
 * Extends the base AT Protocol post view with Threads-specific fields.
 */
export interface ThreadsPostView extends BskyPostView {
  /** Threads adds carousel posts (multiple images in one post) */
  carouselMedia?: {
    images: { url: string; alt: string }[];
  }[];
  /** Threads polls */
  poll?: {
    options: { label: string; count: number }[];
    expiry: string;
  };
}

/**
 * Threads client.
 *
 * Wraps BskyClient with Threads PDS URL and Threads protocol labeling.
 * All public read methods work without authentication.
 */
export class ThreadsClient {
  private bsky: BskyClient;
  private writeClient: BskyClient;

  /**
   * @param pdsUrl AT Protocol PDS URL. Defaults to Threads public AppView.
   */
  constructor(pdsUrl: string = THREADS_PUBLIC_URL) {
    this.bsky = new BskyClient(pdsUrl);
    this.writeClient = new BskyClient(THREADS_PDS_URL);
  }

  /** Set auth JWT for authenticated requests. */
  setAuth(accessJwt: string): void {
    this.bsky.setAuth(accessJwt);
    this.writeClient.setAuth(accessJwt);
  }

  async like(uri: string, cid: string, actorDid: string): Promise<void> {
    return this.writeClient.like(uri, cid, actorDid);
  }

  async unlike(uri: string, actorDid: string): Promise<void> {
    return this.writeClient.unlike(uri, actorDid);
  }

  async repost(uri: string, cid: string, actorDid: string): Promise<void> {
    return this.writeClient.repost(uri, cid, actorDid);
  }

  async unrepost(uri: string, actorDid: string): Promise<void> {
    return this.writeClient.unrepost(uri, actorDid);
  }

  async reply(
    parentUri: string,
    parentCid: string,
    actorDid: string,
    text: string,
    rootUri?: string,
    rootCid?: string,
  ): Promise<void> {
    return this.writeClient.reply(parentUri, parentCid, actorDid, text, rootUri, rootCid);
  }

  /** Get the Threads homepage / timeline. */
  async getTimeline(
    limit = 50,
    cursor?: string,
  ): Promise<{ posts: ThreadsPostView[]; cursor?: string }> {
    return this.bsky.getTimeline(limit, cursor) as Promise<{
      posts: ThreadsPostView[];
      cursor?: string;
    }>;
  }

  /** Get a specific user's feed by DID or handle. */
  async getAuthorFeed(
    actor: string,
    limit = 50,
    cursor?: string,
  ): Promise<{ posts: ThreadsPostView[]; cursor?: string }> {
    return this.bsky.getAuthorFeed(actor, limit, cursor) as Promise<{
      posts: ThreadsPostView[];
      cursor?: string;
    }>;
  }

  /** Get a single post by AT URI. */
  async getPost(uri: string): Promise<ThreadsPostView> {
    const baseUrl = this.bsky instanceof BskyClient ? THREADS_PUBLIC_URL : THREADS_PUBLIC_URL;
    const url = new URL(`${baseUrl}/xrpc/app.bsky.feed.getPostThread`);
    url.searchParams.set('uri', uri);
    url.searchParams.set('depth', '0');
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Threads API error: ${res.status}`);
    const json = (await res.json()) as { thread: { post: ThreadsPostView } };
    return json.thread.post;
  }

  /** Resolve a handle to its AT Protocol DID. */
  async resolveHandle(handle: string): Promise<string> {
    const baseUrl = this.bsky instanceof BskyClient ? THREADS_PUBLIC_URL : THREADS_PUBLIC_URL;
    const url = new URL(`${baseUrl}/xrpc/com.atproto.identity.resolveHandle`);
    url.searchParams.set('handle', handle);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to resolve Threads handle: ${res.status}`);
    const json = (await res.json()) as { did: string };
    return json.did;
  }

  /** Get a Threads profile by DID. */
  async getProfile(did: string): Promise<{
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
  }> {
    const baseUrl = this.bsky instanceof BskyClient ? THREADS_PUBLIC_URL : THREADS_PUBLIC_URL;
    const url = new URL(`${baseUrl}/xrpc/app.bsky.actor.getProfile`);
    url.searchParams.set('actor', did);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Threads profile error: ${res.status}`);
    return res.json() as Promise<{
      did: string;
      handle: string;
      displayName?: string;
      description?: string;
      avatar?: string;
      banner?: string;
      followersCount?: number;
      followsCount?: number;
      postsCount?: number;
    }>;
  }

  /** Normalize a Threads post to UnifiedPost. */
  postToUnifiedPost(post: ThreadsPostView, author?: UnifiedIdentity): UnifiedPost {
    // Extract image urls from carousel if present
    const embeds: { kind: 'image'; url: string }[] = [];
    if (post.carouselMedia) {
      for (const item of post.carouselMedia) {
        for (const img of item.images) {
          embeds.push({ kind: 'image' as const, url: img.url });
        }
      }
    }
    // Handle quoted posts (quote tweets)
    const quoteEmbed = post.record.embed?.external
      ? [{ kind: 'link' as const, url: post.record.embed.external.uri }]
      : [];

    // Extract image embeds from post record
    const imageEmbeds = post.record.embed?.images
      ? post.record.embed.images.map((img) => ({
          kind: 'image' as const,
          url: `https://threads.net${img.image.ref}`,
        }))
      : [];

    const allEmbeds = [...embeds, ...imageEmbeds, ...quoteEmbed];

    return buildUnifiedPost({
      protocol: 'threads' as Protocol,
      nativeId: post.uri,
      author: author ?? emptyIdentity(),
      text: post.record.text,
      parentNativeId: post.record.reply?.parent.uri,
      rootNativeId: post.record.reply?.root.uri,
      createdAt: new Date(post.record.createdAt).getTime(),
      embeds: allEmbeds,
      metrics: {
        likes: post.likeCount ?? 0,
        reposts: post.repostCount ?? 0,
        replies: post.replyCount ?? 0,
        quotes: 0,
      },
      viewer: { liked: false, reposted: false },
      raw: post,
    });
  }
}
