import type { Env } from '../index';
import { getCommunityById } from './feddy-community';
import { getStore, k } from './feddy-constants';
import type {
  BadgeDefinition,
  CommunityEvent,
  CommunityPoll,
  CommunityPost,
  EventRSVP,
  PollVote,
  WikiPage,
} from './feddy-types';

export async function addCommunityPost(
  env: Env,
  communityId: string,
  post: CommunityPost,
): Promise<void> {
  const store = getStore(env);
  const postKey = k('feddy', 'posts', communityId, String(post.createdAt), post.id);

  await Promise.all([
    store.put(postKey, JSON.stringify(post), { expirationTtl: 86400 * 90 }),
    (async () => {
      const feedKey = k('feddy', 'feed', communityId);
      const raw = await store.get(feedKey);
      const feed: string[] = raw ? JSON.parse(raw) : [];
      feed.unshift(postKey);
      if (feed.length > 500) feed.length = 500;
      await store.put(feedKey, JSON.stringify(feed));
    })(),
    (async () => {
      const community = await getCommunityById(env, communityId);
      if (community) {
        community.totalPosts += 1;
        community.updatedAt = Date.now();
        await store.put(k('feddy', communityId), JSON.stringify(community));
      }
    })(),
  ]);
}

export async function getCommunityPosts(
  env: Env,
  communityId: string,
  limit = 50,
  cursor?: string,
): Promise<{
  posts: CommunityPost[];
  cursor: string | null;
  hasMore: boolean;
}> {
  try {
    const store = getStore(env);
    const feedKey = k('feddy', 'feed', communityId);
    const raw = await store.get(feedKey);
    if (!raw) return { posts: [], cursor: null, hasMore: false };

    const feed: string[] = JSON.parse(raw);
    const startIdx = cursor ? feed.indexOf(cursor) + 1 : 0;
    if (startIdx < 0 || startIdx >= feed.length) {
      return { posts: [], cursor: null, hasMore: false };
    }

    const batch = feed.slice(startIdx, startIdx + limit + 1);
    const hasMore = batch.length > limit;
    const postKeys = batch.slice(0, limit);

    const posts: CommunityPost[] = [];
    for (const key of postKeys) {
      const postRaw = await store.get(key);
      if (postRaw) {
        posts.push(JSON.parse(postRaw) as CommunityPost);
      }
    }

    return {
      posts,
      cursor: hasMore && postKeys.length > 0 ? (postKeys[postKeys.length - 1] ?? null) : null,
      hasMore,
    };
  } catch {
    return { posts: [], cursor: null, hasMore: false };
  }
}

// ─── Pinned Posts ──────────────────────────────────────────────────────

export async function pinPost(env: Env, communityId: string, postId: string): Promise<boolean> {
  try {
    const store = getStore(env);
    const key = k('feddy', 'pinned', communityId);
    const raw = await store.get(key);
    const pinned: string[] = raw ? JSON.parse(raw) : [];
    if (!pinned.includes(postId)) {
      pinned.unshift(postId);
      await store.put(key, JSON.stringify(pinned));
    }
    return true;
  } catch {
    return false;
  }
}

export async function unpinPost(env: Env, communityId: string, postId: string): Promise<boolean> {
  try {
    const store = getStore(env);
    const key = k('feddy', 'pinned', communityId);
    const raw = await store.get(key);
    if (!raw) return false;
    const pinned: string[] = JSON.parse(raw);
    const filtered = pinned.filter((id) => id !== postId);
    await store.put(key, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}

export async function getPinnedPosts(env: Env, communityId: string): Promise<CommunityPost[]> {
  try {
    const store = getStore(env);
    const raw = await store.get(k('feddy', 'pinned', communityId));
    if (!raw) return [];
    const postIds: string[] = JSON.parse(raw);
    // Search through feed for matching posts
    const feedKey = k('feddy', 'feed', communityId);
    const feedRaw = await store.get(feedKey);
    if (!feedRaw) return [];
    const feed: string[] = JSON.parse(feedRaw);
    const posts: CommunityPost[] = [];
    for (const postKey of feed) {
      const postRaw = await store.get(postKey);
      if (postRaw) {
        const post = JSON.parse(postRaw) as CommunityPost;
        if (postIds.includes(post.id)) {
          post.isPinned = true;
          posts.push(post);
        }
      }
    }
    return posts;
  } catch {
    return [];
  }
}

// ─── Directory ─────────────────────────────────────────────────────────

export async function createEvent(env: Env, event: CommunityEvent): Promise<void> {
  const store = getStore(env);
  const eventKey = k('feddy', 'events', event.communityId, event.id);
  const indexKey = k('feddy', 'events', event.communityId, 'index');

  await Promise.all([
    store.put(eventKey, JSON.stringify(event), { expirationTtl: 86400 * 90 }),
    (async () => {
      const raw = await store.get(indexKey);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      ids.unshift(event.id);
      await store.put(indexKey, JSON.stringify(ids));
    })(),
  ]);
}

export async function getCommunityEvents(
  env: Env,
  communityId: string,
  limit = 20,
): Promise<CommunityEvent[]> {
  try {
    const store = getStore(env);
    const indexKey = k('feddy', 'events', communityId, 'index');
    const raw = await store.get(indexKey);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw).slice(0, limit);

    const events: CommunityEvent[] = [];
    for (const id of ids) {
      const eventRaw = await store.get(k('feddy', 'events', communityId, id));
      if (eventRaw) events.push(JSON.parse(eventRaw) as CommunityEvent);
    }
    return events.sort((a, b) => a.startTime - b.startTime);
  } catch {
    return [];
  }
}

export async function getUpcomingEvents(
  env: Env,
  communityId: string,
  limit = 10,
): Promise<CommunityEvent[]> {
  const events = await getCommunityEvents(env, communityId, 50);
  const now = Date.now();
  return events.filter((e) => e.endTime > now).slice(0, limit);
}

export async function rsvpEvent(env: Env, eventId: string, rsvp: EventRSVP): Promise<boolean> {
  try {
    const store = getStore(env);
    const key = k('feddy', 'event-rsvps', eventId);
    const raw = await store.get(key);
    const rsvps: EventRSVP[] = raw ? JSON.parse(raw) : [];

    const existing = rsvps.findIndex((r) => r.wallet === rsvp.wallet);
    if (existing >= 0) {
      rsvps[existing] = rsvp;
    } else {
      rsvps.push(rsvp);
    }

    await store.put(key, JSON.stringify(rsvps));
    return true;
  } catch {
    return false;
  }
}

export async function getEventRSVPs(env: Env, eventId: string): Promise<EventRSVP[]> {
  try {
    const key = k('feddy', 'event-rsvps', eventId);
    const raw = await getStore(env).get(key);
    return raw ? (JSON.parse(raw) as EventRSVP[]) : [];
  } catch {
    return [];
  }
}

// ─── Polls ─────────────────────────────────────────────────────────────

export async function createPoll(env: Env, poll: CommunityPoll): Promise<void> {
  const store = getStore(env);
  const pollKey = k('feddy', 'polls', poll.communityId, poll.id);
  const indexKey = k('feddy', 'polls', poll.communityId, 'index');

  await Promise.all([
    store.put(pollKey, JSON.stringify(poll), { expirationTtl: 86400 * 90 }),
    (async () => {
      const raw = await store.get(indexKey);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      ids.unshift(poll.id);
      await store.put(indexKey, JSON.stringify(ids));
    })(),
  ]);
}

export async function getCommunityPolls(env: Env, communityId: string): Promise<CommunityPoll[]> {
  try {
    const store = getStore(env);
    const indexKey = k('feddy', 'polls', communityId, 'index');
    const raw = await store.get(indexKey);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw);

    const polls: CommunityPoll[] = [];
    for (const id of ids) {
      const pollRaw = await store.get(k('feddy', 'polls', communityId, id));
      if (pollRaw) {
        const poll = JSON.parse(pollRaw) as CommunityPoll;
        poll.isClosed = poll.expiresAt < Date.now();
        polls.push(poll);
      }
    }
    return polls;
  } catch {
    return [];
  }
}

export async function votePoll(env: Env, pollId: string, vote: PollVote): Promise<boolean> {
  try {
    const store = getStore(env);
    const voteKey = k('feddy', 'poll-votes', pollId);
    const raw = await store.get(voteKey);
    const votes: PollVote[] = raw ? JSON.parse(raw) : [];

    // Check if already voted
    if (votes.some((v) => v.wallet === vote.wallet)) return false;

    votes.push(vote);
    await store.put(voteKey, JSON.stringify(votes));
    return true;
  } catch {
    return false;
  }
}

export async function getPollVotes(env: Env, pollId: string): Promise<PollVote[]> {
  try {
    const key = k('feddy', 'poll-votes', pollId);
    const raw = await getStore(env).get(key);
    return raw ? (JSON.parse(raw) as PollVote[]) : [];
  } catch {
    return [];
  }
}

// ─── Wiki ──────────────────────────────────────────────────────────────

export async function setWikiPages(
  env: Env,
  communityId: string,
  pages: WikiPage[],
): Promise<void> {
  await getStore(env).put(k('feddy', 'wiki', communityId), JSON.stringify(pages));
}

export async function getWikiPages(env: Env, communityId: string): Promise<WikiPage[]> {
  try {
    const raw = await getStore(env).get(k('feddy', 'wiki', communityId));
    return raw ? (JSON.parse(raw) as WikiPage[]) : [];
  } catch {
    return [];
  }
}

// ─── Badges ────────────────────────────────────────────────────────────

export async function createBadge(
  env: Env,
  communityId: string,
  badge: BadgeDefinition,
): Promise<void> {
  const store = getStore(env);
  const key = k('feddy', 'badges', communityId);
  const raw = await store.get(key);
  const badges: BadgeDefinition[] = raw ? JSON.parse(raw) : [];
  badges.push(badge);
  await store.put(key, JSON.stringify(badges));
}

export async function getBadges(env: Env, communityId: string): Promise<BadgeDefinition[]> {
  try {
    const raw = await getStore(env).get(k('feddy', 'badges', communityId));
    return raw ? (JSON.parse(raw) as BadgeDefinition[]) : [];
  } catch {
    return [];
  }
}
