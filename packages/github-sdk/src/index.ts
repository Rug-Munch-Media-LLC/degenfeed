/**
 * @degenfeed/github-sdk
 *
 * GitHub REST API client for repo management, releases, PRs, issues, and search.
 * Uses `fetch()` throughout - compatible with Cloudflare Workers, Node 18+.
 *
 * @see https://docs.github.com/en/rest
 */

import type { Protocol } from '@degenfeed/types';

export type { Protocol };

// ─── Constants ─────────────────────────────────────────────────────

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_MAX_RETRIES = 3;

// ─── Error Types ───────────────────────────────────────────────────

export class GitHubError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'GitHubError';
    this.statusCode = statusCode;
  }
}

export class GitHubRateLimitError extends GitHubError {
  public readonly resetAt: number;
  public readonly remaining: number;
  public readonly limit: number;
  constructor(resetAt: number, remaining: number, limit: number) {
    super('GitHub API rate limit exceeded', 403);
    this.name = 'GitHubRateLimitError';
    this.resetAt = resetAt;
    this.remaining = remaining;
    this.limit = limit;
  }
}

// ─── Types ─────────────────────────────────────────────────────────

export interface GHUser {
  login: string;
  id: number;
  nodeId: string;
  avatarUrl: string;
  htmlUrl: string;
  type: 'User' | 'Organization';
  name?: string;
  company?: string;
  blog?: string;
  location?: string;
  email?: string;
  bio?: string;
  twitterUsername?: string;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string;
}
export interface GHRepo {
  id: number;
  name: string;
  fullName: string;
  owner: GHUser;
  private: boolean;
  htmlUrl: string;
  description?: string;
  fork: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  size: number;
  stargazersCount: number;
  watchersCount: number;
  language?: string;
  forksCount: number;
  openIssuesCount: number;
  defaultBranch: string;
  topics: string[];
  visibility: 'public' | 'private';
  license?: { key: string; name: string; url?: string };
  archived: boolean;
}
export interface GHRelease {
  id: number;
  tagName: string;
  targetCommitish: string;
  name?: string;
  body?: string;
  draft: boolean;
  prerelease: boolean;
  createdAt: string;
  publishedAt: string;
  htmlUrl: string;
  author: GHUser;
}
export interface GHCommit {
  sha: string;
  commit: { author: { name: string; email: string; date: string }; message: string };
  htmlUrl: string;
  author?: GHUser | null;
}
export interface GHIssue {
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body?: string;
  htmlUrl: string;
  user: GHUser;
  labels: Array<{ name: string; color: string }>;
  assignees: GHUser[];
  comments: number;
  createdAt: string;
  updatedAt: string;
}
export interface GHContent {
  type: 'file' | 'dir' | 'symlink';
  name: string;
  path: string;
  content?: string;
  sha: string;
  htmlUrl: string;
  downloadUrl?: string;
}
export interface GHPr {
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body?: string;
  htmlUrl: string;
  user: GHUser;
  head: { ref: string; sha: string; repo?: GHRepo };
  base: { ref: string; sha: string; repo?: GHRepo };
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
}

// ─── Main Client ───────────────────────────────────────────────────

export class GitHubClient {
  private token?: string;
  private baseUrl: string;
  private userAgent: string;

  constructor(token?: string, opts?: { baseUrl?: string; userAgent?: string }) {
    this.token = token;
    this.baseUrl = opts?.baseUrl ?? GITHUB_API_BASE;
    this.userAgent = opts?.userAgent ?? 'DegenFeed/0.1 (+https://degenfeed.xyz)';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'user-agent': this.userAgent,
      accept: 'application/vnd.github.v3+json',
    };
    if (this.token) headers.authorization = `Bearer ${this.token}`;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < GITHUB_MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(100 * 2 ** attempt);
      try {
        const url = `${this.baseUrl}${path}`;
        const reqBody = body ? JSON.stringify(body) : undefined;
        if (body) headers['content-type'] = 'application/json';

        const res = await fetch(url, { method, headers, body: reqBody });

        // Rate limit tracking
        const remaining = res.headers.get('x-ratelimit-remaining');
        if (remaining === '0') {
          const resetAt = Number(res.headers.get('x-ratelimit-reset') ?? '0') * 1000;
          const limit = Number(res.headers.get('x-ratelimit-limit') ?? '60');
          if (attempt < GITHUB_MAX_RETRIES - 1) {
            const waitMs = Math.max(1000, resetAt - Date.now());
            await sleep(waitMs);
            continue;
          }
          throw new GitHubRateLimitError(resetAt, 0, limit);
        }

        if (!res.ok)
          throw new GitHubError(`GitHub API error ${res.status}: ${res.statusText}`, res.status);
        if (res.status === 204 || res.status === 202) return undefined as unknown as T;
        const text = await res.text();
        return text.length > 0 ? (JSON.parse(text) as T) : (undefined as unknown as T);
      } catch (err) {
        if (err instanceof GitHubError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < GITHUB_MAX_RETRIES - 1) continue;
      }
    }
    throw lastError ?? new GitHubError('GitHub request failed after retries', 0);
  }

  async getAuthenticatedUser(): Promise<GHUser> {
    const u = await this.request<{
      login: string;
      id: number;
      node_id: string;
      avatar_url: string;
      html_url: string;
      type: 'User' | 'Organization';
      name?: string;
      company?: string;
      blog?: string;
      location?: string;
      email?: string;
      bio?: string;
      twitter_username?: string;
      public_repos: number;
      followers: number;
      following: number;
      created_at: string;
    }>('GET', '/user');
    return this.normalizeUser(u);
  }

  async getUser(username: string): Promise<GHUser> {
    const u = await this.request<Record<string, unknown>>('GET', `/users/${username}`);
    return this.normalizeUser(u as Record<string, unknown>);
  }

  async getRepo(owner: string, repo: string): Promise<GHRepo> {
    return this.normalizeRepo(
      await this.request<Record<string, unknown>>('GET', `/repos/${owner}/${repo}`),
    );
  }

  async createIssue(
    owner: string,
    repo: string,
    title: string,
    opts?: { body?: string; labels?: string[]; assignees?: string[] },
  ): Promise<GHIssue> {
    const b: Record<string, unknown> = { title };
    if (opts?.body) b.body = opts.body;
    if (opts?.labels) b.labels = opts.labels;
    if (opts?.assignees) b.assignees = opts.assignees;
    return this.normalizeIssue(
      await this.request<Record<string, unknown>>('POST', `/repos/${owner}/${repo}/issues`, b),
    );
  }

  async createPR(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string,
  ): Promise<GHPr> {
    const b: Record<string, unknown> = { title, head, base };
    if (body) b.body = body;
    return this.normalizePr(
      await this.request<Record<string, unknown>>('POST', `/repos/${owner}/${repo}/pulls`, b),
    );
  }

  async getReleases(
    owner: string,
    repo: string,
    opts?: { perPage?: number; page?: number },
  ): Promise<GHRelease[]> {
    const q = new URLSearchParams();
    if (opts?.perPage) q.set('per_page', String(opts.perPage));
    if (opts?.page) q.set('page', String(opts.page));
    const items = await this.request<Record<string, unknown>[]>(
      'GET',
      `/repos/${owner}/${repo}/releases?${q.toString()}`,
    );
    return items.map((i) => this.normalizeRelease(i));
  }

  async getLatestRelease(owner: string, repo: string): Promise<GHRelease | null> {
    try {
      return this.normalizeRelease(
        await this.request<Record<string, unknown>>(
          'GET',
          `/repos/${owner}/${repo}/releases/latest`,
        ),
      );
    } catch {
      return null;
    }
  }

  async getCommits(
    owner: string,
    repo: string,
    opts?: { sha?: string; path?: string; since?: string; until?: string; perPage?: number },
  ): Promise<GHCommit[]> {
    const q = new URLSearchParams();
    if (opts?.sha) q.set('sha', opts.sha);
    if (opts?.path) q.set('path', opts.path);
    if (opts?.since) q.set('since', opts.since);
    if (opts?.until) q.set('until', opts.until);
    if (opts?.perPage) q.set('per_page', String(opts.perPage));
    const items = await this.request<Record<string, unknown>[]>(
      'GET',
      `/repos/${owner}/${repo}/commits?${q.toString()}`,
    );
    return items.map((i) => this.normalizeCommit(i));
  }

  async getContents(owner: string, repo: string, path: string): Promise<GHContent> {
    return this.normalizeContent(
      await this.request<Record<string, unknown>>(
        'GET',
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      ),
    );
  }

  async getStars(owner: string, repo: string): Promise<number> {
    const r = await this.getRepo(owner, repo);
    return r.stargazersCount;
  }

  async getForks(owner: string, repo: string): Promise<number> {
    const r = await this.getRepo(owner, repo);
    return r.forksCount;
  }

  async searchRepositories(query: string): Promise<{ items: GHRepo[]; totalCount: number }> {
    const result = await this.request<{ items: Record<string, unknown>[]; total_count: number }>(
      'GET',
      `/search/repositories?q=${encodeURIComponent(query)}`,
    );
    return {
      items: result.items.map((i) => this.normalizeRepo(i)),
      totalCount: result.total_count,
    };
  }

  async searchCode(query: string): Promise<{
    items: Array<{ name: string; path: string; htmlUrl: string }>;
    totalCount: number;
  }> {
    const result = await this.request<{ items: Record<string, unknown>[]; total_count: number }>(
      'GET',
      `/search/code?q=${encodeURIComponent(query)}`,
    );
    return {
      items: result.items.map((i) => ({
        name: String(i.name ?? ''),
        path: String(i.path ?? ''),
        htmlUrl: String((i as Record<string, unknown>).html_url ?? ''),
      })),
      totalCount: result.total_count,
    };
  }

  async graphql<R = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<R> {
    const result = await this.request<{ data?: R; errors?: Array<{ message: string }> }>(
      'POST',
      '/graphql',
      { query, variables },
    );
    if (result.errors?.length)
      throw new GitHubError(
        `GraphQL error: ${result.errors.map((e) => e.message).join('; ')}`,
        422,
      );
    return result.data as R;
  }

  // ─── Normalizers ──────────────────────────────────────────────

  private normalizeUser(u: Record<string, unknown>): GHUser {
    return {
      login: String(u.login ?? ''),
      id: Number(u.id),
      nodeId: String(u.node_id ?? ''),
      avatarUrl: String(u.avatar_url ?? ''),
      htmlUrl: String(u.html_url ?? ''),
      type: u.type as 'User' | 'Organization',
      name: u.name as string | undefined,
      company: u.company as string | undefined,
      blog: u.blog as string | undefined,
      location: u.location as string | undefined,
      email: u.email as string | undefined,
      bio: u.bio as string | undefined,
      twitterUsername: u.twitter_username as string | undefined,
      publicRepos: Number(u.public_repos ?? 0),
      followers: Number(u.followers ?? 0),
      following: Number(u.following ?? 0),
      createdAt: String(u.created_at ?? ''),
    };
  }

  private normalizeRepo(r: Record<string, unknown>): GHRepo {
    return {
      id: Number(r.id),
      name: String(r.name ?? ''),
      fullName: String(r.full_name ?? ''),
      owner: this.normalizeUser((r.owner ?? {}) as Record<string, unknown>),
      private: Boolean(r.private),
      htmlUrl: String(r.html_url ?? ''),
      description: r.description as string | undefined,
      fork: Boolean(r.fork),
      createdAt: String(r.created_at ?? ''),
      updatedAt: String(r.updated_at ?? ''),
      pushedAt: String(r.pushed_at ?? ''),
      size: Number(r.size),
      stargazersCount: Number(r.stargazers_count ?? 0),
      watchersCount: Number(r.watchers_count ?? 0),
      language: r.language as string | undefined,
      forksCount: Number(r.forks_count ?? 0),
      openIssuesCount: Number(r.open_issues_count ?? 0),
      defaultBranch: String(r.default_branch ?? 'main'),
      topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
      visibility: ((r.visibility as string) ?? 'public') as 'public' | 'private',
      license: r.license
        ? {
            key: String((r.license as Record<string, unknown>).key ?? ''),
            name: String((r.license as Record<string, unknown>).name ?? ''),
          }
        : undefined,
      archived: Boolean(r.archived),
    };
  }

  private normalizeRelease(r: Record<string, unknown>): GHRelease {
    return {
      id: Number(r.id),
      tagName: String(r.tag_name ?? ''),
      targetCommitish: String(r.target_commitish ?? ''),
      name: r.name as string | undefined,
      body: r.body as string | undefined,
      draft: Boolean(r.draft),
      prerelease: Boolean(r.prerelease),
      createdAt: String(r.created_at ?? ''),
      publishedAt: String(r.published_at ?? ''),
      htmlUrl: String(r.html_url ?? ''),
      author: this.normalizeUser((r.author ?? {}) as Record<string, unknown>),
    };
  }

  private normalizeCommit(c: Record<string, unknown>): GHCommit {
    const commitData = (c.commit ?? {}) as Record<string, unknown>;
    const authorData = (commitData.author ?? {}) as Record<string, unknown>;
    return {
      sha: String(c.sha ?? ''),
      htmlUrl: String(c.html_url ?? ''),
      commit: {
        author: {
          name: String(authorData.name ?? ''),
          email: String(authorData.email ?? ''),
          date: String(authorData.date ?? ''),
        },
        message: String(commitData.message ?? ''),
      },
      author: (c.author as GHUser | null) ?? null,
    };
  }

  private normalizeIssue(i: Record<string, unknown>): GHIssue {
    const labels = (i.labels ?? []) as Array<Record<string, unknown>>;
    return {
      id: Number(i.id),
      number: Number(i.number),
      state: i.state as 'open' | 'closed',
      title: String(i.title ?? ''),
      body: i.body as string | undefined,
      htmlUrl: String(i.html_url ?? ''),
      user: this.normalizeUser((i.user ?? {}) as Record<string, unknown>),
      labels: labels.map((l) => ({ name: String(l.name ?? ''), color: String(l.color ?? '') })),
      assignees: ((i.assignees ?? []) as Record<string, unknown>[]).map((a) =>
        this.normalizeUser(a),
      ),
      comments: Number(i.comments ?? 0),
      createdAt: String(i.created_at ?? ''),
      updatedAt: String(i.updated_at ?? ''),
    };
  }

  private normalizeContent(c: Record<string, unknown>): GHContent {
    return {
      type: c.type as 'file' | 'dir' | 'symlink',
      name: String(c.name ?? ''),
      path: String(c.path ?? ''),
      content: c.content as string | undefined,
      sha: String(c.sha ?? ''),
      htmlUrl: String(c.html_url ?? ''),
      downloadUrl: c.download_url as string | undefined,
    };
  }

  private normalizePr(p: Record<string, unknown>): GHPr {
    const head = (p.head ?? {}) as Record<string, unknown>;
    const base = (p.base ?? {}) as Record<string, unknown>;
    return {
      id: Number(p.id),
      number: Number(p.number),
      state: p.state as 'open' | 'closed',
      title: String(p.title ?? ''),
      body: p.body as string | undefined,
      htmlUrl: String(p.html_url ?? ''),
      user: this.normalizeUser((p.user ?? {}) as Record<string, unknown>),
      head: { ref: String(head.ref ?? ''), sha: String(head.sha ?? '') },
      base: { ref: String(base.ref ?? ''), sha: String(base.sha ?? '') },
      createdAt: String(p.created_at ?? ''),
      updatedAt: String(p.updated_at ?? ''),
      mergedAt: p.merged_at as string | undefined,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
