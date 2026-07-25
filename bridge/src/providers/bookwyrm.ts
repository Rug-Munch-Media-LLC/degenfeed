/**
 * BookWyrm Provider
 *
 * Fetches book reviews, reading lists, and statuses from BookWyrm instances.
 * BookWyrm is a federated, open-source book tracking platform (Goodreads alternative)
 * that uses ActivityPub for federation.
 *
 * API: REST at /api/
 *   GET /api/ — API root
 *   GET /api/books/ — list books
 *   GET /api/reviews/ — list reviews
 *   GET /api/statuses/ — list statuses
 *   GET /api/users/ — list users
 *
 * ActivityPub: standard AP objects (Note, Article, Book type extensions)
 *
 * Strategy:
 * 1. Public timeline from DegenFeed BookWyrm fork
 * 2. Known public BookWyrm instances
 * 3. ActivityPub inbox scraping for book activities
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

interface BookWyrmSource {
  instance: string;
  displayName: string;
}

const CURATED_INSTANCES: BookWyrmSource[] = [
  { instance: 'http://127.0.0.1:8097', displayName: 'DegenFeed Books' },
  { instance: 'https://bookwyrm.social', displayName: 'BookWyrm Social' },
  { instance: 'https://books.theunseen.blog', displayName: 'The Unseen Books' },
  { instance: 'https://uwu.lgbt', displayName: 'uwu.lgbt Books' },
];

// ─── Types ─────────────────────────────────────────────────────────────

interface BookWyrmStatus {
  id: number;
  content: string;
  content_html?: string;
  created: string;
  updated?: string;
  user?: {
    id: number;
    username: string;
    display_name: string;
    avatar?: string;
    summary?: string;
  };
  book?: {
    id: number;
    title: string;
    author: string;
    cover?: string;
    isbn?: string;
    description?: string;
  };
  status_type: 'review' | 'comment' | 'quotation' | 'note' | 'shelf_change';
  rating?: number;
  privacy?: 'public' | 'followers' | 'private';
  likes_count?: number;
  comments_count?: number;
}

interface BookWyrmFeedResponse {
  statuses?: BookWyrmStatus[];
  results?: BookWyrmStatus[];
  next?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessBookNiches(text: string, bookTitle?: string, author?: string): string[] {
  const lower = `${text} ${bookTitle || ''} ${author || ''}`.toLowerCase();
  const niches: string[] = [];

  if (/\b(bitcoin|crypto|blockchain|web3|defi|nft|ethereum|solana)\b/.test(lower))
    niches.push('crypto');
  if (/\b(ai|artificial|intelligence|machine.learning|llm|deep.learning)\b/.test(lower))
    niches.push('ai');
  if (/\b(tech|technology|programming|software|code|startup)\b/.test(lower)) niches.push('tech');
  if (/\b(science|physics|biology|chemistry|space|genetics)\b/.test(lower)) niches.push('science');
  if (/\b(fiction|novel|fantasy|sci.fi|mystery|romance)\b/.test(lower)) niches.push('fiction');
  if (/\b(history|biography|memoir|essay|philosophy)\b/.test(lower)) niches.push('nonfiction');
  if (/\b(finance|economics|investing|money|trading)\b/.test(lower)) niches.push('finance');
  if (/\b(self.help|psychology|mindfulness|productivity)\b/.test(lower))
    niches.push('self-improvement');

  if (niches.length === 0) niches.push('books');
  return niches;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function bookwyrmStatusToPost(status: BookWyrmStatus, source: BookWyrmSource): UnifiedPost {
  const text = status.content
    ? stripHtml(status.content).slice(0, 2000)
    : status.book
      ? `📖 ${status.book.title} by ${status.book.author}`
      : '';

  const statusTypeLabel =
    status.status_type === 'review'
      ? `⭐ Review (${status.rating || 'unrated'}/5): `
      : status.status_type === 'comment'
        ? '💬 Comment: '
        : status.status_type === 'quotation'
          ? '📝 Quote: '
          : status.status_type === 'shelf_change'
            ? '📚 Reading update: '
            : '';

  const fullText = `${statusTypeLabel}${text}`;

  return {
    id: `bookwyrm:${status.id}@${source.instance}`,
    protocol: 'bookwyrm',
    author: {
      id: `bookwyrm:user:${status.user?.id || 0}@${source.instance}`,
      primary: { protocol: 'bookwyrm', id: String(status.user?.username || 'unknown') },
      handles: { bookwyrm: status.user?.username || null },
      displayName: status.user?.display_name || status.user?.username || 'Unknown Reader',
      bio: status.user?.summary ? stripHtml(status.user.summary) : '',
      avatarUrl: status.user?.avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: fullText,
    embeds: [
      ...(status.book
        ? [
            {
              kind: 'book' as const,
              url: `${source.instance}/book/${status.book.id}`,
              meta: {
                title: status.book.title,
                author: status.book.author,
                isbn: status.book.isbn || '',
                cover: status.book.cover || '',
              },
            },
          ]
        : []),
      ...(status.book?.cover ? [{ kind: 'image' as const, url: status.book.cover }] : []),
    ],
    contentType: status.status_type === 'review' ? 'review' : 'text',
    createdAt: new Date(status.created).getTime(),
    metrics: {
      likes: status.likes_count || 0,
      reposts: 0,
      replies: status.comments_count || 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: status.likes_count || 0,
        reposts: 0,
        replies: status.comments_count || 0,
        quotes: 0,
      },
    },
    raw: status,
    niches: guessBookNiches(text, status.book?.title, status.book?.author),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchFromInstance(source: BookWyrmSource, limit: number): Promise<UnifiedPost[]> {
  try {
    // Try the public timeline endpoint
    const res = await $fetch(`${source.instance}/api/statuses/?limit=${limit}`, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1 (BookWyrm)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as BookWyrmFeedResponse;
    const statuses = data.statuses || data.results || [];
    if (!Array.isArray(statuses)) return [];

    return statuses
      .filter((s: BookWyrmStatus) => s.privacy === 'public')
      .slice(0, limit)
      .map((s: BookWyrmStatus) => bookwyrmStatusToPost(s, source));
  } catch {
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'bookwyrm',
  name: 'BookWyrm',
  description: 'Federated book tracking and reviews (Goodreads alternative)',
  endpoint: '/api/feed/bookwyrm',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchBookWyrmPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(3, Math.ceil(limit / CURATED_INSTANCES.length));

  const results = await Promise.allSettled(
    CURATED_INSTANCES.map((src) => fetchFromInstance(src, perSource)),
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

  console.log(`[bridge] BookWyrm: ${deduped.length} statuses`);
  return deduped;
}

export const fetch = fetchBookWyrmPosts;
