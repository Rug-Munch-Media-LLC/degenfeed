/**
 * @degenfeed/lemmy-sdk
 *
 * Full Lemmy API v3 client for reading and writing:
 *   - Communities: list, search, get details
 *   - Posts: list, get, create (cross-post)
 *   - Comments: list by post, create
 *   - Voting: upvote/downvote
 *   - Auth: login for write operations
 *
 * All content normalizes to @degenfeed/types `UnifiedPost` via
 * `lemmyToUnifiedPost()`.
 */

import { buildUnifiedPost } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Embed, Protocol, UnifiedIdentity, UnifiedPost };

// ─── Constants ──────────────────────────────────────────────────────────

export const DEFAULT_USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';

/**
 * Priority-ordered Lemmy instances for read operations.
 * Community.degenfeed.xyz is our self-hosted instance.
 */
export const LEMMY_INSTANCES = [
  'https://community.degenfeed.xyz',
  'https://lemmy.ml',
  'https://programming.dev',
  'https://lemmy.world',
  'https://beehaw.org',
  'https://sh.itjust.works',
];

// ─── Raw API types (Lemmy API v3) ─────────────────────────────────────

export interface LemmyPerson {
  id: number;
  name: string;
  display_name?: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  actor_id: string;
  local: boolean;
  published: string;
}

export interface LemmyCommunity {
  id: number;
  name: string;
  title: string;
  description?: string;
  icon?: string;
  banner?: string;
  actor_id: string;
  local: boolean;
  published: string;
  removed: boolean;
  deleted: boolean;
  nsfw: boolean;
}

export interface LemmyCommunityView {
  community: LemmyCommunity;
  counts: {
    subscribers: number;
    users_active_day: number;
    users_active_week: number;
    users_active_month: number;
    users_active_half_year: number;
    posts: number;
    comments: number;
  };
  subscribed?: 'Subscribed' | 'NotSubscribed' | 'Pending';
}

export interface LemmyPost {
  id: number;
  name: string;
  body?: string;
  url?: string;
  thumbnail_url?: string;
  embed_title?: string;
  embed_description?: string;
  embed_html?: string;
  published: string;
  updated?: string;
  removed: boolean;
  deleted: boolean;
  nsfw: boolean;
  locked: boolean;
  creator_id: number;
  community_id: number;
  featured_community: boolean;
  featured_local: boolean;
  ap_id: string;
  language_id: number;
}

export interface LemmyPostView {
  post: LemmyPost;
  creator: LemmyPerson;
  community: LemmyCommunity;
  creator_banned_from_community: boolean;
  counts: {
    id: number;
    post_id: number;
    comments: number;
    score: number;
    upvotes: number;
    downvotes: number;
    published: string;
    hot_rank: number;
    hot_rank_active: number;
    newest_activity_time: string;
  };
  subscribed?: 'Subscribed' | 'NotSubscribed' | 'Pending';
  saved?: boolean;
  read?: boolean;
  my_vote?: number;
}

export interface LemmyComment {
  id: number;
  content: string;
  path: string;
  published: string;
  updated?: string;
  removed: boolean;
  deleted: boolean;
  ap_id: string;
  local: boolean;
  post_id: number;
  creator_id: number;
  community_id: number;
  distinguished: boolean;
  language_id: number;
}

export interface LemmyCommentView {
  comment: LemmyComment;
  creator: LemmyPerson;
  post: LemmyPost;
  community: LemmyCommunity;
  counts: {
    id: number;
    comment_id: number;
    score: number;
    upvotes: number;
    downvotes: number;
    published: string;
  };
  saved?: boolean;
  my_vote?: number;
}

export interface LemmySiteView {
  site: {
    id: number;
    name: string;
    description?: string;
    icon?: string;
    actor_id: string;
  };
  admins: LemmyPerson[];
  counts: {
    users: number;
    posts: number;
    comments: number;
    communities: number;
  };
}

// ─── API response wrappers ────────────────────────────────────────────

export interface GetCommunityResponse {
  community_view: LemmyCommunityView;
  moderators: Array<{ moderator: LemmyPerson }>;
  online: number;
  discussion_languages: number[];
}

export interface ListCommunitiesResponse {
  communities: LemmyCommunityView[];
}

export interface GetPostsResponse {
  posts: LemmyPostView[];
}

export interface GetCommentsResponse {
  comments: LemmyCommentView[];
}

export interface CreatePostResponse {
  post_view: LemmyPostView;
}

export interface CreateCommentResponse {
  comment_view: LemmyCommentView;
}

export interface LoginResponse {
  jwt: string;
  registration_created: boolean;
  verify_email_sent: boolean;
}

// ─── Client ───────────────────────────────────────────────────────────

export class LemmyClient {
  private instanceUrl: string;
  private jwt: string | null = null;
  private userAgent: string;

  constructor(instanceUrl: string, jwt?: string, userAgent: string = DEFAULT_USER_AGENT) {
    this.instanceUrl = instanceUrl.replace(/\/$/, '');
    if (jwt) this.jwt = jwt;
    this.userAgent = userAgent;
  }

  setUserAgent(ua: string): void {
    this.userAgent = ua;
  }

  /** Set JWT auth token for write operations. */
  setAuth(jwt: string): void {
    this.jwt = jwt;
  }

  get isAuthenticated(): boolean {
    return this.jwt !== null;
  }

  // ── HTTP helpers ──────────────────────────────────────────────────

  private async api<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, string | number>,
  ): Promise<T> {
    const url = new URL(this.instanceUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      accept: 'application/json',
      'user-agent': this.userAgent,
    };
    if (this.jwt) headers.authorization = `Bearer ${this.jwt}`;
    if (body && method !== 'GET') headers['content-type'] = 'application/json';
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Lemmy API error: ${res.status} ${res.statusText}${errText ? ` - ${errText.slice(0, 200)}` : ''}`,
      );
    }
    return res.json() as Promise<T>;
  }

  private async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    return this.api<T>('GET', path, undefined, params);
  }

  private async post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    return this.api<T>('POST', path, body);
  }

  private async put<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    return this.api<T>('PUT', path, body);
  }

  // ── Auth ──────────────────────────────────────────────────────────

  /** Login to a Lemmy instance and store the JWT. */
  async login(usernameOrEmail: string, password: string): Promise<string> {
    const res = await this.post<LoginResponse>('/api/v3/user/login', {
      username_or_email: usernameOrEmail,
      password,
    });
    this.jwt = res.jwt;
    return res.jwt;
  }

  // ── Site ──────────────────────────────────────────────────────────

  /** Get site metadata (name, description, admins, counts). */
  async getSite(): Promise<LemmySiteView> {
    const res = await this.get<{ site_view: LemmySiteView }>('/api/v3/site');
    return res.site_view;
  }

  // ── Communities ───────────────────────────────────────────────────

  /** Get community details by name (local name or full name@instance). */
  async getCommunity(name: string): Promise<LemmyCommunityView> {
    const res = await this.get<GetCommunityResponse>('/api/v3/community', { name });
    return res.community_view;
  }

  /** List all communities with pagination. */
  async listCommunities(
    opts: {
      sort?: 'Hot' | 'New' | 'TopAll' | 'MostSubscribers';
      limit?: number;
      page?: number;
    } = {},
  ): Promise<LemmyCommunityView[]> {
    const params: Record<string, string | number> = {};
    if (opts.sort) params.sort = opts.sort;
    if (opts.limit) params.limit = opts.limit;
    if (opts.page) params.page = opts.page;
    const res = await this.get<ListCommunitiesResponse>(
      '/api/v3/community/list',
      Object.keys(params).length > 0 ? params : undefined,
    );
    return res.communities;
  }

  /** Search communities by name/description query. */
  async searchCommunities(
    query: string,
    opts: { limit?: number; page?: number } = {},
  ): Promise<LemmyCommunityView[]> {
    const params: Record<string, string | number> = { q: query, type_: 'Communities' };
    if (opts.limit) params.limit = opts.limit;
    if (opts.page) params.page = opts.page;
    const res = await this.get<{ communities: LemmyCommunityView[] }>(
      '/api/v3/search',
      params,
    );
    return res.communities;
  }

  /** Follow or unfollow a community. Returns updated community view. */
  async followCommunity(
    communityId: number,
    follow: boolean,
  ): Promise<LemmyCommunityView> {
    const res = await this.post<{ community_view: LemmyCommunityView }>(
      '/api/v3/community/follow',
      { community_id: communityId, follow },
    );
    return res.community_view;
  }

  // ── Posts ─────────────────────────────────────────────────────────

  /** Get posts from a community with sorting/filtering. */
  async getPosts(
    communityName: string,
    opts: {
      sort?: 'Hot' | 'New' | 'Active' | 'TopAll' | 'MostComments';
      limit?: number;
      page?: number;
      savedOnly?: boolean;
    } = {},
  ): Promise<LemmyPostView[]> {
    const params: Record<string, string | number> = {
      community_name: communityName,
    };
    if (opts.sort) params.sort = opts.sort;
    if (opts.limit) params.limit = opts.limit;
    if (opts.page) params.page = opts.page;
    if (opts.savedOnly) params.saved_only = 'true';
    const res = await this.get<GetPostsResponse>('/api/v3/post/list', params);
    return res.posts;
  }

  /** Get a single post by ID. */
  async getPost(id: number): Promise<LemmyPostView> {
    const res = await this.get<{ post_view: LemmyPostView }>('/api/v3/post', { id });
    return res.post_view;
  }

  /** Create a new post in a community. Requires auth. */
  async createPost(opts: {
    communityId: number;
    name: string;
    body?: string;
    url?: string;
    nsfw?: boolean;
    honeypot?: string; // anti-spam, must be empty
    languageId?: number;
  }): Promise<LemmyPostView> {
    const body: Record<string, unknown> = {
      community_id: opts.communityId,
      name: opts.name,
    };
    if (opts.body) body.body = opts.body;
    if (opts.url) body.url = opts.url;
    if (opts.nsfw) body.nsfw = true;
    if (opts.honeypot !== undefined) body.honeypot = opts.honeypot;
    if (opts.languageId) body.language_id = opts.languageId;
    const res = await this.post<CreatePostResponse>('/api/v3/post', body);
    return res.post_view;
  }

  /** Delete a post. Requires auth. */
  async deletePost(postId: number, deleted: boolean = true): Promise<void> {
    await this.post('/api/v3/post/delete', { post_id: postId, deleted });
  }

  /** Edit a post. Requires auth. */
  async editPost(
    postId: number,
    opts: { name?: string; body?: string; url?: string; nsfw?: boolean },
  ): Promise<LemmyPostView> {
    const body: Record<string, unknown> = { post_id: postId };
    if (opts.name !== undefined) body.name = opts.name;
    if (opts.body !== undefined) body.body = opts.body;
    if (opts.url !== undefined) body.url = opts.url;
    if (opts.nsfw !== undefined) body.nsfw = opts.nsfw;
    const res = await this.put<{ post_view: LemmyPostView }>('/api/v3/post', body);
    return res.post_view;
  }

  // ── Comments ──────────────────────────────────────────────────────

  /** Get comments for a post. */
  async getComments(
    postId: number,
    opts: { sort?: 'Hot' | 'New' | 'Old' | 'Top'; limit?: number; page?: number } = {},
  ): Promise<LemmyCommentView[]> {
    const params: Record<string, string | number> = { post_id: postId };
    if (opts.sort) params.sort = opts.sort;
    if (opts.limit) params.limit = opts.limit;
    if (opts.page) params.page = opts.page;
    const res = await this.get<GetCommentsResponse>('/api/v3/comment/list', params);
    return res.comments;
  }

  /** Create a comment. Requires auth. */
  async createComment(
    postId: number,
    content: string,
    parentId?: number,
    languageId?: number,
  ): Promise<LemmyCommentView> {
    const body: Record<string, unknown> = {
      post_id: postId,
      content,
    };
    if (parentId) body.parent_id = parentId;
    if (languageId) body.language_id = languageId;
    const res = await this.post<CreateCommentResponse>('/api/v3/comment', body);
    return res.comment_view;
  }

  /** Edit a comment. Requires auth. */
  async editComment(
    commentId: number,
    content: string,
  ): Promise<LemmyCommentView> {
    const res = await this.put<{ comment_view: LemmyCommentView }>('/api/v3/comment', {
      comment_id: commentId,
      content,
    });
    return res.comment_view;
  }

  /** Delete a comment. Requires auth. */
  async deleteComment(commentId: number, deleted: boolean = true): Promise<void> {
    await this.post('/api/v3/comment/delete', { comment_id: commentId, deleted });
  }

  // ── Voting ────────────────────────────────────────────────────────

  /** Upvote a post. Pass 0 to remove vote, -1 to downvote. */
  async voteOnPost(postId: number, score: 1 | 0 | -1): Promise<void> {
    await this.post('/api/v3/post/like', { post_id: postId, score });
  }

  upvote(postId: number): Promise<void> {
    return this.voteOnPost(postId, 1);
  }

  downvote(postId: number): Promise<void> {
    return this.voteOnPost(postId, -1);
  }

  removeVote(postId: number): Promise<void> {
    return this.voteOnPost(postId, 0);
  }

  /** Vote on a comment. Score: 1 (up), 0 (remove), -1 (down). */
  async voteOnComment(commentId: number, score: 1 | 0 | -1): Promise<void> {
    await this.post('/api/v3/comment/like', { comment_id: commentId, score });
  }

  // ── Save / bookmark ──────────────────────────────────────────────

  /** Save/bookmark a post. */
  async savePost(postId: number, save: boolean): Promise<LemmyPostView> {
    const res = await this.put<{ post_view: LemmyPostView }>('/api/v3/post/save', {
      post_id: postId,
      save,
    });
    return res.post_view;
  }
}

// ─── Normalizer ────────────────────────────────────────────────────────

export interface LemmyFeedMeta {
  instanceUrl: string;
  community?: {
    name: string;
    title?: string;
    icon?: string;
    actorId?: string;
    subscriberCount?: number;
    usersActiveMonth?: number;
  };
}

/**
 * Convert a raw LemmyPostView to a UnifiedPost for the DegenFeed feed pipeline.
 */
export function lemmyToUnifiedPost(
  postView: LemmyPostView,
  meta: LemmyFeedMeta,
): UnifiedPost {
  const { post, creator, community, counts } = postView;
  const instance = new URL(meta.instanceUrl).hostname;
  const nativeId = `lemmy:${community.name}:${post.id}`;
  const isLink = !!post.url && !post.body;
  const text = post.body || post.name || '';

  // Build identity
  const author: UnifiedIdentity = {
    id: `lemmy:${creator.id}@${instance}`,
    primary: { protocol: 'lemmy', id: String(creator.id) },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
      lemmy: `${creator.name}@${instance}`,
    },
    displayName: creator.display_name || creator.name,
    bio: creator.bio || '',
    avatarUrl: creator.avatar || '',
    bannerUrl: creator.banner,
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  };

  // Build embeds
  const embeds: Embed[] = [];
  if (post.url) {
    const isImage = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i.test(post.url);
    embeds.push({ kind: isImage ? 'image' : 'link', url: post.url });
  }
  if (post.thumbnail_url) {
    // Only add if not already covered by image URL
    if (!embeds.some((e) => e.url === post.thumbnail_url)) {
      embeds.push({ kind: 'image', url: post.thumbnail_url });
    }
  }

  return buildUnifiedPost({
    protocol: 'lemmy',
    nativeId,
    author,
    text,
    html: post.body || '',
    embeds,
    createdAt: new Date(post.published).getTime(),
    metrics: {
      likes: counts.upvotes,
      reposts: 0,
      replies: counts.comments,
      quotes: 0,
    },
    viewer: { liked: postView.my_vote === 1, bookmarked: postView.saved },
    raw: postView,
  });
}

/**
 * Convert a LemmyCommentView to a simplified comment shape for the feed.
 */
export function lemmyCommentToComment(
  commentView: LemmyCommentView,
  instanceUrl: string,
): {
  id: string;
  text: string;
  author: UnifiedIdentity;
  createdAt: number;
  score: number;
  upvotes: number;
  downvotes: number;
  path: string;
  nativeId: number;
} {
  const { comment, creator, counts } = commentView;
  const instance = new URL(instanceUrl).hostname;

  const author: UnifiedIdentity = {
    id: `lemmy:${creator.id}@${instance}`,
    primary: { protocol: 'lemmy', id: String(creator.id) },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: null,
      lemmy: `${creator.name}@${instance}`,
    },
    displayName: creator.display_name || creator.name,
    bio: creator.bio || '',
    avatarUrl: creator.avatar || '',
    bannerUrl: creator.banner,
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  };

  return {
    id: `lemmy:comment:${comment.id}`,
    text: comment.content,
    author,
    createdAt: new Date(comment.published).getTime(),
    score: counts.score,
    upvotes: counts.upvotes,
    downvotes: counts.downvotes,
    path: comment.path,
    nativeId: comment.id,
  };
}
