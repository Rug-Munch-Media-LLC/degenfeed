/**
 * Forgejo/Gitea Provider
 *
 * Fetches repository activity from Forgejo instances with ActivityPub
 * federation. Forgejo (our forge) supports ActivityPub for repository
 * events — stars, forks, releases, issues, PRs.
 *
 * API: REST at /api/v1/
 *   GET /api/v1/repos/{owner}/{repo}/activity — repo activity
 *   GET /api/v1/explore/repos — explore public repos
 *   GET /api/v1/version — server version
 *
 * ActivityPub: AP-enabled repos publish Actor and Activity objects
 *   for repo events like Star, Fork, Push, Release, Issue, PR.
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

interface ForgejoSource {
  instance: string;
  displayName: string;
  apiVersion: string;
}

const FORGEJO_INSTANCES: ForgejoSource[] = [
  { instance: 'https://git.rugmunch.io', displayName: 'RugMunch Forgejo', apiVersion: 'v1' },
  { instance: 'https://codeberg.org', displayName: 'Codeberg', apiVersion: 'v1' },
  { instance: 'https://git.disroot.org', displayName: 'Disroot Git', apiVersion: 'v1' },
];

// ─── Types ─────────────────────────────────────────────────────────────

interface ForgejoRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string; html_url: string };
  description: string;
  html_url: string;
  language: string;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  created_at: string;
  updated_at: string;
  topics: string[];
  license?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function guessRepoNiches(repo: ForgejoRepo): string[] {
  const desc = (repo.description || '').toLowerCase();
  const topics = (repo.topics || []).map((t) => t.toLowerCase());
  const lang = (repo.language || '').toLowerCase();
  const all = `${desc} ${topics.join(' ')} ${lang}`;
  const niches: string[] = [];

  if (/\b(crypto|blockchain|web3|bitcoin|ethereum|solana|defi|nft)\b/.test(all))
    niches.push('crypto');
  if (/\b(ai|artificial|intelligence|llm|machine.learning|agent)\b/.test(all)) niches.push('ai');
  if (/\b(rust|go|python|typescript|javascript|solidity|wasm)\b/.test(all))
    niches.push('programming');
  if (/\b(activitypub|fediverse|mastodon|federation|social)\b/.test(all)) niches.push('fediverse');
  if (/\b(games|gaming|engine|3d|graphics)\b/.test(all)) niches.push('gaming');
  if (/\b(data|database|sql|analytics|big.data|etl)\b/.test(all)) niches.push('data');
  if (/\b(devops|ci|cd|kubernetes|docker|infra|deploy)\b/.test(all)) niches.push('devops');
  if (/\b(security|cryptography|privacy|encryption|auth)\b/.test(all)) niches.push('security');
  if (niches.length === 0) niches.push('opensource');
  return niches;
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchExploreRepos(source: ForgejoSource, limit: number): Promise<UnifiedPost[]> {
  try {
    const res = await $fetch(
      `${source.instance}/api/${source.apiVersion}/explore/repos?sort=updated&limit=${limit}`,
      {
        headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (Forgejo)' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];

    const repos = (await res.json()) as ForgejoRepo[];
    if (!Array.isArray(repos)) return [];

    return repos.slice(0, limit).map((repo) => {
      const text = [
        `📦 ${repo.full_name}`,
        repo.description || '',
        `\n⭐ ${repo.stars_count} · 🍴 ${repo.forks_count} · 🐛 ${repo.open_issues_count}`,
        `🖥️ ${repo.language || 'N/A'}`,
      ]
        .filter(Boolean)
        .join('\n');

      return {
        id: `forgejo:repo:${repo.full_name}`,
        protocol: 'forgejo',
        author: {
          id: `forgejo:user:${repo.owner?.login || 'unknown'}`,
          primary: { protocol: 'forgejo', id: repo.owner?.login || 'unknown' },
          handles: { forgejo: repo.owner?.login || null },
          displayName: repo.owner?.login || 'Developer',
          bio: '',
          avatarUrl: repo.owner?.avatar_url || '',
          followerCount: 0,
          followingCount: 0,
          links: [{ label: 'profile', url: repo.owner?.html_url || '' }],
          keys: {},
        },
        text,
        embeds: [
          {
            kind: 'link',
            url: repo.html_url,
            meta: { title: repo.full_name, description: repo.description },
          },
        ],
        contentType: 'code',
        createdAt: new Date(repo.updated_at || repo.created_at).getTime(),
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: repo,
        niches: guessRepoNiches(repo),
      };
    });
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'forgejo',
  name: 'Forgejo/Gitea',
  description: 'Federated git repository activity with ActivityPub',
  endpoint: '/api/feed/forgejo',
  requiresAuth: false,
  contentType: 'code',
};

export async function fetchForgejoPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(5, Math.ceil(limit / FORGEJO_INSTANCES.length));

  const results = await Promise.allSettled(
    FORGEJO_INSTANCES.map((src) => fetchExploreRepos(src, perSource)),
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

  // console.log(`[bridge] Forgejo: ${deduped.length} repos/activities`);
  return deduped;
}

export const fetch = fetchForgejoPosts;
