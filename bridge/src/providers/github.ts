/**
 * GitHub Provider
 *
 * Fetches activity from GitHub — repositories, issues, pull requests,
 * releases, and discussions. GitHub is essential for tracking open-source
 * crypto projects, developer activity, and protocol development.
 *
 * API: GitHub REST API v3
 *   GET /repos/{owner}/{repo}/events — repository events
 *   GET /repos/{owner}/{repo}/releases/latest — latest release
 *   GET /repos/{owner}/{repo}/pulls — pull requests
 *   GET /repos/{owner}/{repo}/issues — issues
 *   GET /search/repositories?q=crypto+blockchain — trending repos
 *
 * Strategy:
 * 1. Public API (unauthenticated, rate limited to 60/hr)
 * 2. Authenticated API with GITHUB_TOKEN (5000/hr)
 * 3. Track trending crypto repos + specific orgs
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

interface GitHubSource {
  owner: string;
  repo?: string;
  displayName: string;
  type: 'repo' | 'org' | 'trending';
}

const TRACKED_SOURCES: GitHubSource[] = [
  { owner: 'bitcoin', repo: 'bitcoin', displayName: 'Bitcoin Core', type: 'repo' },
  { owner: 'ethereum', repo: 'go-ethereum', displayName: 'Ethereum (geth)', type: 'repo' },
  { owner: 'solana-labs', repo: 'solana', displayName: 'Solana Labs', type: 'repo' },
  { owner: 'Uniswap', repo: 'v3-core', displayName: 'Uniswap V3 Core', type: 'repo' },
  {
    owner: 'OpenZeppelin',
    repo: 'openzeppelin-contracts',
    displayName: 'OpenZeppelin Contracts',
    type: 'repo',
  },
  { owner: 'AcalaNetwork', repo: 'Acala', displayName: 'Acala Network', type: 'repo' },
  { owner: 'ChainSafe', repo: 'lodestar', displayName: 'Lodestar (ETH Consensus)', type: 'repo' },
  { owner: 'NomicFoundation', repo: 'hardhat', displayName: 'Hardhat', type: 'repo' },
  { owner: 'foundry-rs', repo: 'foundry', displayName: 'Foundry', type: 'repo' },
  { owner: 'RareSkills', repo: 'solidity-puzzles', displayName: 'Solidity Puzzles', type: 'repo' },
  { owner: 'degentoken', displayName: 'Degen Token', type: 'org' },
  { owner: 'RugMunchMedia', displayName: 'Rug Munch Media', type: 'org' },
  { owner: 'trending', displayName: 'Trending Crypto Repos', type: 'trending' },
];

const GITHUB_API = 'https://api.github.com';

// ─── Types ─────────────────────────────────────────────────────────────

interface GitHubActor {
  id: number;
  login: string;
  display_login?: string;
  gravatar_id?: string;
  url: string;
  avatar_url: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  url: string;
  description?: string;
  html_url?: string;
  language?: string;
  stargazers_count?: number;
  forks_count?: number;
  topics?: string[];
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: string;
  html_url: string;
  user: { login: string; avatar_url: string; html_url: string };
  labels: Array<{ name: string; color: string }>;
  created_at: string;
  updated_at: string;
  comments: number;
  reactions?: { '+1': number; '-1': number; laugh: number; heart: number; hooray: number };
  pull_request?: unknown;
}

interface GitHubEvent {
  id: string;
  type: string;
  actor: GitHubActor;
  repo: GitHubRepo;
  payload: Record<string, unknown>;
  public: boolean;
  created_at: string;
}

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body?: string;
  html_url: string;
  author: { login: string; avatar_url: string };
  published_at: string;
  prerelease: boolean;
}

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: string;
  html_url: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  merged_at?: string;
  draft: boolean;
  labels: Array<{ name: string }>;
}

interface GitHubSearchResult {
  total_count: number;
  items: Array<{
    id: number;
    full_name: string;
    name: string;
    owner: { login: string; avatar_url: string };
    description: string;
    html_url: string;
    language: string;
    stargazers_count: number;
    forks_count: number;
    topics: string[];
    created_at: string;
    updated_at: string;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'DegenFeed-Bridge/0.1',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function guessGitHubNiches(text: string, repoName?: string, lang?: string): string[] {
  const lower = `${text} ${repoName || ''} ${lang || ''}`.toLowerCase();
  const niches: string[] = [];
  if (
    /\b(crypto|bitcoin|btc|ethereum|eth|solana|sol|defi|nft|web3|blockchain|token|altcoin)\b/.test(
      lower,
    )
  )
    niches.push('crypto');
  if (
    /\b(ai|artificial|intelligence|llm|machine.learning|gpt|openai|anthropic|claude|deepseek|agent)\b/.test(
      lower,
    )
  )
    niches.push('ai');
  if (
    /\b(solidity|evm|smart.contract|defi|dex|amm|swap|pool|liquidity|yield|staking)\b/.test(lower)
  )
    niches.push('defi');
  if (/\b(security|audit|vulnerability|exploit|hack|patch|fix|cve|cryptography)\b/.test(lower))
    niches.push('security');
  if (
    /\b(rust|go|golang|typescript|javascript|python|compiler|zksnark|zero.knowledge)\b/.test(lower)
  )
    niches.push('tech');
  if (/\b(privacy|encryption|signal|anonymous|decentralized|federation|p2p)\b/.test(lower))
    niches.push('privacy');
  if (/\b(gaming|game|engine|3d|graphics|metaverse)\b/.test(lower)) niches.push('gaming');
  if (/\b(data|database|sql|analytics|big.data|etl|parquet|arrow)\b/.test(lower))
    niches.push('data');
  if (/\b(devops|ci|cd|kubernetes|docker|infra|deploy|action)\b/.test(lower)) niches.push('devops');
  if (/\b(protocol|layer2|l2|rollup|bridge|scaling|sharding)\b/.test(lower))
    niches.push('protocol');
  if (niches.length === 0) niches.push('opensource');
  return niches;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = now - date;
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return dateStr.slice(0, 10);
}

// ─── Mapping ──────────────────────────────────────────────────────────

function eventToPost(event: GitHubEvent): UnifiedPost | null {
  const repoFullName = event.repo.name;
  const [owner] = repoFullName.split('/');
  const actorName = event.actor.display_login || event.actor.login;
  const time = new Date(event.created_at).getTime();

  let text = '';
  let contentType = 'text';

  switch (event.type) {
    case 'PushEvent': {
      const commits = event.payload.commits as Array<{ message: string; sha: string }> | undefined;
      const commitCount = commits?.length || 0;
      const firstMsg = commits?.[0]?.message?.split('\n')[0] || '';
      text = `📤 [${repoFullName}] ${actorName} pushed ${commitCount} commit${commitCount !== 1 ? 's' : ''}: ${firstMsg}`;
      contentType = 'code';
      break;
    }
    case 'IssuesEvent': {
      const issue = event.payload.issue as GitHubIssue | undefined;
      const action = (event.payload.action as string) || 'opened';
      text = `🐛 [${repoFullName}] ${actorName} ${action} issue #${issue?.number}: ${issue?.title || ''}`;
      contentType = 'text';
      break;
    }
    case 'IssueCommentEvent': {
      const commentIssue = event.payload.issue as GitHubIssue | undefined;
      text = `💬 [${repoFullName}] ${actorName} commented on issue #${commentIssue?.number}: ${commentIssue?.title || ''}`;
      break;
    }
    case 'PullRequestEvent': {
      const pr = event.payload.pull_request as GitHubPullRequest | undefined;
      const prAction = (event.payload.action as string) || 'opened';
      text = `🔀 [${repoFullName}] ${actorName} ${prAction} PR #${pr?.number}: ${pr?.title || ''}`;
      contentType = 'code';
      break;
    }
    case 'CreateEvent': {
      const ref = (event.payload.ref as string) || '';
      const refType = (event.payload.ref_type as string) || 'ref';
      text = `📦 [${repoFullName}] ${actorName} created ${refType} ${ref}`;
      break;
    }
    case 'ReleaseEvent': {
      const release = event.payload.release as GitHubRelease | undefined;
      text = `🏷️ [${repoFullName}] ${actorName} released ${release?.tag_name || ''}: ${release?.name || ''}`;
      contentType = 'code';
      break;
    }
    case 'WatchEvent': {
      text = `⭐ [${repoFullName}] ${actorName} starred this repo`;
      break;
    }
    case 'ForkEvent': {
      text = `🔀 [${repoFullName}] ${actorName} forked the repo`;
      break;
    }
    default:
      return null;
  }

  const repoDesc = event.repo.description || '';

  return {
    id: `github:${event.id}`,
    protocol: 'github',
    author: {
      id: `github:${event.actor.login}`,
      primary: { protocol: 'github', id: event.actor.login },
      handles: { github: event.actor.login },
      displayName: actorName,
      bio: '',
      avatarUrl: event.actor.avatar_url,
      followerCount: 0,
      followingCount: 0,
      links: [{ label: 'GitHub', url: `https://github.com/${event.actor.login}` }],
      keys: { githubUsername: event.actor.login, githubRepo: repoFullName },
    },
    text: text.slice(0, 2000),
    embeds: [
      {
        kind: 'link',
        url: `https://github.com/${repoFullName}`,
        meta: { title: repoFullName, description: repoDesc },
      },
    ],
    contentType,
    createdAt: time,
    metrics: {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: undefined,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: event,
    niches: guessGitHubNiches(text, repoFullName, event.repo.language),
  };
}

function repoToPost(repo: GitHubSearchResult['items'][0]): UnifiedPost {
  const description = repo.description || 'No description';
  const topics = (repo.topics || []).slice(0, 5).join(', ');

  const text = [
    `📦 ${repo.full_name}`,
    `⭐ ${repo.stargazers_count} stars | 🍴 ${repo.forks_count} forks`,
    repo.language ? `🔧 ${repo.language}` : '',
    description.slice(0, 500),
    topics ? `🏷️ ${topics}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: `github:repo:${repo.full_name}`,
    protocol: 'github',
    author: {
      id: `github:${repo.owner.login}`,
      primary: { protocol: 'github', id: repo.owner.login },
      handles: { github: repo.owner.login },
      displayName: repo.owner.login,
      bio: description.slice(0, 160),
      avatarUrl: repo.owner.avatar_url,
      followerCount: repo.stargazers_count,
      followingCount: 0,
      links: [{ label: 'GitHub', url: repo.html_url }],
      keys: { githubUsername: repo.owner.login, githubRepo: repo.full_name },
    },
    text,
    embeds: [{ kind: 'link', url: repo.html_url, meta: { title: repo.full_name, description } }],
    contentType: 'code',
    createdAt: new Date(repo.updated_at).getTime(),
    metrics: {
      likes: repo.stargazers_count,
      reposts: repo.forks_count,
      replies: 0,
      quotes: 0,
      views: undefined,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: repo.stargazers_count, reposts: repo.forks_count, replies: 0, quotes: 0 },
    },
    raw: repo,
    niches: guessGitHubNiches(description, repo.full_name, repo.language),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchRepoEvents(source: GitHubSource, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = source.repo
      ? `${GITHUB_API}/repos/${source.owner}/${source.repo}/events?per_page=${Math.min(limit, 30)}`
      : `${GITHUB_API}/orgs/${source.owner}/events?per_page=${Math.min(limit, 30)}`;

    const res = await $fetch(url, {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    // Handle rate limiting
    if (res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0') {
      console.log('[bridge] GitHub API rate limited');
      return [];
    }

    const events = (await res.json()) as GitHubEvent[];
    if (!Array.isArray(events)) return [];

    return events
      .map((e) => eventToPost(e))
      .filter((p): p is UnifiedPost => p !== null)
      .slice(0, limit);
  } catch (err) {
    console.log(
      `[bridge] GitHub fetch error (${source.owner}/${source.repo || ''}): ${(err as Error).message}`,
    );
    return [];
  }
}

async function fetchTrendingRepos(limit: number): Promise<UnifiedPost[]> {
  try {
    // Search for recently updated crypto/blockchain repos
    const query = encodeURIComponent(
      'topic:crypto topic:blockchain topic:web3 topic:defi sort:updated',
    );
    const url = `${GITHUB_API}/search/repositories?q=${query}&per_page=${Math.min(limit, 30)}&sort=updated&order=desc`;

    const res = await $fetch(url, {
      headers: getAuthHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as GitHubSearchResult;
    if (!data?.items || !Array.isArray(data.items)) return [];

    return data.items.map((item) => repoToPost(item)).slice(0, limit);
  } catch (err) {
    console.log(`[bridge] GitHub trending fetch error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'github',
  name: 'GitHub',
  description: 'GitHub repository activity, issues, PRs, and releases',
  endpoint: '/api/feed/github',
  requiresAuth: false,
  contentType: 'code',
};

export async function fetchGitHubPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(2, Math.ceil(limit / TRACKED_SOURCES.length));

  const results = await Promise.allSettled(
    TRACKED_SOURCES.map((src) => {
      if (src.type === 'trending') return fetchTrendingRepos(perSource);
      return fetchRepoEvents(src, perSource);
    }),
  );

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] GitHub: ${deduped.length} events`);
  return deduped;
}

export const fetch = fetchGitHubPosts;
